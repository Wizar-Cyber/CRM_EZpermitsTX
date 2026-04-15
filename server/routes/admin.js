// routes/admin.js
import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";
import { ensureAuditEventsTable, writeAuditEvent } from "../utils/audit.js";

const router = express.Router();
const ONLINE_WINDOW_MINUTES = Number.parseInt(process.env.ONLINE_WINDOW_MINUTES || "5", 10);
let adminSessionsInfraReady = false;

async function ensureAdminSessionsInfra() {
  if (adminSessionsInfraReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL UNIQUE,
      user_agent TEXT NULL,
      ip_address TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ NULL
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_last_seen
     ON user_sessions(user_id, last_seen_at DESC)`
  );
  adminSessionsInfraReady = true;
}

/** Utils */
function parsePage(n, def = 1) {
  const v = Number.parseInt(n, 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}
function parsePageSize(n, def = 50, min = 1, max = 200) {
  const v = Number.parseInt(n, 10);
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, v));
}

/** Verifica si existe otro admin distinto de userId (para no dejar al sistema sin admins) */
async function thereIsAnotherAdmin(exceptUserId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM users
     WHERE role_id = 1 AND (deleted_at IS NULL) AND id <> $1`,
    [exceptUserId]
  );
  return rows[0]?.c > 0;
}

/** Verifica si un role_id existe en la tabla roles */
async function roleExists(roleId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM roles WHERE id = $1 LIMIT 1`,
    [roleId]
  );
  return !!rows[0];
}

async function ensureAdminPassword(req, res) {
  const actorUserId = req.user.id ?? req.user.userId;
  const currentPassword = String(req.body?.current_password || "");

  if (!currentPassword) {
    res.status(400).json({ error: "current_password is required" });
    return false;
  }

  const { rows } = await pool.query(
    `SELECT password_hash
       FROM users
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [actorUserId]
  );

  const actor = rows[0];
  if (!actor?.password_hash) {
    res.status(404).json({ error: "Admin user not found" });
    return false;
  }

  const ok = await bcrypt.compare(currentPassword, actor.password_hash);
  if (!ok) {
    res.status(403).json({ error: "Invalid admin password" });
    return false;
  }

  return true;
}

/* =========================================================
   GET /api/admin/users?search=&page=1&page_size=50
   Lista usuarios con búsqueda y paginación + meta
   ========================================================= */
router.get("/users", authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureAdminSessionsInfra();
    const search = (req.query.search ?? "").toString().trim();
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.page_size ?? "50"), 10) || 50));
    const offset = (page - 1) * pageSize;

    const params = [];
    let where = "WHERE u.deleted_at IS NULL";

    let pFullname, pEmail;
    if (search) {
      pFullname = params.push(`%${search}%`);
      pEmail    = params.push(`%${search}%`);
      where += ` AND (
        LOWER(u.fullname) LIKE LOWER($${pFullname}) OR
        LOWER(u.email::text) LIKE LOWER($${pEmail})
      )`;
    }

    // total
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM users u
      ${where}
    `;
    const { rows: countRows } = await pool.query(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // data
    const pLimit  = params.push(pageSize);
    const pOffset = params.push(offset);

    const dataSql = `
      SELECT
        u.id,
        u.fullname,
        u.email,          -- citext
        u.phone,
        u.role_id,
        u.created_at,
        COALESCE(u.is_approved, false) AS is_approved,
        COALESCE(u.is_blocked,  false) AS is_blocked,
        r.name AS role_name,
        COALESCE(sess.active_sessions, 0) AS active_sessions,
        sess.last_seen_at,
        (COALESCE(sess.active_sessions, 0) > 0) AS is_online
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN LATERAL (
        SELECT
          MAX(us.last_seen_at) AS last_seen_at,
          COUNT(*) FILTER (
            WHERE us.revoked_at IS NULL
              AND us.last_seen_at >= NOW() - (${Number.isFinite(ONLINE_WINDOW_MINUTES) ? ONLINE_WINDOW_MINUTES : 5} * INTERVAL '1 minute')
          )::int AS active_sessions
        FROM user_sessions us
        WHERE us.user_id = u.id
      ) sess ON TRUE
      ${where}
      ORDER BY u.created_at DESC
      LIMIT  $${pLimit}
      OFFSET $${pOffset}
    `;
    const { rows } = await pool.query(dataSql, params);

    res.json({
      data: rows,
      meta: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (err) {
    console.error("❌ Admin list users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================================================
   GET /api/admin/roles
   Lista simple de roles disponibles (id + name)
   ========================================================= */
router.get("/roles", authenticate, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM roles ORDER BY id ASC`
    );
    res.json({ roles: rows });
  } catch (err) {
    console.error("❌ Admin list roles error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================================================
   GET /api/admin/audit-events
   query: page, page_size, action, entity, actor_user_id, target_user_id, search, from, to
   ========================================================= */
router.get("/audit-events", authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureAuditEventsTable();

    const page = parsePage(req.query.page, 1);
    const pageSize = parsePageSize(req.query.page_size, 25, 1, 100);
    const offset = (page - 1) * pageSize;

    const action = (req.query.action ?? "").toString().trim();
    const entity = (req.query.entity ?? "").toString().trim();
    const search = (req.query.search ?? "").toString().trim();

    const actorUserId = Number.parseInt(String(req.query.actor_user_id ?? ""), 10);
    const targetUserId = Number.parseInt(String(req.query.target_user_id ?? ""), 10);
    const from = (req.query.from ?? "").toString().trim();
    const to = (req.query.to ?? "").toString().trim();

    const params = [];
    const where = [];

    if (action) {
      params.push(action);
      where.push(`ae.action = $${params.length}`);
    }

    if (entity) {
      params.push(entity);
      where.push(`ae.entity = $${params.length}`);
    }

    if (Number.isInteger(actorUserId) && actorUserId > 0) {
      params.push(actorUserId);
      where.push(`ae.actor_user_id = $${params.length}`);
    }

    if (Number.isInteger(targetUserId) && targetUserId > 0) {
      params.push(targetUserId);
      where.push(`ae.target_user_id = $${params.length}`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      params.push(from);
      where.push(`ae.created_at >= $${params.length}::date`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.push(to);
      where.push(`ae.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      where.push(`(
        ae.action ILIKE $${idx}
        OR ae.entity ILIKE $${idx}
        OR COALESCE(actor.fullname, '') ILIKE $${idx}
        OR COALESCE(actor.email::text, '') ILIKE $${idx}
        OR COALESCE(target.fullname, '') ILIKE $${idx}
        OR COALESCE(target.email::text, '') ILIKE $${idx}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM audit_events ae
      LEFT JOIN users actor ON actor.id = ae.actor_user_id
      LEFT JOIN users target ON target.id = ae.target_user_id
      ${whereSql}
    `;
    const { rows: countRows } = await pool.query(countSql, params);
    const total = Number(countRows[0]?.total || 0);

    params.push(pageSize);
    const pLimit = params.length;
    params.push(offset);
    const pOffset = params.length;

    const dataSql = `
      SELECT
        ae.id,
        ae.actor_user_id,
        ae.target_user_id,
        ae.action,
        ae.entity,
        ae.entity_id,
        ae.metadata,
        ae.created_at,
        actor.fullname AS actor_name,
        actor.email::text AS actor_email,
        target.fullname AS target_name,
        target.email::text AS target_email
      FROM audit_events ae
      LEFT JOIN users actor ON actor.id = ae.actor_user_id
      LEFT JOIN users target ON target.id = ae.target_user_id
      ${whereSql}
      ORDER BY ae.created_at DESC
      LIMIT $${pLimit}
      OFFSET $${pOffset}
    `;

    const { rows } = await pool.query(dataSql, params);

    res.json({
      data: rows,
      meta: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (err) {
    console.error("❌ Admin audit events error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================================================
   PATCH /api/admin/users/:id/approve
   body: { approved?: boolean } (default true)
   Aprueba / desaprueba. Al aprobar, se desbloquea.
   ========================================================= */
router.patch("/users/:id/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!(await ensureAdminPassword(req, res))) return;
    const { id } = req.params;
    const approved = req.body.approved !== undefined ? !!req.body.approved : true;
    const actorUserId = req.user.id ?? req.user.userId ?? null;

    const { rowCount } = await pool.query(
      `UPDATE users
         SET is_approved = $1,
             is_blocked = CASE WHEN $1 = TRUE THEN FALSE ELSE is_blocked END,
             updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [approved, id]
    );
    if (!rowCount) return res.status(404).json({ error: "User not found" });

    await writeAuditEvent({
      actorUserId,
      targetUserId: Number(id),
      action: approved ? "admin.user.approve" : "admin.user.unapprove",
      entity: "users",
      entityId: String(id),
      metadata: { approved },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Admin approve user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================================================
   PATCH /api/admin/users/:id/block
   body: { blocked: boolean }
   No te puedes bloquear a ti mismo. No bloquear al último admin.
   ========================================================= */
router.patch("/users/:id/block", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!(await ensureAdminPassword(req, res))) return;
    const { id } = req.params;
    const { blocked } = req.body;
    const actorUserId = req.user.id ?? req.user.userId ?? null;

    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    // Traer target
    const { rows: targetRows } = await pool.query(
      `SELECT id, role_id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    const target = targetRows[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    // Evitar bloquear al último admin
    if (blocked === true && target.role_id === 1) {
      const another = await thereIsAnotherAdmin(target.id);
      if (!another) {
        return res.status(400).json({ error: "Cannot block the last admin" });
      }
    }

    const { rows } = await pool.query(
      `UPDATE users
         SET is_blocked = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, is_blocked`,
      [!!blocked, id]
    );

    await writeAuditEvent({
      actorUserId,
      targetUserId: Number(id),
      action: !!blocked ? "admin.user.block" : "admin.user.unblock",
      entity: "users",
      entityId: String(id),
      metadata: { blocked: !!blocked },
    });

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("❌ Admin block user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================================================
   PATCH /api/admin/users/:id/role
   body: { role_id: number }  (valida que exista en roles)
   No puedes dejar el sistema sin admins (si quitas admin a último admin).
   ========================================================= */
router.patch("/users/:id/role", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!(await ensureAdminPassword(req, res))) return;
    const { id } = req.params;
    const role_id = Number(req.body.role_id);
    const actorUserId = req.user.id ?? req.user.userId ?? null;

    if (!Number.isInteger(role_id)) {
      return res.status(400).json({ error: "Invalid role_id" });
    }
    if (!(await roleExists(role_id))) {
      return res.status(400).json({ error: "role_id does not exist" });
    }

    // Traer estado actual del usuario
    const { rows: targetRows } = await pool.query(
      `SELECT id, role_id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    const target = targetRows[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    // Si era admin y lo vas a cambiar a otro rol, valida que haya otro admin
    if (target.role_id === 1 && role_id !== 1) {
      const another = await thereIsAnotherAdmin(target.id);
      if (!another) {
        return res.status(400).json({ error: "Cannot remove role admin from the last admin" });
      }
    }

    await pool.query(
      `UPDATE users
         SET role_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [role_id, id]
    );

    await writeAuditEvent({
      actorUserId,
      targetUserId: Number(id),
      action: "admin.user.change_role",
      entity: "users",
      entityId: String(id),
      metadata: { previousRoleId: target.role_id, newRoleId: role_id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Admin change role error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================================================
   DELETE /api/admin/users/:id
   No puedes borrarte a ti mismo. No puedes borrar al último admin.
   ========================================================= */
router.delete("/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!(await ensureAdminPassword(req, res))) return;
    const { id } = req.params;
    const actorUserId = req.user.id ?? req.user.userId ?? null;

    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const { rows: target } = await pool.query(
      `SELECT id, role_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!target.length) return res.status(404).json({ error: "User not found" });

    if (target[0].role_id === 1) {
      const another = await thereIsAnotherAdmin(target[0].id);
      if (!another) {
        return res.status(400).json({ error: "Cannot delete the last admin" });
      }
    }

    // Borrado duro; si prefieres soft-delete usa UPDATE ... SET deleted_at = NOW()
    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);

    await writeAuditEvent({
      actorUserId,
      targetUserId: Number(id),
      action: "admin.user.delete",
      entity: "users",
      entityId: String(id),
      metadata: { deleted: true },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Admin delete user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
