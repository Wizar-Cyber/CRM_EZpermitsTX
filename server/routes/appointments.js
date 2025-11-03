import express from "express";
import pool from "../db.js"; // o como tengas configurado tu cliente PostgreSQL
const router = express.Router();

// 🧭 Obtener todas las citas
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM appointments ORDER BY start_time ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("❌ Error obteniendo citas:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 🆕 Crear nueva cita
router.post("/", async (req, res) => {
  const { title, start_time, end_time, address, status, created_by } = req.body;
  if (!title || !start_time || !end_time || !created_by)
    return res.status(400).json({ message: "Missing required fields" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO appointments (title, start_time, end_time, address, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, start_time, end_time, address, status, created_by]
    );
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error creando cita:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✏️ Actualizar cita existente
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, start_time, end_time, address, status } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE appointments
       SET title=$1, start_time=$2, end_time=$3, address=$4, status=$5, updated_at=now()
       WHERE id=$6 RETURNING *`,
      [title, start_time, end_time, address, status, id]
    );
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error actualizando cita:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 🗑️ Eliminar cita
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM appointments WHERE id=$1", [id]);
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("❌ Error eliminando cita:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
