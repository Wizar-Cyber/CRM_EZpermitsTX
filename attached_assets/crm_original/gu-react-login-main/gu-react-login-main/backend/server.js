// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import leadsRoutes from "./routes/leads.js";
import routesRoutes from "./routes/routes.js";


dotenv.config();

import { pool } from "./db.js";
import authRoutes from "./routes/auth.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/leads", leadsRoutes);
app.use("/api/routes", routesRoutes);
// health
app.get("/health", (req, res) => res.json({ ok: true, time: new Date() }));

// test database connection
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/test-leads", async (req, res) => {
  try {
    const result = await pool.query("SELECT case_number, incident_address FROM houston_311_bcv LIMIT 5");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB test failed" });
  }
});


// auth routes
app.use("/api/auth", authRoutes);

// example protected route
import { authenticate } from "./middleware/auth.js";
app.get("/api/me", authenticate, async (req, res) => {
  const userId = req.user.id;
  const q = await pool.query("SELECT id, fullname, email, phone, document_type, document_number FROM users WHERE id = $1", [userId]);
  res.json({ user: q.rows[0] });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
