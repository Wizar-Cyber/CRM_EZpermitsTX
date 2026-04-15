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
import leadStatesRoutes from './routes/leadStates.js';
import settingsRouter from "./routes/settings.js";
import clientesRouter from "./routes/clientes.js";
import appointmentsRouter from "./routes/appointments.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRouter from "./routes/admin.js";

import orsRouter from "./routes/ors.js";

const SECOND_ATTEMPT_DAYS = Number.parseInt(process.env.SECOND_ATTEMPT_DAYS || "15", 10);



const app = express();

// Middlewares
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://69.62.69.98:8081",
];

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || defaultAllowedOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite llamadas server-to-server o herramientas sin origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());

// ==================== ARCHIVOS ESTÁTICOS ====================
// Servir archivos del cliente compilado con Vite
const clientDistPath = process.env.CLIENT_DIST_PATH || new URL('../client/dist', import.meta.url).pathname;

// Middleware para assets compilados (con hash) - pueden cachearse por mucho tiempo
app.use('/assets', express.static(
  new URL('../client/dist/assets', import.meta.url).pathname,
  {
    maxAge: '1y', // Assets con hash pueden cachearse un año
    etag: false,
    lastModified: false
  }
));

// Servir archivos estáticos públicos
app.use('/', express.static(
  new URL('../client/public', import.meta.url).pathname,
  {
    maxAge: '1d', // 1 día para recursos públicos
    setHeaders: (res, path) => {
      // No cachear archivos HTML
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }
));

// Servir el index.html para todas las rutas que no son API
// (para que react-router funcione)
app.get('*', (req, res, next) => {
  // Si es una ruta API, dejar que continúe
  if (req.path.startsWith('/api/')) return next();

  // Servir index.html con headers que previenen caché
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(new URL('../client/dist/index.html', import.meta.url).pathname, (err) => {
    if (err) {
      // Si no existe index.html, pasar al siguiente middleware
      next();
    }
  });
});
app.use('/api/auth', authRoutes); 
app.use('/api/leads', leadsRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/lead-states', leadStatesRoutes);
app.use("/api/settings", settingsRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/clients", clientesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRouter);
app.use("/api/ors", orsRouter);

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

  // 🕒 Tarea periódica: promover a SECOND_ATTEMPT los casos vencidos
  const sweepSecondAttempts = async () => {
    try {
      const due = await pool.query(
        `SELECT case_number, assigned_route_id, current_state
           FROM houston_311_bcv
          WHERE contacted_at IS NULL
            AND current_state IN ('IN_DELIVERY', 'NO_RESPONSE')
            AND (
              (second_attempt_due_at IS NOT NULL AND second_attempt_due_at <= NOW())
              OR
              (second_attempt_due_at IS NULL AND sent_to_delivery_date IS NOT NULL AND sent_to_delivery_date <= NOW() - ($1::int * interval '1 day'))
            )`,
        [SECOND_ATTEMPT_DAYS]
      );

      if (!due.rows.length) return;

      const caseNumbers = due.rows.map((r) => r.case_number);

      await pool.query(
        `UPDATE houston_311_bcv
            SET current_state = 'SECOND_ATTEMPT',
                second_attempt_sent_at = NOW(),
                publicity_attempts = COALESCE(publicity_attempts, 0) + 1,
                updated_at = NOW()
          WHERE case_number = ANY($1::text[])`,
        [caseNumbers]
      );

      const auditPromises = due.rows.map((row) =>
        pool.query(
          `INSERT INTO lead_audit_trail
             (case_number, previous_state, new_state, changed_by, change_reason, meta)
           VALUES ($1, $2, $3, $4, $5, $6)`
          , [
            row.case_number,
            row.current_state || null,
            'SECOND_ATTEMPT',
            'system-cron',
            `Auto second attempt after ${SECOND_ATTEMPT_DAYS}d`,
            JSON.stringify({ route_id: row.assigned_route_id || null, second_attempt_days: SECOND_ATTEMPT_DAYS })
          ]
        )
      );
      await Promise.all(auditPromises);

      console.log(`🔁 SECOND_ATTEMPT aplicado a ${caseNumbers.length} casos`);
    } catch (err) {
      console.error('⚠️  Error en sweepSecondAttempts:', err.message);
    }
  };

  // Corre al inicio y luego cada hora
  sweepSecondAttempts();
  setInterval(sweepSecondAttempts, 60 * 60 * 1000);
});
