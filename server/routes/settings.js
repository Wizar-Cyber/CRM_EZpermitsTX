import express from "express";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// 🧩 Obtener configuración del usuario logueado
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id ?? req.user.userId;

    const result = await pool.query(
      "SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (result.rows.length === 0) {
      // Crear configuración por defecto si no existe
      const insert = await pool.query(
        `INSERT INTO user_settings (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
      );
      return res.json(insert.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🧩 Actualizar configuración
router.put("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id ?? req.user.userId;
    const { theme, email_notifications, sms_notifications, language } = req.body;

    const result = await pool.query(
      `UPDATE user_settings
       SET theme = COALESCE($1, theme),
           email_notifications = COALESCE($2, email_notifications),
           sms_notifications = COALESCE($3, sms_notifications),
           language = COALESCE($4, language),
           updated_at = NOW()
       WHERE user_id = $5
       RETURNING *`,
      [theme, email_notifications, sms_notifications, language, userId]
    );

    res.json({ success: true, settings: result.rows[0] });
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
