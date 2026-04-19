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

/* =========================================================
   FUNNEL DATA  (GET /api/dashboard/funnel?start=YYYY-MM-DD&end=YYYY-MM-DD)
   Returns pipeline step counts for the funnel visualization
   ========================================================= */
router.get("/funnel", authenticate, async (req, res) => {
  try {
    const startStr = typeof req.query.start === "string" ? req.query.start : null;
    const endStr   = typeof req.query.end   === "string" ? req.query.end   : null;

    const dateFilter = startStr && endStr
      ? `AND created_date_local BETWEEN $1::date AND $2::date`
      : "";
    const params = startStr && endStr ? [startStr, endStr] : [];

    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE TRUE ${dateFilter.replace(/AND /,"AND ")})            AS total,
        COUNT(*) FILTER (WHERE manual_classification IS NULL AND consulta IS DISTINCT FROM 'red' ${dateFilter})  AS unclassified,
        COUNT(*) FILTER (WHERE manual_classification = 'green' ${dateFilter})         AS green,
        COUNT(*) FILTER (WHERE manual_classification = 'yellow' ${dateFilter})        AS yellow,
        COUNT(*) FILTER (WHERE manual_classification = 'blue' ${dateFilter})          AS blue,
        COUNT(*) FILTER (WHERE consulta = 'red' ${dateFilter})                        AS resolved
      FROM houston_311_bcv
      ${params.length ? "" : ""}
    `;

    const { rows } = await pool.query(sql, params);
    const r = rows[0] || {};

    const funnel = [
      { key: "total",        label: "Total Leads",     value: Number(r.total        || 0) },
      { key: "unclassified", label: "Unclassified",    value: Number(r.unclassified || 0) },
      { key: "green",        label: "Active",          value: Number(r.green        || 0) },
      { key: "yellow",       label: "Pending Review",  value: Number(r.yellow       || 0) },
      { key: "blue",         label: "Follow-up",       value: Number(r.blue         || 0) },
    ];

    return res.json(funnel);
  } catch (err) {
    console.error("❌ Error fetching funnel data:", err);
    return res.status(500).json({ error: "Error fetching funnel data" });
  }
});

/* =========================================================
   TRENDS  (GET /api/dashboard/trends?year=YYYY)
   Monthly lead counts for a given year
   ========================================================= */
router.get("/trends", authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const sql = `
      SELECT
        EXTRACT(MONTH FROM created_date_local)::int AS month,
        COUNT(*) AS count
      FROM houston_311_bcv
      WHERE EXTRACT(YEAR FROM created_date_local) = $1
      GROUP BY month
      ORDER BY month ASC
    `;
    const { rows } = await pool.query(sql, [year]);
    // Fill all 12 months
    const filled = Array.from({ length: 12 }, (_, i) => {
      const found = rows.find(r => Number(r.month) === i + 1);
      return { month: i + 1, count: Number(found?.count || 0) };
    });
    return res.json(filled);
  } catch (err) {
    console.error("❌ Error fetching trends:", err);
    return res.status(500).json({ error: "Error fetching trends" });
  }
});

/* =========================================================
   MONTHLY REPORT  (GET /api/dashboard/monthly?year=YYYY&month=MM)
   Weekly breakdown for a given month
   ========================================================= */
router.get("/monthly", authenticate, async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate   = new Date(year, month, 0).toISOString().slice(0, 10);

    const sql = `
      SELECT
        CEIL(EXTRACT(DAY FROM created_date_local) / 7.0)::int AS week,
        COUNT(*) AS new_leads,
        COUNT(*) FILTER (WHERE manual_classification = 'green') AS green_classified,
        0 AS delivery_sent,
        0 AS appointments,
        0 AS visits,
        0 AS new_clients
      FROM houston_311_bcv
      WHERE created_date_local BETWEEN $1 AND $2
      GROUP BY week
      ORDER BY week ASC
    `;
    const { rows } = await pool.query(sql, [startDate, endDate]);

    const summary = {
      leads:    rows.reduce((s, r) => s + Number(r.new_leads), 0),
      green:    rows.reduce((s, r) => s + Number(r.green_classified), 0),
      delivery: 0, appts: 0, visits: 0, clients: 0,
      conv_pct: "0%",
    };

    return res.json({ label: `${year}-${month}`, summary, weeks: rows });
  } catch (err) {
    console.error("❌ Error fetching monthly:", err);
    return res.status(500).json({ error: "Error fetching monthly" });
  }
});

/* =========================================================
   ZIPCODE STATS  (GET /api/dashboard/zipcode-stats?start=&end=)
   Lead counts grouped by ZIP code
   ========================================================= */
router.get("/zipcode-stats", authenticate, async (req, res) => {
  try {
    const startStr = typeof req.query.start === "string" ? req.query.start : null;
    const endStr   = typeof req.query.end   === "string" ? req.query.end   : null;

    const params = startStr && endStr ? [startStr, endStr] : [];
    const dateFilter = params.length ? "WHERE created_date_local BETWEEN $1 AND $2" : "";

    const sql = `
      SELECT
        zip_code,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE manual_classification = 'green') AS green,
        COUNT(*) FILTER (WHERE manual_classification = 'yellow') AS yellow,
        COUNT(*) FILTER (WHERE manual_classification = 'blue') AS blue
      FROM houston_311_bcv
      ${dateFilter}
      GROUP BY zip_code
      ORDER BY total DESC
      LIMIT 20
    `;
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching zipcode stats:", err);
    return res.status(500).json({ error: "Error fetching zipcode stats" });
  }
});

/* =========================================================
   GREEN LEADS  (GET /api/dashboard/green-leads)
   Paginated green-classified leads
   ========================================================= */
router.get("/green-leads", authenticate, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === "string" ? req.query.search : "";

    const searchFilter = search ? `AND (incident_address ILIKE $3 OR case_number::text ILIKE $3)` : "";
    const params = search ? [limit, offset, `%${search}%`] : [limit, offset];

    const countSql = `
      SELECT COUNT(*) AS total FROM houston_311_bcv
      WHERE manual_classification = 'green' ${search ? `AND (incident_address ILIKE $1 OR case_number::text ILIKE $1)` : ""}
    `;
    const dataSql = `
      SELECT case_number, incident_address, status, created_date_local, description
      FROM houston_311_bcv
      WHERE manual_classification = 'green' ${searchFilter}
      ORDER BY created_date_local DESC
      LIMIT $1 OFFSET $2
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, search ? [`%${search}%`] : []),
      pool.query(dataSql, params),
    ]);

    return res.json({
      leads: dataRes.rows,
      total: Number(countRes.rows[0]?.total || 0),
      available: Number(countRes.rows[0]?.total || 0),
    });
  } catch (err) {
    console.error("❌ Error fetching green leads:", err);
    return res.status(500).json({ error: "Error fetching green leads" });
  }
});

export default router;
