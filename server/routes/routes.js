import express from "express";
import pool from "../db.js";
import { writeAuditEvent } from "../utils/audit.js";

export const router = express.Router();

const SECOND_ATTEMPT_DAYS = Number.parseInt(process.env.SECOND_ATTEMPT_DAYS || "15", 10);
const DELIVERY_ELIGIBLE_STATES = [
  "CLASSIFIED",
  "LEAD",
  "CASE_REVIEW",
  "NEW",
  "IN_DELIVERY",
  "NO_RESPONSE",
  "SECOND_ATTEMPT",
];

/* ===========================================================
   1️⃣ Crear ruta
   =========================================================== */
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    console.log("📩 [POST /routes] Request body:", req.body);
    const {
      name,
      created_by,
      points,
      route,
      scheduled_on,
      case_numbers = [],
      assigned_provider,
    } = req.body;

    if (!name || !created_by || !points) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const derivedCaseNumbers = Array.isArray(points)
      ? points
          .map((p) => p?.case_number)
          .filter((v) => typeof v === "string" && v.trim().length > 0)
      : [];

    const effectiveCaseNumbers = [
      ...new Set([
        ...(Array.isArray(case_numbers) ? case_numbers : []),
        ...derivedCaseNumbers,
      ]),
    ];

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO routes 
         (name, created_by, points, route, scheduled_on, created_at, assigned_provider, case_numbers)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
       RETURNING *`,
      [
        name,
        created_by,
        JSON.stringify(points),
        JSON.stringify(route || null),
        scheduled_on || new Date(),
        assigned_provider || null,
        effectiveCaseNumbers,
      ]
    );

    const routeRow = result.rows[0];

    // Si vienen casos, marcarlos como en reparto y dejar bitácora
    if (effectiveCaseNumbers.length) {
      // Obtener estados previos para bitácora
      const prevStates = await client.query(
        `SELECT case_number, current_state, delivery_attempts
         FROM houston_311_bcv 
         WHERE case_number = ANY($1::text[])`,
        [effectiveCaseNumbers]
      );

      await client.query(
          `UPDATE houston_311_bcv
            SET current_state = CASE
                  WHEN COALESCE(delivery_attempts, 0) + 1 >= 2 THEN 'SECOND_ATTEMPT'
                  ELSE 'IN_DELIVERY'
                END,
              consulta = 'red',
              sent_to_delivery_date = COALESCE(sent_to_delivery_date, NOW()),
              assigned_route_id = $2,
              delivery_attempts = COALESCE(delivery_attempts, 0) + 1,
              second_attempt_due_at = CASE
                  WHEN COALESCE(delivery_attempts, 0) + 1 >= 2
                  THEN NOW() + ($3::int * interval '1 day')
                  ELSE COALESCE(second_attempt_due_at, NOW() + ($3::int * interval '1 day'))
                END,
              updated_at = NOW()
          WHERE case_number = ANY($1::text[])
            AND current_state = ANY($4::text[])`,
          [effectiveCaseNumbers, routeRow.id, SECOND_ATTEMPT_DAYS, DELIVERY_ELIGIBLE_STATES]
      );

      if (prevStates.rows.length) {
        const auditValues = prevStates.rows.map((row) => {
          const isSecond = Number(row.delivery_attempts || 0) + 1 >= 2;
          const newState = isSecond ? 'SECOND_ATTEMPT' : 'IN_DELIVERY';
          return client.query(
            `INSERT INTO lead_audit_trail
               (case_number, previous_state, new_state, changed_by, change_reason, meta)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              row.case_number,
              row.current_state || null,
              newState,
              created_by,
              isSecond ? "Second delivery attempt" : "Route assignment",
              JSON.stringify({
                route_id: routeRow.id,
                event_type: isSecond ? "SECOND_ATTEMPT" : "ROUTE_CREATED",
                second_attempt_days: SECOND_ATTEMPT_DAYS,
              }),
            ]
          );
        });
        await Promise.all(auditValues);
      }
    }

    await client.query("COMMIT");

    // Audit: route created
    writeAuditEvent({
      action: "ROUTE_CREATED",
      entity: "route",
      entityId: String(routeRow.id),
      metadata: {
        name,
        created_by,
        case_count: effectiveCaseNumbers.length,
        case_numbers: effectiveCaseNumbers,
      },
    }).catch(() => {});

    res.status(201).json({ success: true, data: routeRow });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ Error rolling back route creation:", rollbackErr);
    }
    console.error("❌ Error creating route:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

/* ===========================================================
   2️⃣ Listar todas las rutas
   =========================================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         id, name, created_by, scheduled_on, created_at, updated_at,
         assigned_provider, case_numbers,
         CASE 
           WHEN points IS NULL THEN 0 
           WHEN jsonb_typeof(points::jsonb) = 'array' THEN jsonb_array_length(points::jsonb)
           ELSE 0
         END AS points_count
       FROM routes 
       ORDER BY created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching routes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================================
   2.1️⃣ Casos asociados a una ruta
   =========================================================== */
router.get("/:id/leads", async (req, res) => {
  try {
    const { id } = req.params;

    const routeResult = await pool.query(
      "SELECT id, name, case_numbers FROM routes WHERE id = $1 LIMIT 1",
      [id]
    );

    if (!routeResult.rows.length) {
      return res.status(404).json({ error: "Route not found" });
    }

    const routeRow = routeResult.rows[0];
    const caseNumbers = Array.isArray(routeRow.case_numbers) ? routeRow.case_numbers : [];

    const result = await pool.query(
      `SELECT case_number,
              incident_address,
              created_date_local,
              current_state,
              sent_to_delivery_date,
              contacted_at,
              contact_name,
              contact_phone,
              contact_note,
              second_attempt_due_at,
              assigned_route_id,
              delivery_attempts,
              publicity_attempts,
              consulta
         FROM houston_311_bcv
        WHERE assigned_route_id = $1
           OR case_number = ANY($2::text[])
        ORDER BY sent_to_delivery_date DESC NULLS LAST, case_number ASC`,
      [id, caseNumbers.length ? caseNumbers : ["__NO_CASE__"]]
    );

    res.json({ route: routeRow, data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching route leads:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================================
   3️⃣ Ver detalles de una ruta específica
   =========================================================== */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM routes WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching route detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================================
   3.1️⃣ Progreso de ruta: marcar entregados / sin contacto
   =========================================================== */
router.post("/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      delivered = [],
      no_contact = [],
      changedBy,
      contact_result,
      notes,
    } = req.body || {};

    if (!changedBy) {
      return res.status(400).json({ error: "Missing field: changedBy" });
    }

    const deliveredArr = Array.isArray(delivered) ? delivered : [];
    const noContactArr = Array.isArray(no_contact) ? no_contact : [];

    if (!deliveredArr.length && !noContactArr.length) {
      return res
        .status(400)
        .json({ error: "Provide delivered[] or no_contact[]" });
    }

    // Obtener estados previos para bitácora
    const allCases = [...new Set([...deliveredArr, ...noContactArr])];
    const prevStates = await pool.query(
      `SELECT case_number, current_state
         FROM houston_311_bcv
        WHERE case_number = ANY($1::text[])`,
      [allCases]
    );

    const now = new Date();

    if (deliveredArr.length) {
      await pool.query(
        `UPDATE houston_311_bcv
            SET current_state = 'CONTACTED',
                contacted_at = COALESCE(contacted_at, $3),
                last_contact_date = $3,
                contact_result = COALESCE($4, contact_result),
                updated_at = $3
          WHERE case_number = ANY($1::text[])
            AND assigned_route_id = $2`,
        [deliveredArr, id, now, contact_result || null]
      );
    }

    if (noContactArr.length) {
      await pool.query(
        `UPDATE houston_311_bcv
            SET current_state = 'NO_RESPONSE',
                no_response_at = COALESCE(no_response_at, $3),
                second_attempt_due_at = COALESCE(second_attempt_due_at, sent_to_delivery_date + ($4::int * interval '1 day'), $3 + ($4::int * interval '1 day')),
                updated_at = $3
          WHERE case_number = ANY($1::text[])
            AND assigned_route_id = $2`,
        [noContactArr, id, now, SECOND_ATTEMPT_DAYS]
      );
    }

    // Bitácora
    if (prevStates.rows.length) {
      const auditPromises = prevStates.rows.map((row) => {
        let newState = row.current_state;
        if (deliveredArr.includes(row.case_number)) newState = "CONTACTED";
        if (noContactArr.includes(row.case_number)) newState = "NO_RESPONSE";
        return pool.query(
          `INSERT INTO lead_audit_trail
             (case_number, previous_state, new_state, changed_by, change_reason, contact_result, notes, meta)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            row.case_number,
            row.current_state || null,
            newState,
            changedBy,
            deliveredArr.includes(row.case_number)
              ? "Route delivery"
              : "Route no contact",
            deliveredArr.includes(row.case_number)
              ? contact_result || null
              : null,
            notes || null,
            JSON.stringify({ route_id: Number(id) }),
          ]
        );
      });
      await Promise.all(auditPromises);
    }

    res.json({ success: true, delivered: deliveredArr.length, no_contact: noContactArr.length });
  } catch (err) {
    console.error("❌ Error updating route progress:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================================
   4️⃣ Actualizar ruta existente
   =========================================================== */
router.put("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, points, route, updated_by, scheduled_on, case_numbers = [], created_by } = req.body;

    await client.query("BEGIN");

    // Get existing route to find currently associated case_numbers
    const existing = await client.query(
      "SELECT case_numbers FROM routes WHERE id = $1",
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Route not found" });
    }

    const existingCaseNumbers = Array.isArray(existing.rows[0].case_numbers)
      ? existing.rows[0].case_numbers
      : [];

    // Derive case_numbers from points if not provided
    const derivedFromPoints = Array.isArray(points)
      ? points.map((p) => p?.case_number).filter((v) => typeof v === "string" && v.trim().length > 0)
      : [];

    const allIncoming = [
      ...new Set([
        ...(Array.isArray(case_numbers) ? case_numbers : []),
        ...derivedFromPoints,
      ]),
    ];

    // NEW cases = those in the incoming list but NOT already in the route
    const newCaseNumbers = allIncoming.filter((cn) => !existingCaseNumbers.includes(cn));

    // Merged case_numbers for the route record
    const mergedCaseNumbers = [...new Set([...existingCaseNumbers, ...allIncoming])];

    // Update the route record
    const result = await client.query(
      `UPDATE routes
         SET
           name = $1,
           points = $2,
           route = $3,
           updated_by = $4,
           scheduled_on = $5,
           updated_at = NOW(),
           case_numbers = $6
       WHERE id = $7
       RETURNING *`,
      [
        name,
        JSON.stringify(points),
        JSON.stringify(route || null),
        updated_by || created_by || null,
        scheduled_on || new Date(),
        mergedCaseNumbers,
        id,
      ]
    );

    // If there are NEW cases, mark them IN_DELIVERY (same logic as POST)
    if (newCaseNumbers.length > 0) {
      // Get previous states for audit trail
      const prevStates = await client.query(
        `SELECT case_number, current_state, delivery_attempts FROM houston_311_bcv WHERE case_number = ANY($1::text[])`,
        [newCaseNumbers]
      );

      await client.query(
        `UPDATE houston_311_bcv
            SET current_state = CASE
                  WHEN COALESCE(delivery_attempts, 0) + 1 >= 2 THEN 'SECOND_ATTEMPT'
                  ELSE 'IN_DELIVERY'
                END,
                consulta = 'red',
                sent_to_delivery_date = COALESCE(sent_to_delivery_date, NOW()),
                assigned_route_id = $2,
                delivery_attempts = COALESCE(delivery_attempts, 0) + 1,
                second_attempt_due_at = CASE
                    WHEN COALESCE(delivery_attempts, 0) + 1 >= 2
                    THEN NOW() + ($3::int * interval '1 day')
                    ELSE COALESCE(second_attempt_due_at, NOW() + ($3::int * interval '1 day'))
                  END,
                updated_at = NOW()
          WHERE case_number = ANY($1::text[])
            AND current_state = ANY($4::text[])`,
        [newCaseNumbers, Number(id), SECOND_ATTEMPT_DAYS, DELIVERY_ELIGIBLE_STATES]
      );

      // Audit trail for new cases
      if (prevStates.rows.length) {
        const auditInserts = prevStates.rows.map((row) => {
          const isSecond = Number(row.delivery_attempts || 0) + 1 >= 2;
          const newState = isSecond ? 'SECOND_ATTEMPT' : 'IN_DELIVERY';
          return client.query(
            `INSERT INTO lead_audit_trail
               (case_number, previous_state, new_state, changed_by, change_reason, meta)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              row.case_number,
              row.current_state || null,
              newState,
              updated_by || created_by || "system",
              isSecond ? "Second delivery attempt" : "Added to existing route",
              JSON.stringify({ route_id: Number(id), route_name: name, event_type: isSecond ? "SECOND_ATTEMPT" : "ROUTE_UPDATED" }),
            ]
          );
        });
        await Promise.all(auditInserts);
      }
    }

    await client.query("COMMIT");

    // Audit: route updated
    writeAuditEvent({
      action: "ROUTE_UPDATED",
      entity: "route",
      entityId: String(id),
      metadata: {
        name,
        updated_by: updated_by || created_by || null,
        new_cases_added: newCaseNumbers.length,
        new_cases: newCaseNumbers,
        total_cases: mergedCaseNumbers.length,
      },
    }).catch(() => {});

    res.json({ success: true, data: result.rows[0], new_cases_added: newCaseNumbers.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating route:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

/* ===========================================================
   5️⃣ Eliminar ruta
   =========================================================== */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const deleted_by = req.body?.deleted_by || req.query?.deleted_by || null;

    await client.query("BEGIN");

    // Obtener info de la ruta antes de borrar
    const routeInfo = await client.query(
      "SELECT id, name, case_numbers FROM routes WHERE id = $1",
      [id]
    );
    if (routeInfo.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Route not found" });
    }
    const routeRow = routeInfo.rows[0];
    const caseNumbers = Array.isArray(routeRow.case_numbers) ? routeRow.case_numbers : [];

    // Resetear casos que aún están en estados activos de reparto
    // (los CONTACTED/CLOSED no se tocan — ya tuvieron resultado)
    const resetResult = await client.query(
      `UPDATE houston_311_bcv
          SET current_state    = 'CLASSIFIED',
              assigned_route_id   = NULL,
              delivery_attempts   = 0,
              sent_to_delivery_date = NULL,
              second_attempt_due_at = NULL,
              no_response_at      = NULL,
              updated_at          = NOW()
        WHERE (assigned_route_id = $1 OR case_number = ANY($2::text[]))
          AND current_state IN ('IN_DELIVERY', 'SECOND_ATTEMPT', 'NO_RESPONSE')
        RETURNING case_number`,
      [id, caseNumbers.length ? caseNumbers : ["__NO_CASE__"]]
    );
    const resetCases = resetResult.rows.map((r) => r.case_number);

    // Bitácora de los casos reseteados
    if (resetCases.length) {
      await Promise.all(
        resetCases.map((cn) =>
          client.query(
            `INSERT INTO lead_audit_trail
               (case_number, previous_state, new_state, changed_by, change_reason, meta)
             VALUES ($1, 'IN_DELIVERY', 'CLASSIFIED', $2, 'Route deleted — delivery reset', $3)`,
            [cn, deleted_by || "system", JSON.stringify({ route_id: Number(id), route_name: routeRow.name })]
          )
        )
      );
    }

    // Eliminar la ruta
    await client.query("DELETE FROM routes WHERE id = $1", [id]);

    await client.query("COMMIT");

    // Audit event
    writeAuditEvent({
      action: "ROUTE_DELETED",
      entity: "route",
      entityId: String(id),
      metadata: {
        name: routeRow.name,
        deleted_by,
        cases_reset: resetCases.length,
        case_numbers: resetCases,
      },
    }).catch(() => {});

    res.json({ success: true, deleted: Number(id), cases_reset: resetCases.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error deleting route:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

export default router;
