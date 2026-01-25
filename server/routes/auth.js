// routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * Obtiene (o crea si falta) el role_id del rol 'user'.
 * El registro SIEMPRE usará este role_id (ignoramos cualquier role/role_id del body).
 */
async function getUserRoleId() {
  // intenta obtener el rol 'user'
  let r = await pool.query(
    "SELECT id FROM roles WHERE LOWER(name) = 'user' LIMIT 1"
  );
  if (r.rows[0]?.id) return Number(r.rows[0].id);

  // si no existe, créalo
  r = await pool.query(
    "INSERT INTO roles(name) VALUES('user') RETURNING id"
  );
  return Number(r.rows[0].id);
}

/** Normaliza el payload para el JWT */
function buildUserPayload(row) {
  const roleName =
    (row.role_name || '').toLowerCase() || (row.role_id === 1 ? 'admin' : 'user');

  return {
    id: row.id,
    fullname: row.fullname,
    email: row.email,
    role_id: row.role_id,
    role: roleName, // 'admin' | 'user'
    is_approved: !!row.is_approved,
    is_blocked: !!row.is_blocked,
  };
}

/* ============================
   POST /api/auth/register
   (sin role/role_id, sin documentos)
   ============================ */
router.post(
  '/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('fullname').notEmpty().trim(),
  body('phone').optional().isString().trim(),
  // 🔒 IMPORTANTE: no aceptamos role ni role_id desde el body
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: 'Invalid data provided', errors: errors.array() });
    }

    const { fullname, email, phone = '', password } = req.body;

    try {
      // ¿email ya existe?
      const exists = await pool.query(
        'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
        [email]
      );
      if (exists.rowCount > 0) {
        return res.status(409).json({ message: 'Email already exists.' });
      }

      // hash
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      // role_id => siempre USER
      const role_id = await getUserRoleId();

      // insertar - por defecto pendiente de aprobación
      const insertSql = `
        INSERT INTO users (
          fullname, email, phone, password_hash,
          role_id, is_approved, is_blocked,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, FALSE, FALSE, NOW(), NOW())
        RETURNING id, fullname, email, role_id, is_approved, is_blocked
      `;
      const { rows } = await pool.query(insertSql, [
        fullname,
        email,
        phone,
        password_hash,
        role_id,
      ]);

      return res.status(201).json({
        message: 'User registered successfully (pending admin approval)',
        user: rows[0],
      });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Email already exists.' });
      }
      console.error('register error:', error);
      return res
        .status(500)
        .json({ message: 'Server error during registration.' });
    }
  }
);

/* ============================
   POST /api/auth/login
   ============================ */
router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid data provided' });
    }

    const { email, password } = req.body;

    try {
      // usuario + rol
      const q = `
        SELECT u.id, u.fullname, u.email, u.phone,
               u.password_hash, u.role_id,
               u.is_approved, u.is_blocked,
               u.last_login_at,
               r.name AS role_name
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1
          AND u.deleted_at IS NULL
        LIMIT 1
      `;
      const { rows } = await pool.query(q, [email]);
      const user = rows[0];

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (user.is_blocked) {
        return res.status(403).json({ message: 'User is blocked' });
      }
      if (!user.is_approved) {
        return res.status(403).json({ message: 'User not approved yet' });
      }

      const payload = buildUserPayload(user);
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      // actualizar last_login_at (best effort)
      pool.query(
        'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id]
      ).catch(() => {});

      return res.json({
        message: 'Login successful',
        token,
        user: payload,
      });
    } catch (error) {
      console.error('login error:', error);
      return res.status(500).json({ message: 'Server error during login.' });
    }
  }
);

/* ============================
   GET /api/auth/verify
   ============================ */
router.get('/verify', authenticate, (req, res) => {
  const u = req.user || {};
  return res.json({
    valid: true,
    user: {
      id: u.id ?? u.userId ?? null,
      fullname: u.fullname ?? null,
      email: u.email ?? null,
      role_id: u.role_id ?? null,
      role: u.role ?? null,
      is_approved: u.is_approved ?? null,
      is_blocked: u.is_blocked ?? null,
    },
  });
});

export default router;
