// middleware/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "../db.js";
dotenv.config();

/**
 * Autenticación básica por JWT.
 * Coloca en req.user el payload del token.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const userId = payload?.id ?? payload?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userRes = await pool.query(
      `SELECT id, deleted_at, token_invalid_before
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [userId]
    );
    const userRow = userRes.rows[0];
    if (!userRow || userRow.deleted_at) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (userRow.token_invalid_before && payload.iat) {
      const invalidBeforeMs = new Date(userRow.token_invalid_before).getTime();
      const tokenIssuedAtMs = Number(payload.iat) * 1000;
      if (Number.isFinite(invalidBeforeMs) && tokenIssuedAtMs <= invalidBeforeMs) {
        return res.status(401).json({ error: "Session expired" });
      }
    }

    if (payload.sid) {
      const sessionRes = await pool.query(
        `SELECT session_id
           FROM user_sessions
          WHERE user_id = $1
            AND session_id = $2
            AND revoked_at IS NULL
          LIMIT 1`,
        [userId, payload.sid]
      );

      if (!sessionRes.rows[0]) {
        return res.status(401).json({ error: "Session expired" });
      }

      pool
        .query(
          `UPDATE user_sessions
              SET last_seen_at = NOW()
            WHERE user_id = $1
              AND session_id = $2`,
          [userId, payload.sid]
        )
        .catch(() => {});
    }

    // payload DEBE traer: id, role_id (o role/role_name), is_approved, is_blocked, etc.
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * Solo permite acceso a administradores.
 * Acepta cualquiera de estas señales:
 *  - role_id === 1
 *  - role === 'admin'
 *  - role_name === 'admin'
 */
export const requireAdmin = (req, res, next) => {
  const u = req.user || {};
  const isAdmin =
    u.role_id === 1 || u.role === "admin" || u.role_name === "admin";

  if (!isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
};

/**
 * Opcional: fuerza que el usuario esté aprobado y no bloqueado para usar ciertas rutas.
 * Útil si quieres impedir uso del sistema hasta que el admin apruebe.
 */
export const requireApproved = (req, res, next) => {
  const u = req.user || {};
  if (u.is_blocked) {
    return res.status(403).json({ error: "User is blocked" });
  }
  if (u.is_approved === false) {
    return res.status(403).json({ error: "User not approved yet" });
  }
  next();
};
