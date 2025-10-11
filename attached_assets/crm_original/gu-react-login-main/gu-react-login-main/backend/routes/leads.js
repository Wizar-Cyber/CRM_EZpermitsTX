import express from "express";
import { pool } from "../db.js";

const router = express.Router();
console.log("✅ leads.js loaded");

// 📌 GET all leads (with filters & sort)
router.get("/", async (req, res) => {
  try {
    const { q, status, sort = "created_date_local", order = "desc" } = req.query;

    let baseQuery = `
      SELECT 
        case_number AS "case_number",
        incident_address AS "incident_address",
        created_date_local AS "created_date_local",
        resolve_by_time AS "resolve_by_time",
        ava_case_type AS "ava_case_type",
        state_code_name AS "state_code_name",
        zip_code AS "zip_code",
        created_date_utc AS "created_date_utc",
        channel AS "channel",
        extract_date AS "extract_date",
        latest_case_notes AS "latest_case_notes",
        created_date AS "created_date",
        status AS "status",
        description AS "description",
        resolution AS "resolution"
      FROM houston_311_bcv
      WHERE 1=1
    `;

    const values = [];
    let idx = 1;

    if (q) {
      baseQuery += ` AND incident_address ILIKE $${idx++}`;
      values.push(`%${q}%`);
    }

    if (status) {
      baseQuery += ` AND status = $${idx++}`;
      values.push(status);
    }

    // 👀 seguridad: solo permitimos ordenar por columnas válidas
    const validSortCols = [
      "created_date_local",
      "case_number",
      "incident_address",
      "status",
    ];
    const sortCol = validSortCols.includes(sort) ? sort : "created_date_local";

    baseQuery += ` ORDER BY ${sortCol} ${order.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;

    const result = await pool.query(baseQuery, values);
    res.json({ data: result.rows });
  } catch (err) {
    console.error("Error fetching leads:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 GET detail of a lead by case_number
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        case_number AS "case_number",
        incident_address AS "incident_address",
        created_date_local AS "created_date_local",
        resolve_by_time AS "resolve_by_time",
        ava_case_type AS "ava_case_type",
        state_code_name AS "state_code_name",
        zip_code AS "zip_code",
        created_date_utc AS "created_date_utc",
        channel AS "channel",
        extract_date AS "extract_date",
        latest_case_notes AS "latest_case_notes",
        created_date AS "created_date",
        status AS "status",
        description AS "description",
        resolution AS "resolution"
      FROM houston_311_bcv
      WHERE case_number = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching lead detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
