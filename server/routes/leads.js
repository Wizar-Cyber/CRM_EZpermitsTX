import express from "express";
import pool from "../db.js";

export const leadsRouter = express.Router();

// 📍 GET: Todos los leads (con filtros y orden)
leadsRouter.get("/", async (req, res) => {
  try {
    const { q, status, filter, sort = "created_date_local", order = "desc" } = req.query;

    let query = `
      SELECT 
        case_number, incident_address, created_date_local, resolve_by_time,
        state_code_name, zip_code, created_date_utc, channel, extract_date,
        latest_case_notes, created_date, status, description, resolution,
        created_date_inspector, description_inspector, resolution_inspector,
        url, consulta, manual_classification,
        current_state, sent_to_delivery_date, second_attempt_due_at, assigned_route_id, contact_result
      FROM houston_311_bcv
      WHERE 1=1
        AND NOT EXISTS (
          SELECT 1
            FROM clientes c
           WHERE c.case_number = houston_311_bcv.case_number
        )
    `;

    const values = [];
    let i = 1;

    if (q) {
      query += ` AND incident_address ILIKE $${i++}`;
      values.push(`%${q}%`);
    }

    if (status) {
      query += ` AND status = $${i++}`;
      values.push(status);
    }

    if (filter === "in_delivery") {
      query += ` AND current_state IN ('IN_DELIVERY', 'SECOND_ATTEMPT')`;
    } else if (filter === "second_attempt_due") {
      query += ` AND current_state = 'NO_RESPONSE' AND second_attempt_due_at IS NOT NULL AND second_attempt_due_at <= NOW()`;
    } else {
      // Por defecto, ocultar los que están en reparto (activo o segundo intento)
      query += ` AND current_state NOT IN ('IN_DELIVERY', 'SECOND_ATTEMPT')`;
    }

    // ✅ Seguridad: solo permitir columnas válidas para ordenamiento
    const validSortCols = [
      "created_date_local",
      "case_number",
      "incident_address",
      "status",
    ];
    const sortCol = validSortCols.includes(sort)
      ? sort
      : "created_date_local";

    query += ` ORDER BY ${sortCol} ${
      order?.toString().toUpperCase() === "ASC" ? "ASC" : "DESC"
    }`;

    const result = await pool.query(query, values);
    res.json({ data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching leads:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📍 GET: Lead por ID (case_number)
leadsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        case_number, incident_address, created_date_local, resolve_by_time,
        state_code_name, zip_code, created_date_utc, channel, extract_date,
        latest_case_notes, created_date, status, description, resolution,
        created_date_inspector, description_inspector, resolution_inspector,
        url, consulta, manual_classification,
        current_state, sent_to_delivery_date, second_attempt_due_at, assigned_route_id, contact_result
      FROM houston_311_bcv
      WHERE case_number = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Lead not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching lead detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📍 DELETE: Eliminar un lead por ID
leadsRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = "DELETE FROM houston_311_bcv WHERE case_number = $1";
    await pool.query(query, [id]);
    res.json({ success: true, message: "Lead deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting lead:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📍 POST: Crear nueva ruta (se conserva tal cual)
leadsRouter.post("/", async (req, res) => {
  try {
    const { name, created_by, points, route } = req.body;
    if (!name || !points)
      return res.status(400).json({ error: "Missing data" });

    const query = `
      INSERT INTO routes (name, created_by, points, route)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [
      name,
      created_by || "system",
      points,
      route || [],
    ]);
    res.json({ success: true, route: result.rows[0] });
  } catch (err) {
    console.error("❌ Error creating route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// 📍 PATCH: Actualizar campo "consulta" (marcar o revertir casos)
leadsRouter.patch("/:case_number/consulta", async (req, res) => {
  const { case_number } = req.params;
  const { consulta } = req.body;

  try {
    // limpieza de espacios o caracteres ocultos
    const cleanCase = case_number.trim();

    const result = await pool.query(
      `UPDATE houston_311_bcv 
       SET consulta = $1 
       WHERE TRIM(case_number) = TRIM($2)`,
      [consulta, cleanCase]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: `Case '${cleanCase}' not found in database` });
    }

    res.json({
      success: true,
      message: `Case '${cleanCase}' updated to consulta='${consulta ?? "null"}'`,
    });
  } catch (err) {
    console.error("❌ Error updating consulta:", err);
    res.status(500).json({ error: "Database update failed" });
  }
});

// 📍 PATCH: Actualizar campo "manual_classification" (green | yellow | blue | null)
leadsRouter.patch("/:case_number/manual_classification", async (req, res) => {
  const { case_number } = req.params;
  let { manual_classification } = req.body;

  try {
    const cleanCase = case_number.trim();

    // normaliza valor permitido
    const allowed = [null, "green", "yellow", "blue"];
    if (manual_classification !== null) {
      manual_classification = String(manual_classification).toLowerCase();
    }
    if (!allowed.includes(manual_classification)) {
      return res.status(400).json({
        error: "manual_classification must be one of: 'green','yellow','blue', or null",
      });
    }

    const result = await pool.query(
      `UPDATE houston_311_bcv
       SET manual_classification = $1
       WHERE TRIM(case_number) = TRIM($2)`,
      [manual_classification, cleanCase]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: `Case '${cleanCase}' not found in database` });
    }

    res.json({
      success: true,
      message: `Case '${cleanCase}' updated manual_classification='${manual_classification ?? "null"}'`,
    });
  } catch (err) {
    console.error("❌ Error updating manual_classification:", err);
    res.status(500).json({ error: "Database update failed" });
  }
});



export default leadsRouter;
