// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";

// 🔹 Routers
import { leadsRouter } from "./routes/leads.js"; // 👈 nuevo formato export
import routesRouter from "./routes/routes.js";
import authRoutes from "./routes/auth.js";
import { authenticate } from "./middleware/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Montar routers principales
app.use("/api/leads", leadsRouter);
app.use("/api/routes", routesRouter);
app.use("/api/auth", authRoutes);

// 🔹 Healthcheck
app.get("/health", (req, res) => res.json({ ok: true, time: new Date() }));

// 🔹 Test conexión base de datos
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 Test de lectura de leads
app.get("/api/test-leads", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT case_number, incident_address FROM houston_311_bcv LIMIT 5"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB test failed" });
  }
});

// 🔹 Ruta protegida (requiere auth middleware)
app.get("/api/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await pool.query(
      "SELECT id, fullname, email, phone, document_type, document_number FROM users WHERE id = $1",
      [userId]
    );
    res.json({ user: q.rows[0] });
  } catch (err) {
    console.error("Error en /api/me:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// 🔹 Inicio del servidor
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
