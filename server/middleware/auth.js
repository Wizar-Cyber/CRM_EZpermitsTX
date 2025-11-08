// middleware/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

/**
 * Autenticación básica por JWT.
 * Coloca en req.user el payload del token.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
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
