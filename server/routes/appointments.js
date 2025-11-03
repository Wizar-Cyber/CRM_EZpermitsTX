import express from "express";
import pool from "../db.js";

const router = express.Router();

/* =========================================================
   🧭 GET ALL APPOINTMENTS (WITH CLIENT DATA)
   ========================================================= */
router.get("/", async (req, res) => {
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
   🧭 GET SINGLE APPOINTMENT
   ========================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
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
    `, [id]);

    if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error fetching appointment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   🆕 CREATE APPOINTMENT
   ========================================================= */
router.post("/", async (req, res) => {
  const { title, date_time, address, status, created_by, client_id, note } = req.body;

  if (!title || !date_time || !created_by)
    return res.status(400).json({ message: "Missing required fields" });

  const dt = new Date(date_time);
  if (dt < new Date())
    return res.status(400).json({ message: "Cannot schedule in the past." });

  try {
    const { rows } = await pool.query(`
      INSERT INTO appointments (title, date_time, address, status, created_by, client_id, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [title, date_time, address || null, status || "pending", created_by, client_id || null, note || null]);

    const appointment = rows[0];

    // Enriquecer con cliente
    let enriched = { ...appointment };
    if (appointment.client_id) {
      const { rows: client } = await pool.query(`
        SELECT fullname AS client_name, email AS client_email, phone AS client_phone, address AS client_address 
        FROM clientes WHERE id = $1
      `, [appointment.client_id]);
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
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, date_time, address, status, client_id, note } = req.body;

  try {
    const { rows } = await pool.query(`
      UPDATE appointments
      SET title=$1, date_time=$2, address=$3, status=$4, client_id=$5, note=$6, updated_at=NOW()
      WHERE id=$7
      RETURNING *
    `, [title, date_time, address, status || "pending", client_id || null, note || null, id]);

    if (!rows.length)
      return res.status(404).json({ message: "Appointment not found" });

    const appointment = rows[0];

    // Si se marcó como "visited", actualizar cliente
    if (status === "visited" && appointment.client_id) {
      await pool.query(`UPDATE clientes SET status='visited', updated_at=NOW() WHERE id=$1`, [appointment.client_id]);
    }

    res.json(appointment);
  } catch (error) {
    console.error("❌ Error updating appointment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   🔄 CHANGE STATUS (VISITED / COMPLETED)
   ========================================================= */
router.put("/:id/status", async (req, res) => {
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

    res.json(appointment);
  } catch (error) {
    console.error("❌ Error changing status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   🗑️ DELETE APPOINTMENT
   ========================================================= */
router.delete("/:id", async (req, res) => {
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
