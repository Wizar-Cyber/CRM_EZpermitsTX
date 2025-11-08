// routes/admin.js
import express from "express";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";

const router = express.Router();

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

/* =========================================================
   GET /api/admin/users?search=&page=1&page_size=50
   Lista usuarios con búsqueda y paginación + meta
   ========================================================= */
router.get("/users", authenticate, requireAdmin, async (req, res) => {
  try {
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
        r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
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
   PATCH /api/admin/users/:id/approve
   body: { approved?: boolean } (default true)
   Aprueba / desaprueba. Al aprobar, se desbloquea.
   ========================================================= */
router.patch("/users/:id/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const approved = req.body.approved !== undefined ? !!req.body.approved : true;

    const { rowCount } = await pool.query(
      `UPDATE users
         SET is_approved = $1,
             is_blocked = CASE WHEN $1 = TRUE THEN FALSE ELSE is_blocked END,
             updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [approved, id]
    );
    if (!rowCount) return res.status(404).json({ error: "User not found" });

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
    const { id } = req.params;
    const { blocked } = req.body;

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
    const { id } = req.params;
    const role_id = Number(req.body.role_id);

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
    const { id } = req.params;

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
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Admin delete user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
