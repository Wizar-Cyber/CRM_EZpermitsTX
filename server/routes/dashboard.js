import express from "express";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

const VALID_CLASSIFICATIONS = new Set(["all", "green", "yellow", "blue", "red", "unclassified"]);

const parseDateOr = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
};

const toYmd = (d) => d.toISOString().slice(0, 10);

const normalizeStateFilter = (value) => {
  if (!value || String(value).toLowerCase() === "all") return null;
  return String(value).toUpperCase().trim();
};

const normalizeClassificationFilter = (value) => {
  const normalized = String(value || "all").toLowerCase().trim();
  return VALID_CLASSIFICATIONS.has(normalized) ? normalized : "all";
};

const SLA_STUCK_DELIVERY_DAYS = Number.parseInt(process.env.SLA_STUCK_DELIVERY_DAYS || "3", 10);

/* =========================================================
   DASHBOARD V2 METRICS  (GET /api/dashboard/v2)
   query:
   - start=YYYY-MM-DD
   - end=YYYY-MM-DD
   - classification=all|green|yellow|blue|red|unclassified
   - state=all|NEW|CLASSIFIED|IN_DELIVERY|CONTACTED|NO_RESPONSE|SECOND_ATTEMPT|CLOSED
   ========================================================= */
router.get("/v2", authenticate, async (req, res) => {
  try {
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const startDate = parseDateOr(req.query.start, defaultStart);
    const endDate = parseDateOr(req.query.end, today);

    const start = toYmd(startDate <= endDate ? startDate : endDate);
    const end = toYmd(startDate <= endDate ? endDate : startDate);

    const classification = normalizeClassificationFilter(req.query.classification);
    const state = normalizeStateFilter(req.query.state);

    const params = [start, end, classification, state];

    const baseCte = `
      WITH filtered_leads AS (
        SELECT
          l.*,
          CASE
            WHEN l.consulta = 'red' THEN 'red'
            WHEN LOWER(COALESCE(l.manual_classification, '')) IN ('green', 'yellow', 'blue')
              THEN LOWER(l.manual_classification)
            ELSE 'unclassified'
          END AS quality_bucket
        FROM houston_311_bcv l
        WHERE ($4::text IS NULL OR UPPER(COALESCE(l.current_state, 'NEW')) = $4::text)
          AND (
            $3::text = 'all'
            OR ($3::text = 'red' AND l.consulta = 'red')
            OR ($3::text = 'green' AND LOWER(COALESCE(l.manual_classification, '')) = 'green')
            OR ($3::text = 'yellow' AND LOWER(COALESCE(l.manual_classification, '')) = 'yellow')
            OR ($3::text = 'blue' AND LOWER(COALESCE(l.manual_classification, '')) = 'blue')
            OR ($3::text = 'unclassified' AND l.consulta IS DISTINCT FROM 'red' AND LOWER(COALESCE(l.manual_classification, '')) NOT IN ('green','yellow','blue'))
          )
      ),
      period_leads AS (
        SELECT *
        FROM filtered_leads
        WHERE created_date_local >= $1::date
          AND created_date_local < ($2::date + INTERVAL '1 day')
      )
    `;

    const overviewSql = `${baseCte}
      SELECT
        (SELECT COUNT(*)::int FROM filtered_leads) AS total_leads,
        (SELECT COUNT(*)::int FROM period_leads) AS new_leads,
        (SELECT COUNT(*)::int FROM filtered_leads WHERE quality_bucket = 'red') AS discarded_leads,
        (SELECT COUNT(*)::int FROM filtered_leads WHERE COALESCE(current_state, 'NEW') IN ('IN_DELIVERY','SECOND_ATTEMPT')) AS in_delivery_pipeline,
        (SELECT COUNT(*)::int FROM filtered_leads WHERE COALESCE(current_state, 'NEW') = 'CONTACTED') AS contacted_leads,
        (SELECT COUNT(*)::int FROM filtered_leads WHERE COALESCE(current_state, 'NEW') = 'CLOSED') AS closed_leads,
        (SELECT COUNT(*)::int FROM clientes c
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE c.archived = false) AS total_clients,
        (SELECT COUNT(*)::int FROM clientes c
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE c.archived = false
           AND c.created_at >= $1::date
           AND c.created_at < ($2::date + INTERVAL '1 day')) AS clients_created_period
    `;

    const funnelSql = `${baseCte}
      SELECT
        (SELECT COUNT(*)::int FROM period_leads) AS captured,
        (SELECT COUNT(*)::int FROM period_leads WHERE quality_bucket IN ('green','yellow','blue')) AS qualified,
        (SELECT COUNT(*)::int FROM filtered_leads WHERE sent_to_delivery_date >= $1::date AND sent_to_delivery_date < ($2::date + INTERVAL '1 day')) AS routed,
        (SELECT COUNT(*)::int FROM filtered_leads WHERE contacted_at >= $1::date AND contacted_at < ($2::date + INTERVAL '1 day')) AS contacted,
        (SELECT COUNT(*)::int FROM clientes c
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE c.archived = false
           AND c.created_at >= $1::date
           AND c.created_at < ($2::date + INTERVAL '1 day')) AS clients,
        (SELECT COUNT(*)::int FROM appointments a
          INNER JOIN clientes c ON c.id = a.client_id
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE a.created_at >= $1::date
           AND a.created_at < ($2::date + INTERVAL '1 day')) AS appointments,
        (SELECT COUNT(*)::int FROM appointments a
          INNER JOIN clientes c ON c.id = a.client_id
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE a.status IN ('visited','done')
           AND a.date_time >= $1::date
           AND a.date_time < ($2::date + INTERVAL '1 day')) AS visits_completed
    `;

    const qualitySql = `${baseCte}
      SELECT quality_bucket, COUNT(*)::int AS value
      FROM filtered_leads
      GROUP BY quality_bucket
      ORDER BY quality_bucket
    `;

    const statesSql = `${baseCte}
      SELECT COALESCE(current_state, 'NEW') AS state, COUNT(*)::int AS value
      FROM filtered_leads
      GROUP BY COALESCE(current_state, 'NEW')
      ORDER BY value DESC
    `;

    const deliverySql = `${baseCte}
      SELECT
        (SELECT COUNT(*)::int FROM filtered_leads WHERE COALESCE(current_state,'NEW') = 'IN_DELIVERY') AS currently_in_delivery,
        (SELECT COUNT(*)::int FROM filtered_leads
          WHERE COALESCE(current_state,'NEW') IN ('IN_DELIVERY','SECOND_ATTEMPT')
            AND contacted_at IS NULL
            AND second_attempt_due_at IS NOT NULL
            AND second_attempt_due_at <= NOW()) AS second_attempt_due,
        (SELECT ROUND(COALESCE(AVG(NULLIF(delivery_attempts,0)),0)::numeric, 2) FROM filtered_leads) AS avg_delivery_attempts,
          (SELECT COUNT(*)::int FROM filtered_leads WHERE COALESCE(current_state,'NEW') = 'IN_DELIVERY' AND COALESCE(delivery_attempts,0) >= 2) AS re_sent_count,
        (SELECT COUNT(*)::int FROM filtered_leads WHERE COALESCE(current_state,'NEW') = 'SECOND_ATTEMPT') AS second_attempt_count
    `;

    const appointmentsSql = `${baseCte}
      SELECT
        (SELECT COUNT(*)::int FROM appointments a
          INNER JOIN clientes c ON c.id = a.client_id
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE a.date_time >= NOW()) AS upcoming,
        (SELECT COUNT(*)::int FROM appointments a
          INNER JOIN clientes c ON c.id = a.client_id
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE a.status IN ('visited','done')
           AND a.date_time >= $1::date
           AND a.date_time < ($2::date + INTERVAL '1 day')) AS completed_period,
        (SELECT COUNT(*)::int FROM appointments a
          INNER JOIN clientes c ON c.id = a.client_id
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
         WHERE a.created_at >= $1::date
           AND a.created_at < ($2::date + INTERVAL '1 day')) AS created_period
    `;

    const rankingsSql = `${baseCte}
      SELECT
        COALESCE(r.assigned_provider, 'unassigned') AS provider,
        r.created_by,
        r.id AS route_id,
        r.name AS route_name,
        COUNT(DISTINCT l.case_number)::int AS leads_assigned,
        COUNT(DISTINCT CASE WHEN l.contacted_at IS NOT NULL THEN l.case_number END)::int AS contacted,
        COUNT(DISTINCT CASE WHEN COALESCE(l.current_state, 'NEW') = 'IN_DELIVERY' AND COALESCE(l.delivery_attempts,0) >= 2 THEN l.case_number END)::int AS re_sent,
        ROUND(
          CASE WHEN COUNT(DISTINCT l.case_number) = 0 THEN 0
               ELSE (COUNT(DISTINCT CASE WHEN l.contacted_at IS NOT NULL THEN l.case_number END)::numeric / COUNT(DISTINCT l.case_number)::numeric) * 100
          END,
          2
        ) AS contact_rate
      FROM routes r
      LEFT JOIN filtered_leads l ON l.assigned_route_id = r.id
      WHERE r.created_at >= $1::date
        AND r.created_at < ($2::date + INTERVAL '1 day')
      GROUP BY r.id, r.name, r.created_by, COALESCE(r.assigned_provider, 'unassigned')
      ORDER BY contact_rate DESC, leads_assigned DESC
      LIMIT 15
    `;

    const alertsSql = `${baseCte}
      SELECT
        (SELECT COUNT(*)::int
           FROM filtered_leads fl
          WHERE COALESCE(fl.current_state, 'NEW') IN ('IN_DELIVERY', 'SECOND_ATTEMPT')
            AND fl.contacted_at IS NULL
            AND fl.second_attempt_due_at IS NOT NULL
            AND fl.second_attempt_due_at <= NOW()) AS overdue_second_attempt,

        (SELECT COUNT(*)::int
           FROM filtered_leads fl
          WHERE COALESCE(fl.current_state, 'NEW') = 'IN_DELIVERY'
            AND fl.contacted_at IS NULL
            AND fl.sent_to_delivery_date IS NOT NULL
            AND fl.sent_to_delivery_date <= NOW() - ($5::int * interval '1 day')) AS stuck_in_delivery,

        (SELECT COUNT(*)::int
           FROM filtered_leads fl
          WHERE COALESCE(fl.current_state, 'NEW') = 'IN_DELIVERY'
            AND COALESCE(fl.delivery_attempts,0) >= 2) AS total_re_sent
    `;

    const rangeDays = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const bucketGranularity = rangeDays <= 93 ? "day" : rangeDays <= 270 ? "week" : "month";

    const stepExpr =
      bucketGranularity === "day"
        ? "'1 day'"
        : bucketGranularity === "week"
          ? "'1 week'"
          : "'1 month'";

    const truncExpr =
      bucketGranularity === "day"
        ? "'day'"
        : bucketGranularity === "week"
          ? "'week'"
          : "'month'";

    const labelExpr =
      bucketGranularity === "day"
        ? "'YYYY-MM-DD'"
        : bucketGranularity === "week"
          ? "'IYYY-\"W\"IW'"
          : "'YYYY-MM'";

    const timeSeriesSql = `${baseCte},
      buckets AS (
        SELECT date_trunc(${truncExpr}, generate_series($1::date, $2::date, ${stepExpr})) AS bucket
      )
      SELECT
        to_char(bucket, ${labelExpr}) AS label,
        COALESCE((
          SELECT COUNT(*) FROM period_leads pl
          WHERE date_trunc(${truncExpr}, pl.created_date_local) = bucket
        ), 0)::int AS new_leads,
        COALESCE((
          SELECT COUNT(*) FROM filtered_leads fl
          WHERE fl.sent_to_delivery_date IS NOT NULL
            AND fl.sent_to_delivery_date >= $1::date
            AND fl.sent_to_delivery_date < ($2::date + INTERVAL '1 day')
            AND date_trunc(${truncExpr}, fl.sent_to_delivery_date) = bucket
        ), 0)::int AS routed,
        COALESCE((
          SELECT COUNT(*) FROM filtered_leads fl
          WHERE fl.contacted_at IS NOT NULL
            AND fl.contacted_at >= $1::date
            AND fl.contacted_at < ($2::date + INTERVAL '1 day')
            AND date_trunc(${truncExpr}, fl.contacted_at) = bucket
        ), 0)::int AS contacted,
        COALESCE((
          SELECT COUNT(*) FROM clientes c
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
          WHERE c.created_at >= $1::date
            AND c.created_at < ($2::date + INTERVAL '1 day')
            AND date_trunc(${truncExpr}, c.created_at) = bucket
        ), 0)::int AS clients,
        COALESCE((
          SELECT COUNT(*) FROM appointments a
          INNER JOIN clientes c ON c.id = a.client_id
          INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
          WHERE a.status IN ('visited','done')
            AND a.date_time >= $1::date
            AND a.date_time < ($2::date + INTERVAL '1 day')
            AND date_trunc(${truncExpr}, a.date_time) = bucket
        ), 0)::int AS visits_completed
      FROM buckets
      ORDER BY bucket ASC
    `;

    const [
      overviewRes,
      funnelRes,
      qualityRes,
      statesRes,
      deliveryRes,
      appointmentsRes,
      timeSeriesRes,
      rankingsRes,
      alertsRes,
    ] = await Promise.all([
      pool.query(overviewSql, params),
      pool.query(funnelSql, params),
      pool.query(qualitySql, params),
      pool.query(statesSql, params),
      pool.query(deliverySql, params),
      pool.query(appointmentsSql, params),
      pool.query(timeSeriesSql, params),
      pool.query(rankingsSql, params),
      pool.query(alertsSql, [...params, SLA_STUCK_DELIVERY_DAYS]),
    ]);

    const overview = overviewRes.rows[0] || {};
    const funnel = funnelRes.rows[0] || {};
    const delivery = deliveryRes.rows[0] || {};
    const appointments = appointmentsRes.rows[0] || {};
    const alertsRaw = alertsRes.rows[0] || {};

    const safeRatio = (num, den) => {
      const n = Number(num || 0);
      const d = Number(den || 0);
      if (!d) return 0;
      return Number(((n / d) * 100).toFixed(2));
    };

    const conversion = {
      lead_to_client_rate: safeRatio(funnel.clients, funnel.captured),
      routed_to_contacted_rate: safeRatio(funnel.contacted, funnel.routed),
      client_to_appointment_rate: safeRatio(funnel.appointments, funnel.clients),
      appointment_to_visit_rate: safeRatio(funnel.visits_completed, funnel.appointments),
    };

    const alerts = [
      {
        key: "overdue_second_attempt",
        severity: Number(alertsRaw.overdue_second_attempt || 0) > 0 ? "high" : "low",
        title: "Second attempt overdue",
        count: Number(alertsRaw.overdue_second_attempt || 0),
        description: "Cases that already reached due date and still have no contact.",
      },
      {
        key: "stuck_in_delivery",
        severity: Number(alertsRaw.stuck_in_delivery || 0) > 0 ? "medium" : "low",
        title: `Stuck in delivery (+${SLA_STUCK_DELIVERY_DAYS}d)`,
        count: Number(alertsRaw.stuck_in_delivery || 0),
        description: "Cases in delivery beyond SLA window without contact result.",
      },
      {
        key: "re_sent_in_delivery",
        severity: Number(alertsRaw.total_re_sent || 0) > 0 ? "medium" : "low",
        title: "Re-sent to delivery",
        count: Number(alertsRaw.total_re_sent || 0),
        description: "Cases sent again to delivery (delivery_attempts >= 2).",
      },
    ];

    return res.json({
      range: { start, end, days: rangeDays, granularity: bucketGranularity },
      filters: { classification, state: state || "all" },
      overview,
      funnel,
      conversion,
      delivery,
      appointments,
      rankings: {
        routes: rankingsRes.rows,
      },
      alerts,
      breakdowns: {
        quality: qualityRes.rows,
        states: statesRes.rows,
      },
      timeseries: timeSeriesRes.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching dashboard v2 metrics:", err);
    return res.status(500).json({ error: "Error fetching dashboard v2 metrics" });
  }
});

/* =========================================================
   DASHBOARD V2 DRILLDOWN (GET /api/dashboard/v2/drilldown)
   query:
  - metric=captured|qualified|routed|contacted|clients|appointments|visits_completed|overdue_second_attempt|stuck_in_delivery|re_sent_in_delivery
   - start=YYYY-MM-DD
   - end=YYYY-MM-DD
   - classification=all|green|yellow|blue|red|unclassified
   - state=all|...
   ========================================================= */
router.get("/v2/drilldown", authenticate, async (req, res) => {
  try {
    const metric = String(req.query.metric || "").trim();

    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const startDate = parseDateOr(req.query.start, defaultStart);
    const endDate = parseDateOr(req.query.end, today);
    const start = toYmd(startDate <= endDate ? startDate : endDate);
    const end = toYmd(startDate <= endDate ? endDate : startDate);
    const classification = normalizeClassificationFilter(req.query.classification);
    const state = normalizeStateFilter(req.query.state);

    const params = [start, end, classification, state, SLA_STUCK_DELIVERY_DAYS];

    const baseCte = `
      WITH typed_params AS (
        SELECT
          $1::date AS start_date,
          $2::date AS end_date,
          $3::text AS classification_filter,
          $4::text AS state_filter,
          $5::int AS sla_days
      ),
      filtered_leads AS (
        SELECT
          l.*,
          CASE
            WHEN l.consulta = 'red' THEN 'red'
            WHEN LOWER(COALESCE(l.manual_classification, '')) IN ('green', 'yellow', 'blue')
              THEN LOWER(l.manual_classification)
            ELSE 'unclassified'
          END AS quality_bucket
        FROM houston_311_bcv l
        CROSS JOIN typed_params p
        WHERE (p.state_filter IS NULL OR UPPER(COALESCE(l.current_state, 'NEW')) = p.state_filter)
          AND (
            p.classification_filter = 'all'
            OR (p.classification_filter = 'red' AND l.consulta = 'red')
            OR (p.classification_filter = 'green' AND LOWER(COALESCE(l.manual_classification, '')) = 'green')
            OR (p.classification_filter = 'yellow' AND LOWER(COALESCE(l.manual_classification, '')) = 'yellow')
            OR (p.classification_filter = 'blue' AND LOWER(COALESCE(l.manual_classification, '')) = 'blue')
            OR (p.classification_filter = 'unclassified' AND l.consulta IS DISTINCT FROM 'red' AND LOWER(COALESCE(l.manual_classification, '')) NOT IN ('green','yellow','blue'))
          )
      )
    `;

    let sql = "";
    let label = metric;

    if (metric === "captured") {
      label = "Captured Leads";
      sql = `${baseCte}
        SELECT case_number, incident_address, COALESCE(current_state, 'NEW') AS current_state, created_date_local AS event_date
        FROM filtered_leads
        WHERE created_date_local >= $1::date
          AND created_date_local < ($2::date + INTERVAL '1 day')
        ORDER BY created_date_local DESC NULLS LAST
        LIMIT 500`;
    } else if (metric === "qualified") {
      label = "Qualified Leads";
      sql = `${baseCte}
        SELECT case_number, incident_address, COALESCE(current_state, 'NEW') AS current_state, created_date_local AS event_date
        FROM filtered_leads
        WHERE quality_bucket IN ('green','yellow','blue')
          AND created_date_local >= $1::date
          AND created_date_local < ($2::date + INTERVAL '1 day')
        ORDER BY created_date_local DESC NULLS LAST
        LIMIT 500`;
    } else if (metric === "routed") {
      label = "Routed Leads";
      sql = `${baseCte}
        SELECT case_number, incident_address, COALESCE(current_state, 'NEW') AS current_state, sent_to_delivery_date AS event_date
        FROM filtered_leads
        WHERE sent_to_delivery_date >= $1::date
          AND sent_to_delivery_date < ($2::date + INTERVAL '1 day')
        ORDER BY sent_to_delivery_date DESC NULLS LAST
        LIMIT 500`;
    } else if (metric === "contacted") {
      label = "Contacted Leads";
      sql = `${baseCte}
        SELECT case_number, incident_address, COALESCE(current_state, 'NEW') AS current_state, contacted_at AS event_date
        FROM filtered_leads
        WHERE contacted_at >= $1::date
          AND contacted_at < ($2::date + INTERVAL '1 day')
        ORDER BY contacted_at DESC NULLS LAST
        LIMIT 500`;
    } else if (metric === "clients") {
      label = "Converted Clients";
      sql = `${baseCte}
        SELECT
          fl.case_number,
          fl.incident_address,
          COALESCE(fl.current_state, 'NEW') AS current_state,
          c.created_at AS event_date,
          c.id AS client_id,
          c.fullname AS client_name,
          c.status AS client_status
        FROM clientes c
        INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
        WHERE c.archived = false
          AND c.created_at >= $1::date
          AND c.created_at < ($2::date + INTERVAL '1 day')
        ORDER BY c.created_at DESC NULLS LAST
        LIMIT 500`;
    } else if (metric === "appointments") {
      label = "Appointments Created";
      sql = `${baseCte}
        SELECT
          fl.case_number,
          fl.incident_address,
          COALESCE(fl.current_state, 'NEW') AS current_state,
          a.created_at AS event_date,
          a.id AS appointment_id,
          a.status AS appointment_status,
          a.title AS appointment_title
        FROM appointments a
        INNER JOIN clientes c ON c.id = a.client_id
        INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
        WHERE a.created_at >= $1::date
          AND a.created_at < ($2::date + INTERVAL '1 day')
        ORDER BY a.created_at DESC NULLS LAST
        LIMIT 500`;
    } else if (metric === "visits_completed") {
      label = "Visits Completed";
      sql = `${baseCte}
        SELECT
          fl.case_number,
          fl.incident_address,
          COALESCE(fl.current_state, 'NEW') AS current_state,
          a.date_time AS event_date,
          a.id AS appointment_id,
          a.status AS appointment_status,
          a.title AS appointment_title
        FROM appointments a
        INNER JOIN clientes c ON c.id = a.client_id
        INNER JOIN filtered_leads fl ON fl.case_number = c.case_number
        WHERE a.status IN ('visited','done')
          AND a.date_time >= $1::date
          AND a.date_time < ($2::date + INTERVAL '1 day')
        ORDER BY a.date_time DESC NULLS LAST
        LIMIT 500`;
    } else if (metric === "overdue_second_attempt") {
      label = "Second Attempt Overdue";
      sql = `${baseCte}
        SELECT
          case_number,
          incident_address,
          COALESCE(current_state, 'NEW') AS current_state,
          second_attempt_due_at AS event_date,
          delivery_attempts,
          publicity_attempts
        FROM filtered_leads
        WHERE COALESCE(current_state, 'NEW') IN ('IN_DELIVERY','SECOND_ATTEMPT')
          AND contacted_at IS NULL
          AND second_attempt_due_at IS NOT NULL
          AND second_attempt_due_at <= NOW()
        ORDER BY second_attempt_due_at ASC
        LIMIT 500`;
    } else if (metric === "stuck_in_delivery") {
      label = "Stuck in Delivery";
      sql = `${baseCte}
        SELECT
          case_number,
          incident_address,
          COALESCE(current_state, 'NEW') AS current_state,
          sent_to_delivery_date AS event_date,
          delivery_attempts
        FROM filtered_leads
        WHERE COALESCE(current_state, 'NEW') = 'IN_DELIVERY'
          AND contacted_at IS NULL
          AND sent_to_delivery_date IS NOT NULL
          AND sent_to_delivery_date <= NOW() - ($5::int * interval '1 day')
        ORDER BY sent_to_delivery_date ASC
        LIMIT 500`;
    } else if (metric === "re_sent_in_delivery") {
      label = "Re-sent to Delivery";
      sql = `${baseCte}
        SELECT
          case_number,
          incident_address,
          COALESCE(current_state, 'NEW') AS current_state,
          sent_to_delivery_date AS event_date,
          delivery_attempts,
          second_attempt_due_at
        FROM filtered_leads
        WHERE COALESCE(current_state, 'NEW') = 'IN_DELIVERY'
          AND COALESCE(delivery_attempts,0) >= 2
        ORDER BY sent_to_delivery_date DESC NULLS LAST
        LIMIT 500`;
    } else {
      return res.status(400).json({ error: "Invalid drilldown metric" });
    }

    const result = await pool.query(sql, params);

    return res.json({
      metric,
      label,
      range: { start, end },
      filters: { classification, state: state || "all" },
      count: result.rows.length,
      rows: result.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching dashboard v2 drilldown:", err);
    return res.status(500).json({ error: "Error fetching dashboard v2 drilldown" });
  }
});

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
