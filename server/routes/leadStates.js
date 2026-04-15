import express from "express";
import pool from "../db.js";

export const leadStatesRouter = express.Router();
let contactInfoInfraReady = false;

async function ensureContactInfoInfra() {
  if (contactInfoInfraReady) return;

  await pool.query(
    `ALTER TABLE houston_311_bcv
       ADD COLUMN IF NOT EXISTS contact_name TEXT NULL`
  );
  await pool.query(
    `ALTER TABLE houston_311_bcv
       ADD COLUMN IF NOT EXISTS contact_phone TEXT NULL`
  );
  await pool.query(
    `ALTER TABLE houston_311_bcv
       ADD COLUMN IF NOT EXISTS contact_note TEXT NULL`
  );

  contactInfoInfraReady = true;
}

// Estados válidos del proceso CRM (alineados a flujo operativo)
const CRM_STATES = {
  NEW: 'NEW',
  CLASSIFIED: 'CLASSIFIED',
  IN_DELIVERY: 'IN_DELIVERY',
  CONTACTED: 'CONTACTED',
  NO_RESPONSE: 'NO_RESPONSE',
  SECOND_ATTEMPT: 'SECOND_ATTEMPT',
  CLOSED: 'CLOSED',
};

const SECOND_ATTEMPT_DAYS = Number.parseInt(process.env.SECOND_ATTEMPT_DAYS || "15", 10);

// Transiciones permitidas
const STATE_TRANSITIONS = {
  [CRM_STATES.NEW]: [CRM_STATES.CLASSIFIED, CRM_STATES.CLOSED],
  [CRM_STATES.CLASSIFIED]: [CRM_STATES.IN_DELIVERY, CRM_STATES.CLOSED],
  [CRM_STATES.IN_DELIVERY]: [CRM_STATES.CONTACTED, CRM_STATES.NO_RESPONSE],
  [CRM_STATES.CONTACTED]: [CRM_STATES.CLOSED],
  [CRM_STATES.NO_RESPONSE]: [CRM_STATES.SECOND_ATTEMPT, CRM_STATES.CONTACTED, CRM_STATES.CLOSED],
  [CRM_STATES.SECOND_ATTEMPT]: [CRM_STATES.CONTACTED, CRM_STATES.NO_RESPONSE, CRM_STATES.CLOSED],
  [CRM_STATES.CLOSED]: [],
};

// Validar transición de estado
const validateTransition = (fromState, toState) => {
  if (!STATE_TRANSITIONS[fromState] || !STATE_TRANSITIONS[fromState].includes(toState)) {
    throw new Error(`Invalid transition from ${fromState} to ${toState}`);
  }
};

// Registrar cambio en bitácora
const logStateChange = async (caseNumber, previousState, newState, changedBy, reason, contactResult = null) => {
  await pool.query(
    `INSERT INTO lead_audit_trail (case_number, previous_state, new_state, changed_by, change_reason, contact_result)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [caseNumber, previousState, newState, changedBy, reason, contactResult]
  );
};

// POST: Cambiar estado de un lead
leadStatesRouter.post("/:caseNumber/state", async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { newState, changedBy, reason, contactResult } = req.body;

    if (!newState || !changedBy) {
      return res.status(400).json({ error: "Missing required fields: newState, changedBy" });
    }

    // Obtener estado actual y fechas relevantes
    const currentResult = await pool.query(
      "SELECT current_state, sent_to_delivery_date, delivery_attempts, publicity_attempts FROM houston_311_bcv WHERE case_number = $1",
      [caseNumber]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const currentState = currentResult.rows[0].current_state || CRM_STATES.NEW;

    // Validar transición
    validateTransition(currentState, newState);

    // Actualizar estado según el tipo de transición
    let updateFields = {
      current_state: newState,
      updated_at: new Date()
    };

    // Lógica específica por transición
    if (newState === CRM_STATES.IN_DELIVERY) {
      updateFields.sent_to_delivery_date = new Date();
      updateFields.delivery_attempts = (currentResult.rows[0].delivery_attempts || 0) + 1;
    }

    if (newState === CRM_STATES.CONTACTED) {
      updateFields.contacted_at = new Date();
      updateFields.last_contact_date = new Date();
      updateFields.contact_result = contactResult || null;
    }

    if (newState === CRM_STATES.NO_RESPONSE) {
      updateFields.no_response_at = new Date();
      const sentDate = currentResult.rows[0].sent_to_delivery_date
        ? new Date(currentResult.rows[0].sent_to_delivery_date)
        : null;
      updateFields.second_attempt_due_at = sentDate
        ? new Date(sentDate.getTime() + SECOND_ATTEMPT_DAYS * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + SECOND_ATTEMPT_DAYS * 24 * 60 * 60 * 1000);
    }

    if (newState === CRM_STATES.SECOND_ATTEMPT) {
      updateFields.second_attempt_sent_at = new Date();
      updateFields.publicity_attempts = (currentResult.rows[0].publicity_attempts || 0) + 1;
    }

    // Construir query dinámica
    const setClause = Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [caseNumber, ...Object.values(updateFields)];

    await pool.query(
      `UPDATE houston_311_bcv SET ${setClause} WHERE case_number = $1`,
      values
    );

    // Registrar en bitácora
    await logStateChange(caseNumber, currentState, newState, changedBy, reason, contactResult);

    res.json({
      success: true,
      message: `State changed from ${currentState} to ${newState}`,
      previousState: currentState,
      newState
    });

  } catch (err) {
    console.error("❌ Error changing lead state:", err);
    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

// GET: Historial de cambios de estado
leadStatesRouter.get("/:caseNumber/history", async (req, res) => {
  try {
    const { caseNumber } = req.params;

    const result = await pool.query(
      `SELECT * FROM lead_audit_trail 
       WHERE case_number = $1 
       ORDER BY created_at DESC`,
      [caseNumber]
    );

    res.json({ data: result.rows });

  } catch (err) {
    console.error("❌ Error fetching state history:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Leads por estado
leadStatesRouter.get("/by-state/:state", async (req, res) => {
  try {
    const { state } = req.params;

    if (!Object.values(CRM_STATES).includes(state)) {
      return res.status(400).json({ error: "Invalid state" });
    }

    const result = await pool.query(
      `SELECT case_number, incident_address, current_state, sent_to_delivery_date, 
              follow_up_start_date, last_contact_date, delivery_attempts, publicity_attempts
       FROM houston_311_bcv 
       WHERE current_state = $1 
       ORDER BY updated_at DESC`,
      [state]
    );

    res.json({ data: result.rows });

  } catch (err) {
    console.error("❌ Error fetching leads by state:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Casos en reparto sin contacto
leadStatesRouter.get("/in-delivery-no-contact", async (_req, res) => {
  try {
    await ensureContactInfoInfra();
    const result = await pool.query(
      `SELECT l.case_number,
              l.incident_address,
              l.created_date_local,
              l.sent_to_delivery_date,
              l.current_state,
              l.assigned_route_id,
              l.second_attempt_due_at,
              l.delivery_attempts,
              l.publicity_attempts,
              l.consulta,
              r.name AS route_name,
              r.created_at AS route_created_at,
              r.updated_at AS route_updated_at
         FROM houston_311_bcv l
         LEFT JOIN routes r ON r.id = l.assigned_route_id
        WHERE l.current_state = 'IN_DELIVERY'
          AND l.contacted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
              FROM clientes c
             WHERE c.case_number = l.case_number
          )
        ORDER BY l.sent_to_delivery_date ASC NULLS LAST`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching IN_DELIVERY without contact:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Casos con segundo intento vencido
leadStatesRouter.get("/second-attempt-due", async (_req, res) => {
  try {
    await ensureContactInfoInfra();
    const result = await pool.query(
      `SELECT l.case_number,
              l.incident_address,
              l.created_date_local,
              l.sent_to_delivery_date,
              l.current_state,
              l.assigned_route_id,
              l.no_response_at,
              l.second_attempt_due_at,
              l.delivery_attempts,
              l.publicity_attempts,
              l.consulta,
              r.name AS route_name,
              r.created_at AS route_created_at,
              r.updated_at AS route_updated_at
         FROM houston_311_bcv l
         LEFT JOIN routes r ON r.id = l.assigned_route_id
        WHERE l.contacted_at IS NULL
          AND (
            -- Casos enviados por segunda vez: mostrar inmediatamente
            l.current_state = 'SECOND_ATTEMPT'
            OR
            -- Casos sin respuesta cuya fecha de segundo intento ya venció
            (l.current_state = 'NO_RESPONSE'
             AND l.second_attempt_due_at IS NOT NULL
             AND l.second_attempt_due_at <= NOW())
          )
          AND NOT EXISTS (
            SELECT 1
              FROM clientes c
             WHERE c.case_number = l.case_number
          )
        ORDER BY l.current_state DESC, l.second_attempt_due_at ASC NULLS LAST`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching second-attempt due leads:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Casos cerrados
leadStatesRouter.get("/closed", async (_req, res) => {
  try {
    await ensureContactInfoInfra();
    const result = await pool.query(
      `SELECT l.case_number,
              l.incident_address,
              l.created_date_local,
              l.sent_to_delivery_date,
              l.current_state,
              l.assigned_route_id,
              l.contacted_at,
              l.contact_name,
              l.contact_phone,
              l.contact_note,
              l.delivery_attempts,
              l.publicity_attempts,
              l.consulta,
              r.name AS route_name,
              r.created_at AS route_created_at,
              r.updated_at AS route_updated_at
         FROM houston_311_bcv l
         LEFT JOIN routes r ON r.id = l.assigned_route_id
        WHERE l.current_state = 'CLOSED'
          AND NOT EXISTS (
            SELECT 1
              FROM clientes c
             WHERE c.case_number = l.case_number
          )
        ORDER BY l.updated_at DESC NULLS LAST`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching closed leads:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Casos en seguimiento (contactados)
leadStatesRouter.get("/follow-up", async (_req, res) => {
  try {
    await ensureContactInfoInfra();
    const result = await pool.query(
      `SELECT l.case_number,
              l.incident_address,
              l.created_date_local,
              l.sent_to_delivery_date,
              l.current_state,
              l.assigned_route_id,
              l.contacted_at,
              l.contact_name,
              l.contact_phone,
              l.contact_note,
              l.delivery_attempts,
              l.publicity_attempts,
              l.consulta,
              r.name AS route_name,
              r.created_at AS route_created_at,
              r.updated_at AS route_updated_at
         FROM houston_311_bcv l
         LEFT JOIN routes r ON r.id = l.assigned_route_id
        WHERE l.current_state = 'CONTACTED'
          AND NOT EXISTS (
            SELECT 1
              FROM clientes c
             WHERE c.case_number = l.case_number
          )
        ORDER BY l.contacted_at DESC NULLS LAST, l.updated_at DESC NULLS LAST`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching follow-up leads:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH: Registrar resultado de contacto
leadStatesRouter.patch("/:caseNumber/contact", async (req, res) => {
  try {
    await ensureContactInfoInfra();
    const { caseNumber } = req.params;
    const { changedBy, result, notes, contact_name, contact_phone, contact_note } = req.body || {};

    if (!changedBy || !result) {
      return res.status(400).json({ error: "Missing required fields: changedBy, result" });
    }

    const normalized = String(result).toUpperCase();
    if (!["CONTACTED", "NO_RESPONSE"].includes(normalized)) {
      return res.status(400).json({ error: "result must be CONTACTED or NO_RESPONSE" });
    }

    const current = await pool.query(
      `SELECT case_number, current_state, sent_to_delivery_date
         FROM houston_311_bcv
        WHERE case_number = $1
        LIMIT 1`,
      [caseNumber]
    );

    if (!current.rows.length) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const prevState = current.rows[0].current_state || CRM_STATES.NEW;
    const now = new Date();

    if (normalized === "CONTACTED") {
      await pool.query(
        `UPDATE houston_311_bcv
            SET current_state = 'CONTACTED',
                contacted_at = COALESCE(contacted_at, $2),
                last_contact_date = $2,
                contact_result = 'CONTACTED',
                contact_name = COALESCE(NULLIF(TRIM($3), ''), contact_name),
                contact_phone = COALESCE(NULLIF(TRIM($4), ''), contact_phone),
                contact_note = COALESCE(NULLIF(TRIM($5), ''), contact_note),
                updated_at = $2
          WHERE case_number = $1`,
        [caseNumber, now, contact_name || null, contact_phone || null, contact_note || null]
      );
    } else {
      await pool.query(
        `UPDATE houston_311_bcv
            SET current_state = 'NO_RESPONSE',
                no_response_at = COALESCE(no_response_at, $2),
                second_attempt_due_at = COALESCE(second_attempt_due_at, sent_to_delivery_date + ($3::int * interval '1 day'), $2 + ($3::int * interval '1 day')),
                contact_result = 'NO_RESPONSE',
                updated_at = $2
          WHERE case_number = $1`,
        [caseNumber, now, SECOND_ATTEMPT_DAYS]
      );
    }

    await pool.query(
      `INSERT INTO lead_audit_trail
         (case_number, previous_state, new_state, changed_by, change_reason, contact_result, notes, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        caseNumber,
        prevState,
        normalized,
        changedBy,
        normalized === "CONTACTED" ? "Customer contacted" : "No response after delivery",
        normalized,
        notes || null,
        JSON.stringify({
          event_type: "CONTACT_RESULT_RECORDED",
          second_attempt_days: SECOND_ATTEMPT_DAYS,
          contact_name: contact_name || null,
          contact_phone: contact_phone || null,
          contact_note: contact_note || null,
        }),
      ]
    );

    res.json({ success: true, caseNumber, previousState: prevState, newState: normalized });
  } catch (err) {
    console.error("❌ Error updating contact result:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH: Cerrar caso explícitamente
leadStatesRouter.patch("/:caseNumber/close", async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { changedBy, reason, notes } = req.body || {};

    if (!changedBy) {
      return res.status(400).json({ error: "Missing required field: changedBy" });
    }

    const current = await pool.query(
      `SELECT case_number, current_state
         FROM houston_311_bcv
        WHERE case_number = $1
        LIMIT 1`,
      [caseNumber]
    );

    if (!current.rows.length) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const prevState = current.rows[0].current_state || CRM_STATES.NEW;
    const now = new Date();

    await pool.query(
      `UPDATE houston_311_bcv
          SET current_state = 'CLOSED',
              consulta = 'red',
              updated_at = $2
        WHERE case_number = $1`,
      [caseNumber, now]
    );

    await pool.query(
      `INSERT INTO lead_audit_trail
         (case_number, previous_state, new_state, changed_by, change_reason, notes, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        caseNumber,
        prevState,
        "CLOSED",
        changedBy,
        reason || "Case closed",
        notes || null,
        JSON.stringify({ event_type: "CASE_CLOSED_MANUAL" }),
      ]
    );

    res.json({ success: true, caseNumber, previousState: prevState, newState: "CLOSED" });
  } catch (err) {
    console.error("❌ Error closing case:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH: Reabrir caso cerrado y devolver a Delivery
leadStatesRouter.patch("/:caseNumber/reopen", async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { changedBy, reason, notes } = req.body || {};

    if (!changedBy) {
      return res.status(400).json({ error: "Missing required field: changedBy" });
    }

    const current = await pool.query(
      `SELECT case_number, current_state
         FROM houston_311_bcv
        WHERE case_number = $1
        LIMIT 1`,
      [caseNumber]
    );

    if (!current.rows.length) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const prevState = current.rows[0].current_state || CRM_STATES.NEW;
    const now = new Date();

    await pool.query(
      `UPDATE houston_311_bcv
          SET current_state = 'IN_DELIVERY',
              consulta = 'red',
              contacted_at = NULL,
              contact_result = NULL,
              sent_to_delivery_date = COALESCE(sent_to_delivery_date, $2),
              second_attempt_due_at = COALESCE(second_attempt_due_at, $2 + ($3::int * interval '1 day')),
              updated_at = $2
        WHERE case_number = $1`,
      [caseNumber, now, SECOND_ATTEMPT_DAYS]
    );

    await pool.query(
      `INSERT INTO lead_audit_trail
         (case_number, previous_state, new_state, changed_by, change_reason, notes, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        caseNumber,
        prevState,
        "IN_DELIVERY",
        changedBy,
        reason || "Case reopened to delivery",
        notes || null,
        JSON.stringify({ event_type: "CASE_REOPENED" }),
      ]
    );

    res.json({ success: true, caseNumber, previousState: prevState, newState: "IN_DELIVERY" });
  } catch (err) {
    console.error("❌ Error reopening case:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST: Acción masiva - Marcar leads como "En Reparto"
leadStatesRouter.post("/bulk/mark-delivery", async (req, res) => {
  try {
    const { caseNumbers, changedBy, reason } = req.body;

    if (!caseNumbers || !Array.isArray(caseNumbers) || !changedBy) {
      return res.status(400).json({ 
        error: "Missing required fields: caseNumbers (array), changedBy" 
      });
    }

    const results = [];
    const errors = [];

    for (const caseNumber of caseNumbers) {
      try {
        // Obtener estado actual
        const currentResult = await pool.query(
          "SELECT current_state FROM houston_311_bcv WHERE case_number = $1",
          [caseNumber]
        );

        if (currentResult.rows.length === 0) {
          errors.push({ caseNumber, error: "Lead not found" });
          continue;
        }

        const currentState = currentResult.rows[0].current_state || CRM_STATES.NEW;

        // Solo procesar leads en estado LEAD
        if (currentState !== CRM_STATES.CLASSIFIED && currentState !== 'LEAD') {
          errors.push({ 
            caseNumber, 
            error: `Invalid state for bulk delivery: ${currentState}. Only CLASSIFIED/LEAD state allowed.` 
          });
          continue;
        }

        // Actualizar a IN_DELIVERY
        await pool.query(
          `UPDATE houston_311_bcv 
           SET current_state = $1, 
               sent_to_delivery_date = $2,
               delivery_attempts = COALESCE(delivery_attempts, 0) + 1,
               updated_at = $3
           WHERE case_number = $4`,
          [CRM_STATES.IN_DELIVERY, new Date(), new Date(), caseNumber]
        );

        // Registrar en bitácora
        await logStateChange(
          caseNumber, 
          currentState, 
          CRM_STATES.IN_DELIVERY, 
          changedBy, 
          reason || "Bulk delivery assignment"
        );

        results.push({ caseNumber, success: true });

      } catch (err) {
        errors.push({ caseNumber, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${caseNumbers.length} leads`,
      results,
      errors,
      successCount: results.length,
      errorCount: errors.length
    });

  } catch (err) {
    console.error("❌ Error in bulk delivery marking:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default leadStatesRouter;
