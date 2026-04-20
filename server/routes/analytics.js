import express from "express";
import pool from "../db.js";

export const analyticsRouter = express.Router();

// Middleware de validación
const validateAnalyticsQuery = (req, res, next) => {
  const { date_from, date_to, quality, group_by } = req.query;

  if (date_from && isNaN(Date.parse(date_from))) {
    return res.status(400).json({ error: "Invalid date_from format" });
  }
  if (date_to && isNaN(Date.parse(date_to))) {
    return res.status(400).json({ error: "Invalid date_to format" });
  }
  if (group_by && !['day', 'month'].includes(group_by)) {
    return res.status(400).json({ error: "group_by must be 'day' or 'month'" });
  }

  next();
};

// GET /api/analytics/lead-quality
analyticsRouter.get("/lead-quality", validateAnalyticsQuery, async (req, res) => {
  try {
    const {
      date_from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      date_to = new Date().toISOString(),
      quality,
      group_by = 'day',
      view = 'overview' // overview, trends, geography, backlog, peaks
    } = req.query;

    // Map manual_classification to quality categories
    const qualityMap = {
      'green': 'Lead',
      'yellow': 'In Follow-up',
      'blue': 'Other',
      'red': 'Discarded'
    };

    const qualityFilter = quality ? quality.split(',').map(q => q.trim()) : null;

    let sql, params;

    if (view === 'overview') {
      // Pie chart data
      sql = `
        SELECT
          CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END AS quality,
          COUNT(*) AS count
        FROM houston_311_bcv l
        WHERE (
          (COALESCE(l.created_date_inspector, l.created_date_local) >= $1
            AND COALESCE(l.created_date_inspector, l.created_date_local) <= $2)
          OR (l.created_date_inspector IS NULL AND l.created_date_local IS NULL)
        )
        ${qualityFilter ? `AND CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END = ANY($3)` : ''}
        GROUP BY quality
        ORDER BY count DESC
      `;
      params = [date_from, date_to];
      if (qualityFilter) params.push(qualityFilter);

      const { rows } = await pool.query(sql, params);
      const total = rows.reduce((sum, row) => sum + parseInt(row.count), 0);

      res.json({
        view: 'overview',
        total,
        distribution: rows
      });

    } else if (view === 'trends') {
      // Trends over time
      sql = `
        SELECT
          DATE_TRUNC($3, COALESCE(l.created_date_inspector, l.created_date_local)) AS period,
          CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END AS quality,
          COUNT(*) AS count
        FROM houston_311_bcv l
        WHERE COALESCE(l.created_date_inspector, l.created_date_local) >= $1
          AND COALESCE(l.created_date_inspector, l.created_date_local) <= $2
          ${qualityFilter ? `AND CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END = ANY($4)` : ''}
        GROUP BY period, quality
        ORDER BY period DESC, count DESC
        LIMIT 1000
      `;
      params = [date_from, date_to, group_by];
      if (qualityFilter) params.push(qualityFilter);

      const { rows } = await pool.query(sql, params);
      res.json({
        view: 'trends',
        data: rows
      });

    } else if (view === 'geography') {
      // Geographic distribution
      sql = `
        SELECT
          COALESCE(NULLIF(TRIM(l.zip_code),''), 'N/A') AS zip_code,
          CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END AS quality,
          COUNT(*) AS count
        FROM houston_311_bcv l
        WHERE COALESCE(l.created_date_inspector, l.created_date_local) >= $1
          AND COALESCE(l.created_date_inspector, l.created_date_local) <= $2
          ${qualityFilter ? `AND CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END = ANY($3)` : ''}
        GROUP BY zip_code, quality
        ORDER BY count DESC
        LIMIT 500
      `;
      params = [date_from, date_to];
      if (qualityFilter) params.push(qualityFilter);

      const { rows } = await pool.query(sql, params);
      res.json({
        view: 'geography',
        data: rows
      });

    } else if (view === 'backlog') {
      // Backlog analysis
      sql = `
        SELECT
          COUNT(*) FILTER (WHERE l.manual_classification IS NULL) AS unclassified,
          COUNT(*) FILTER (WHERE l.manual_classification IS NOT NULL AND l.classified_at IS NULL) AS classified_no_date,
          AVG(EXTRACT(EPOCH FROM (COALESCE(l.classified_at, NOW()) - COALESCE(l.created_date_inspector, l.created_date_local))) / 86400) AS avg_classification_days,
          COUNT(*) FILTER (WHERE COALESCE(l.classified_at, NOW()) - COALESCE(l.created_date_inspector, l.created_date_local) > INTERVAL '7 days') AS delayed_classification
        FROM houston_311_bcv l
        WHERE COALESCE(l.created_date_inspector, l.created_date_local) >= $1
          AND COALESCE(l.created_date_inspector, l.created_date_local) <= $2
      `;
      params = [date_from, date_to];

      const { rows } = await pool.query(sql, params);
      res.json({
        view: 'backlog',
        metrics: rows[0]
      });

    } else if (view === 'peaks') {
      // Peak dates
      sql = `
        SELECT
          DATE_TRUNC('day', COALESCE(l.created_date_inspector, l.created_date_local)) AS date,
          CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END AS quality,
          COUNT(*) AS count
        FROM houston_311_bcv l
        WHERE COALESCE(l.created_date_inspector, l.created_date_local) >= $1
          AND COALESCE(l.created_date_inspector, l.created_date_local) <= $2
          ${qualityFilter ? `AND CASE
            WHEN l.manual_classification = 'green' THEN 'Lead'
            WHEN l.manual_classification = 'yellow' THEN 'In Follow-up'
            WHEN l.manual_classification = 'blue' THEN 'Other'
            WHEN l.manual_classification = 'red' OR l.consulta = 'red' THEN 'Discarded'
            ELSE 'Unclassified'
          END = ANY($3)` : ''}
        GROUP BY date, quality
        ORDER BY count DESC
        LIMIT 100
      `;
      params = [date_from, date_to];
      if (qualityFilter) params.push(qualityFilter);

      const { rows } = await pool.query(sql, params);
      res.json({
        view: 'peaks',
        data: rows
      });
    } else {
      return res.status(400).json({ error: "Invalid view parameter" });
    }
  } catch (err) {
    console.error("❌ /lead-quality:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default analyticsRouter;