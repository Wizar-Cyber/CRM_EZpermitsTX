import express from "express";
import  pool from "../db.js";

export const leadsRouter = express.Router();

// 📍 GET: Todos los leads (con filtros y orden)
leadsRouter.get("/", async (req, res) => {
  try {
    const { q, status, sort = "created_date_local", order = "desc" } = req.query;

    let query = `
      SELECT 
        case_number, incident_address, created_date_local, resolve_by_time, ava_case_type,
        state_code_name, zip_code, created_date_utc, channel, extract_date,
        latest_case_notes, created_date, status, description, resolution
      FROM houston_311_bcv
      WHERE 1=1
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

    // ✅ Seguridad: solo permitimos ordenar por columnas válidas
    const validSortCols = ["created_date_local", "case_number", "incident_address", "status"];
    const sortCol = validSortCols.includes(sort) ? sort : "created_date_local";

    query += ` ORDER BY ${sortCol} ${order?.toString().toUpperCase() === "ASC" ? "ASC" : "DESC"}`;

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
    const query = `SELECT * FROM houston_311_bcv WHERE case_number = $1 LIMIT 1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Lead not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching lead detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📍 POST: Crear nueva ruta (si lo necesitas)
leadsRouter.post("/", async (req, res) => {
  try {
    const { name, created_by, points, route } = req.body;
    if (!name || !points) return res.status(400).json({ error: "Missing data" });

    const query = `
      INSERT INTO routes (name, created_by, points, route)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [name, created_by || "system", points, route || []]);
    res.json({ success: true, route: result.rows[0] });
  } catch (err) {
    console.error("❌ Error creating route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
export default leadsRouter;