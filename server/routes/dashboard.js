import express from "express";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   DASHBOARD METRICS  (GET /api/dashboard/metrics?start=YYYY-MM-DD&end=YYYY-MM-DD)
   - total_leads: houston_311_bcv con consulta != 'red' (incluye NULL, 'green')
   - new_leads:   houston_311_bcv.created_date_local en rango
   - leads_in_route: routes.created_at en rango
   - upcoming_appointments: appointments.date_time >= NOW()
   - completed_visits: appointments.status IN ('visited','done') en rango por date_time
   ========================================================= */
router.get("/metrics", authenticate, async (req, res) => {
  try {
    const startStr = typeof req.query.start === "string" ? req.query.start : null;
    const endStr = typeof req.query.end === "string" ? req.query.end : null;

    // Rango por defecto: últimos 30 días
    const useRange = !!(startStr && endStr);
    const rangeParams = useRange ? [startStr, endStr] : [];

    // 1) total_leads: consulta != 'red'
    let total_leads = 0;
    try {
      const q = `
        SELECT COUNT(*)::int AS c
        FROM houston_311_bcv
        WHERE consulta IS NULL OR consulta <> 'red'
      `;
      const r = await pool.query(q);
      total_leads = r.rows[0]?.c ?? 0;
    } catch {
      total_leads = 0;
    }

    // 2) new_leads: creados en rango (created_date_local)
    let new_leads = 0;
    try {
      const q = useRange
        ? `
          SELECT COUNT(*)::int AS c
          FROM houston_311_bcv
          WHERE created_date_local >= $1::date
            AND created_date_local < ($2::date + INTERVAL '1 day')
        `
        : `
          SELECT COUNT(*)::int AS c
          FROM houston_311_bcv
          WHERE created_date_local >= (NOW() - INTERVAL '30 days')
        `;
      const r = await pool.query(q, rangeParams);
      new_leads = r.rows[0]?.c ?? 0;
    } catch {
      new_leads = 0;
    }

    // 3) leads_in_route: routes.created_at en rango
    let leads_in_route = 0;
    try {
      const q = useRange
        ? `
          SELECT COUNT(*)::int AS c
          FROM routes
          WHERE created_at >= $1::date
            AND created_at < ($2::date + INTERVAL '1 day')
        `
        : `
          SELECT COUNT(*)::int AS c
          FROM routes
          WHERE created_at >= (NOW() - INTERVAL '30 days')
        `;
      const r = await pool.query(q, rangeParams);
      leads_in_route = r.rows[0]?.c ?? 0;
    } catch {
      leads_in_route = 0;
    }

    // 4) upcoming_appointments: futuros (date_time >= NOW())
    let upcoming_appointments = 0;
    try {
      const q = `
        SELECT COUNT(*)::int AS c
        FROM appointments
        WHERE date_time >= NOW()
      `;
      const r = await pool.query(q);
      upcoming_appointments = r.rows[0]?.c ?? 0;
    } catch {
      upcoming_appointments = 0;
    }

    // 5) completed_visits: en rango por date_time y status visited/done
    let completed_visits = 0;
    try {
      const q = useRange
        ? `
          SELECT COUNT(*)::int AS c
          FROM appointments
          WHERE status IN ('visited','done')
            AND date_time >= $1::date
            AND date_time < ($2::date + INTERVAL '1 day')
        `
        : `
          SELECT COUNT(*)::int AS c
          FROM appointments
          WHERE status IN ('visited','done')
            AND date_time >= (NOW() - INTERVAL '30 days')
        `;
      const r = await pool.query(q, rangeParams);
      completed_visits = r.rows[0]?.c ?? 0;
    } catch {
      completed_visits = 0;
    }

    return res.json({
      total_leads,
      new_leads,
      leads_in_route,
      upcoming_appointments,
      completed_visits,
    });
  } catch (err) {
    console.error("❌ Error fetching dashboard metrics:", err);
    return res.status(500).json({ error: "Error fetching dashboard metrics" });
  }
});

/* =========================================================
   DASHBOARD CHART DATA  (GET /api/dashboard/chart-data?start=YYYY-MM-DD&end=YYYY-MM-DD)
   - new_leads:              houston_311_bcv.created_date_local semanal
   - appointments_created:   appointments.created_at semanal
   - visits_completed:       appointments.date_time semanal (status visited/done)
   ========================================================= */
router.get("/chart-data", authenticate, async (req, res) => {
  try {
    const startStr = typeof req.query.start === "string" ? req.query.start : null;
    const endStr = typeof req.query.end === "string" ? req.query.end : null;

    const useRange = !!(startStr && endStr);
    const params = useRange ? [startStr, endStr] : [];

    const series = useRange
      ? `generate_series($1::date, $2::date, '1 week')`
      : `generate_series((NOW() - INTERVAL '12 weeks')::date, NOW()::date, '1 week')`;

    const sql = `
      WITH weeks AS (
        SELECT date_trunc('week', ${series}) AS week_start
      )
      SELECT
        to_char(week_start, 'Mon DD') AS label,

        /* Leads (houston_311_bcv) por semana de created_date_local */
        COALESCE((
          SELECT COUNT(*) FROM houston_311_bcv
          WHERE date_trunc('week', created_date_local) = week_start
        ), 0) AS new_leads,

        /* Appointments creadas por semana de created_at */
        COALESCE((
          SELECT COUNT(*) FROM appointments
          WHERE date_trunc('week', created_at) = week_start
        ), 0) AS appointments_created,

        /* Visitas completadas por semana de date_time */
        COALESCE((
          SELECT COUNT(*) FROM appointments
          WHERE status IN ('visited','done')
            AND date_trunc('week', date_time) = week_start
        ), 0) AS visits_completed

      FROM weeks
      ORDER BY week_start ASC;
    `;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching chart data:", err);
    return res.status(500).json({ error: "Error fetching chart data" });
  }
});

export default router;
