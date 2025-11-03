//index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db.js';
import { authenticate } from './middleware/auth.js';

// Importar todas tus rutas
import authRoutes from './routes/auth.js';
import leadsRoutes from './routes/leads.js';
import routesRoutes from './routes/routes.js';
import settingsRouter from "./routes/settings.js";




const app = express();

// Middlewares
app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(express.json());

// Rutas Principales
app.use('/api/auth', authRoutes); 
app.use('/api/leads', leadsRoutes);
app.use('/api/routes', routesRoutes);
app.use("/api/settings", settingsRouter);

// Perfil del usuario autenticado
app.get("/api/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.id ?? req.user.userId; // compatibilidad
    if (!userId) return res.status(400).json({ error: "Invalid user payload" });

    const q = await pool.query(
      "SELECT id, fullname, email, phone, document_type, document_number, role FROM users WHERE id = $1",
      [userId]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ user: q.rows[0] });
  } catch (err) {
    console.error("Error en /api/me:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Ruta de prueba para verificar que el servidor está operativo
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Servidor CRM operativo" });
});

// Iniciar el servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);

  // Verificar la conexión a la base de datos al iniciar
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("🗓️  PostgreSQL activo:", result.rows[0].now);
  } catch (err) {
    console.error("⚠️  Error verificando conexión a la BD:", err.message);
  }
});
