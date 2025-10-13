import express from "express";
import pool  from "../db.js";

export const router = express.Router();

// 📌 1. Crear ruta
router.post("/", async (req, res) => {
  try {
    const { name, created_by, points, route } = req.body;
    if (!name || !created_by || !points) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO routes (name, created_by, points, route)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, created_by, JSON.stringify(points), JSON.stringify(route || null)]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Error creating route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 2. Listar rutas
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, created_by, scheduled_on, created_at FROM routes ORDER BY created_at DESC"
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("Error fetching routes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 3. Ver detalles de una ruta
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM routes WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching route detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 4. Actualizar ruta
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, points, route } = req.body;

    const result = await pool.query(
      `UPDATE routes
       SET name = $1,
           points = $2,
           route = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, JSON.stringify(points), JSON.stringify(route || null), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Error updating route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 5. Eliminar ruta
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("DELETE FROM routes WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.json({ success: true, deleted: result.rows[0].id });
  } catch (err) {
    console.error("Error deleting route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router;