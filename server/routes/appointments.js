import express from "express";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   🧭 GET ALL APPOINTMENTS (WITH CLIENT DATA)
   ========================================================= */
router.get("/", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, 
             c.fullname AS client_name,
             c.email AS client_email,
             c.phone AS client_phone,
             c.address AS client_address
      FROM appointments a
      LEFT JOIN clientes c ON a.client_id = c.id
      ORDER BY a.date_time ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error("❌ Error fetching appointments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   🧭 GET SINGLE APPOINTMENT (SHOWS ALL NOTES OF THAT CLIENT)
   ========================================================= */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 🧩 1. Obtener la cita + cliente
    const { rows } = await pool.query(
      `
      SELECT a.*, 
             c.fullname AS client_name,
             c.email AS client_email,
             c.phone AS client_phone,
             c.address AS client_address,
             c.case_number,
             c.priority
      FROM appointments a
      LEFT JOIN clientes c ON a.client_id = c.id
      WHERE a.id = $1
      `,
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Appointment not found" });

    const appointment = rows[0];

    // 🧩 2. Obtener TODAS las notas del cliente (sin distinguir citas)
    const { rows: notes } = await pool.query(
      `
      SELECT n.*, u.fullname AS author_name
      FROM cliente_notas n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.cliente_id = $1
      ORDER BY n.fecha DESC
      `,
      [appointment.client_id]
    );

    // 🧩 3. Enviar cita + todas las notas del cliente
    res.json({ ...appointment, notes });
  } catch (error) {
    console.error("❌ Error fetching appointment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   🆕 CREATE APPOINTMENT
   ========================================================= */
router.post("/", authenticate, async (req, res) => {
  const { title, date_time, address, status, client_id, note } = req.body;

  if (!title || !date_time)
    return res.status(400).json({ message: "Missing required fields" });

  const dt = new Date(date_time);
  if (Number.isNaN(dt.getTime()))
    return res.status(400).json({ message: "Invalid date format" });

  // Grace window to avoid false negatives from client/server clock drift
  const nowWithGrace = new Date(Date.now() - 60 * 1000);
  if (dt < nowWithGrace)
    return res.status(400).json({ message: "Cannot schedule in the past." });

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO appointments (title, date_time, address, status, created_by, client_id, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        title.trim(),
        date_time,
        address || null,
        status || "pending",
        req.user.id,
        client_id || null,
        note || null,
      ]
    );

    const appointment = rows[0];
    let enriched = { ...appointment };

    if (appointment.client_id) {
      const { rows: client } = await pool.query(
        `
        SELECT fullname AS client_name, email AS client_email, phone AS client_phone, address AS client_address 
        FROM clientes WHERE id = $1
        `,
        [appointment.client_id]
      );
      if (client.length) enriched = { ...appointment, ...client[0] };
    }

    res.status(201).json(enriched);
  } catch (error) {
    console.error("❌ Error creating appointment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   ✏️ UPDATE APPOINTMENT
   ========================================================= */
router.put("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, date_time, address, status, client_id, note } = req.body;

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      fields.push(`title=$${idx++}`);
      values.push(title);
    }
    if (date_time !== undefined) {
      fields.push(`date_time=$${idx++}`);
      values.push(date_time);
    }
    if (address !== undefined) {
      fields.push(`address=$${idx++}`);
      values.push(address);
    }
    if (status !== undefined) {
      fields.push(`status=$${idx++}`);
      values.push(status);
    }
    if (client_id !== undefined) {
      fields.push(`client_id=$${idx++}`);
      values.push(client_id);
    }
    if (note !== undefined) {
      fields.push(`note=$${idx++}`);
      values.push(note);
    }

    if (!fields.length)
      return res.status(400).json({ message: "No fields to update" });

    const query = `
      UPDATE appointments
      SET ${fields.join(", ")}, updated_at=NOW()
      WHERE id=$${idx}
      RETURNING *
      `;
    values.push(id);

    const { rows } = await pool.query(query, values);
    if (!rows.length)
      return res.status(404).json({ message: "Appointment not found" });

    const appointment = rows[0];

    if (status === "visited" && appointment.client_id) {
      await pool.query(
        `UPDATE clientes SET status='visited', updated_at=NOW() WHERE id=$1`,
        [appointment.client_id]
      );
    }

    // 🔁 Obtener TODAS las notas del cliente (para mantener consistencia)
    const { rows: notes } = await pool.query(
      `
      SELECT n.*, u.fullname AS author_name
      FROM cliente_notas n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.cliente_id = $1
      ORDER BY n.fecha DESC
      `,
      [appointment.client_id]
    );

    res.json({ ...appointment, notes });
  } catch (error) {
    console.error("❌ Error updating appointment:", error);
    res.status(500).json({ message: "Error updating appointment" });
  }
});

/* =========================================================
   🔄 CHANGE STATUS
   ========================================================= */
router.put("/:id/status", authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE appointments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Appointment not found" });

    const appointment = rows[0];

    if (status === "visited" && appointment.client_id) {
      await pool.query(
        `UPDATE clientes SET status='visited', updated_at=NOW() WHERE id=$1`,
        [appointment.client_id]
      );
    }

    // 🔁 También devuelve todas las notas del cliente
    const { rows: notes } = await pool.query(
      `
      SELECT n.*, u.fullname AS author_name
      FROM cliente_notas n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.cliente_id = $1
      ORDER BY n.fecha DESC
      `,
      [appointment.client_id]
    );

    res.json({ ...appointment, notes });
  } catch (error) {
    console.error("❌ Error changing status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   🗒️ ADD NOTE
   ========================================================= */
router.post("/:appointmentId/notes", authenticate, async (req, res) => {
  const { appointmentId } = req.params;
  const { nota } = req.body;

  try {
    // Guarda la nota asociada al cliente de esa cita (no solo a la cita)
    const { rows } = await pool.query(
      `
      INSERT INTO cliente_notas (cliente_id, appointment_id, author_id, nota, fecha)
      SELECT client_id, $1, $2, $3, NOW()
      FROM appointments
      WHERE id = $1
      RETURNING *
      `,
      [appointmentId, req.user.id, nota]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Error adding appointment note:", err);
    res.status(500).json({ error: "Error adding appointment note" });
  }
});

/* =========================================================
   🗑️ DELETE NOTE
   ========================================================= */
router.delete("/:appointmentId/notes/:noteId", authenticate, async (req, res) => {
  const { appointmentId, noteId } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM cliente_notas 
       WHERE appointment_id = $1 AND id = $2
       RETURNING id`,
      [appointmentId, noteId]
    );

    if (!result.rowCount)
      return res.status(404).json({ error: "Note not found" });

    res.json({ message: "Note deleted" });
  } catch (err) {
    console.error("❌ Error deleting appointment note:", err);
    res.status(500).json({ error: "Error deleting appointment note" });
  }
});

/* =========================================================
   ✏️ UPDATE NOTE
   ========================================================= */
router.put("/:appointmentId/notes/:noteId", authenticate, async (req, res) => {
  const { appointmentId, noteId } = req.params;
  const { nota } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cliente_notas 
       SET nota=$1, fecha=NOW() 
       WHERE id=$2 AND appointment_id=$3
       RETURNING *`,
      [nota, noteId, appointmentId]
    );
    if (!rows.length) return res.status(404).json({ error: "Note not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error updating note:", err);
    res.status(500).json({ error: "Error updating note" });
  }
});

/* =========================================================
   🗑️ DELETE APPOINTMENT
   ========================================================= */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM appointments WHERE id=$1", [id]);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting appointment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
