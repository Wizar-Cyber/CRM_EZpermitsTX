import express from "express";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   🧭 GET ALL CLIENTS
   ========================================================= */
router.get("/", authenticate, async (req, res) => {
  try {
    const query = `
      SELECT c.*, u.fullname AS assigned_name, h.description
      FROM clientes c
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN houston_311_bcv h ON c.case_number = h.case_number
      WHERE c.archived = false
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching clients:", err);
    res.status(500).json({ error: "Error fetching clients" });
  }
});

/* =========================================================
   🔍 VALIDATE CASE NUMBER
   ========================================================= */
router.get("/validate-case/:case_number", async (req, res) => {
  const { case_number } = req.params;
  try {
    const result = await pool.query(
      `SELECT case_number, description
       FROM houston_311_bcv
       WHERE CAST(case_number AS TEXT) ILIKE $1
       LIMIT 1`,
      [case_number]
    );

    if (!result.rowCount)
      return res.status(404).json({ valid: false, message: "Case not found" });

    res.json({ valid: true, description: result.rows[0].description });
  } catch (err) {
    console.error("❌ Error validating case:", err);
    res.status(500).json({ error: "Error validating case" });
  }
});

/* =========================================================
   🆕 CREATE CLIENT
   ========================================================= */
router.post("/", authenticate, async (req, res) => {
  const {
    fullname,
    email,
    phone,
    address,
    type,
    status,
    priority,
    source,
    case_number,
  } = req.body;

  try {
    let description = null;
    if (case_number) {
      const caseCheck = await pool.query(
        "SELECT description FROM houston_311_bcv WHERE case_number = $1",
        [case_number]
      );
      if (caseCheck.rowCount === 0)
        return res.status(400).json({ error: "Invalid case number" });
      description = caseCheck.rows[0].description;
    }

    const assigned_to = req.user.id;
    const result = await pool.query(
      `INSERT INTO clientes (fullname, email, phone, address, type, status, priority, source, assigned_to, case_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        fullname,
        email,
        phone,
        address,
        type || "new",
        status || "pending",
        priority || "medium",
        source,
        assigned_to,
        case_number,
      ]
    );
    res.status(201).json({ ...result.rows[0], description });
  } catch (err) {
    console.error("❌ Error creating client:", err);
    res.status(500).json({ error: "Error creating client" });
  }
});

/* =========================================================
   ✏️ UPDATE CLIENT
   ========================================================= */
router.put("/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  const allowedFields = [
    "fullname",
    "email",
    "phone",
    "address",
    "type",
    "status",
    "priority",
    "source",
    "assigned_to",
    "case_number",
  ];

  const fields = [];
  const values = [];
  let index = 1;

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = $${index++}`);
      values.push(req.body[key]);
    }
  }

  if (!fields.length)
    return res.status(400).json({ error: "No fields provided" });

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE clientes SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`,
      values
    );

    await pool.query(
      `INSERT INTO cliente_eventos (cliente_id, author_id, tipo, descripcion)
       VALUES ($1,$2,'update','Client updated by user')`,
      [id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating client:", err);
    res.status(500).json({ error: "Error updating client" });
  }
});

/* =========================================================
   🗒️ ADD NOTE
   ========================================================= */
router.post("/:id/notas", authenticate, async (req, res) => {
  const { id } = req.params;
  const { nota } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO cliente_notas (cliente_id, author_id, nota)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [id, req.user.id, nota]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error adding note:", err);
    res.status(500).json({ error: "Error adding note" });
  }
});

/* =========================================================
   ✏️ UPDATE NOTE
   ========================================================= */
router.put("/:clientId/notas/:noteId", authenticate, async (req, res) => {
  const { clientId, noteId } = req.params;
  const { nota } = req.body;

  try {
    const { rows } = await pool.query(
      `
      UPDATE cliente_notas
      SET nota = $1, fecha = NOW()
      WHERE id = $2 AND cliente_id = $3
      RETURNING *`,
      [nota, noteId, clientId]
    );

    if (!rows.length)
      return res.status(404).json({ error: "Note not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error updating note:", err);
    res.status(500).json({ error: "Error updating note" });
  }
});

/* =========================================================
   ❌ DELETE NOTE
   ========================================================= */
router.delete("/:clientId/notas/:noteId", authenticate, async (req, res) => {
  const { clientId, noteId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM cliente_notas WHERE id = $1 AND cliente_id = $2 RETURNING id`,
      [noteId, clientId]
    );

    if (!result.rowCount)
      return res.status(404).json({ error: "Note not found" });

    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting note:", err);
    res.status(500).json({ error: "Error deleting note" });
  }
});

/* =========================================================
   📆 GET NOTES
   ========================================================= */
router.get("/:id/notas", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT n.*, u.fullname AS author_name
       FROM cliente_notas n
       LEFT JOIN users u ON n.author_id = u.id
       WHERE n.cliente_id = $1
       ORDER BY n.fecha DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching notes:", err);
    res.status(500).json({ error: "Error fetching notes" });
  }
});

/* =========================================================
   📅 GET EVENTS
   ========================================================= */
router.get("/:id/eventos", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT e.*, u.fullname AS author_name
       FROM cliente_eventos e
       LEFT JOIN users u ON e.author_id = u.id
       WHERE e.cliente_id = $1
       ORDER BY e.fecha DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    res.status(500).json({ error: "Error fetching events" });
  }
});

/* =========================================================
   🔹 GET CLIENT APPOINTMENTS (with note)
   ========================================================= */
router.get("/:id/appointments", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.date_time, a.address,
              a.status, a.note, a.created_at
       FROM appointments a
       WHERE a.client_id = $1
       ORDER BY a.date_time ASC NULLS LAST`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching client appointments:", err);
    res.status(500).json({ error: "Error fetching client appointments" });
  }
});

/* =========================================================
   🆕 CREATE APPOINTMENT FOR CLIENT (with note)
   ========================================================= */
router.post("/:id/appointments", authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, date_time, address, status, note } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO appointments (title, date_time, address, status, note, client_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        title,
        date_time,
        address,
        status || "pending",
        note || null,
        id,
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Error creating appointment for client:", err);
    res.status(500).json({ error: "Error creating appointment for client" });
  }
});

/* =========================================================
   🗑️ DELETE CLIENT
   ========================================================= */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    await pool.query("DELETE FROM clientes WHERE id = $1", [req.params.id]);
    res.json({ message: "Client deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting client:", err);
    res.status(500).json({ error: "Error deleting client" });
  }
});

export default router;
