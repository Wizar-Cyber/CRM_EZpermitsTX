// routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../db.js';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { writeAuditEvent } from '../utils/audit.js';

const router = express.Router();
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
const RESET_TOKEN_TTL_MINUTES = Number.parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '30', 10);
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
let passwordResetTableReady = false;
let userSessionsReady = false;

async function ensureUserSessionsInfra() {
  if (userSessionsReady) return;

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
  await pool.query(
    `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS token_invalid_before TIMESTAMPTZ NULL`
  );

  userSessionsReady = true;
}

function getRequestIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

async function ensurePasswordResetTable() {
  if (passwordResetTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at)'
  );
  passwordResetTableReady = true;
}

let mailTransporter = null;

function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) return null;

  const auth = SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined;
  mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    ...(auth ? { auth } : {}),
  });
  return mailTransporter;
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const transporter = getMailTransporter();
  if (!transporter) return false;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#0f172a;">
      <h2 style="margin:0 0 12px;">Password recovery</h2>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block; padding:10px 16px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">
          Reset password
        </a>
      </p>
      <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: 'CRM Password Reset',
    text: `Password reset requested. Open this link (expires in ${RESET_TOKEN_TTL_MINUTES} minutes): ${resetUrl}`,
    html,
  });

  return true;
}

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
  body('password')
    .matches(STRONG_PASSWORD_REGEX)
    .withMessage(
      'Password must have 8+ chars, uppercase, lowercase, number and symbol'
    ),
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
      await ensureUserSessionsInfra();
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

      const sessionId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : crypto.randomBytes(16).toString("hex");
      const payload = { ...buildUserPayload(user), sid: sessionId };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      await pool.query(
        `INSERT INTO user_sessions (user_id, session_id, user_agent, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [user.id, sessionId, req.headers["user-agent"] || null, getRequestIp(req)]
      );

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
   GET /api/auth/sessions
   Lista sesiones activas del usuario actual
   ============================ */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    await ensureUserSessionsInfra();
    const userId = req.user.id ?? req.user.userId;
    const currentSid = req.user.sid || null;

    const { rows } = await pool.query(
      `SELECT session_id, user_agent, ip_address, created_at, last_seen_at
         FROM user_sessions
        WHERE user_id = $1
          AND revoked_at IS NULL
        ORDER BY last_seen_at DESC
        LIMIT 50`,
      [userId]
    );

    return res.json({
      sessions: rows.map((r) => ({
        ...r,
        current: currentSid ? r.session_id === currentSid : false,
      })),
    });
  } catch (err) {
    console.error('sessions list error:', err);
    return res.status(500).json({ error: 'Server error fetching sessions.' });
  }
});

/* ============================
   POST /api/auth/sessions/revoke-others
   Revoca todas las sesiones salvo la actual
   ============================ */
router.post('/sessions/revoke-others', authenticate, async (req, res) => {
  try {
    await ensureUserSessionsInfra();
    const userId = req.user.id ?? req.user.userId;
    const currentSid = req.user.sid || null;

    if (!currentSid) {
      return res.status(400).json({ error: 'Current session id not available. Please login again.' });
    }

    const result = await pool.query(
      `UPDATE user_sessions
          SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND session_id <> $2`,
      [userId, currentSid]
    );

    await writeAuditEvent({
      actorUserId: userId,
      targetUserId: userId,
      action: 'auth.sessions.revoke_others',
      entity: 'user_sessions',
      entityId: String(userId),
      metadata: { revokedCount: result.rowCount || 0 },
    });

    return res.json({ success: true, revoked: result.rowCount || 0 });
  } catch (err) {
    console.error('sessions revoke others error:', err);
    return res.status(500).json({ error: 'Server error revoking sessions.' });
  }
});

/* ============================
   POST /api/auth/sessions/revoke-all
   Revoca todas las sesiones (incluida actual) e invalida tokens emitidos
   ============================ */
router.post('/sessions/revoke-all', authenticate, async (req, res) => {
  let client;
  try {
    await ensureUserSessionsInfra();
    const userId = req.user.id ?? req.user.userId;

    client = await pool.connect();
    await client.query('BEGIN');

    const revokeRes = await client.query(
      `UPDATE user_sessions
          SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL`,
      [userId]
    );

    await client.query(
      `UPDATE users
          SET token_invalid_before = NOW(),
              updated_at = NOW()
        WHERE id = $1`,
      [userId]
    );

    await client.query('COMMIT');

    await writeAuditEvent({
      actorUserId: userId,
      targetUserId: userId,
      action: 'auth.sessions.revoke_all',
      entity: 'user_sessions',
      entityId: String(userId),
      metadata: { revokedCount: revokeRes.rowCount || 0 },
    });

    return res.json({ success: true, revoked: revokeRes.rowCount || 0 });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error('sessions revoke all error:', err);
    return res.status(500).json({ error: 'Server error revoking all sessions.' });
  } finally {
    if (client) client.release();
  }
});

/* ============================
   POST /api/auth/forgot-password
   body: { email }
   ============================ */
router.post(
  '/forgot-password',
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid data provided' });
    }

    const { email } = req.body;

    try {
      await ensurePasswordResetTable();

      const { rows } = await pool.query(
        `SELECT email
           FROM users
          WHERE LOWER(email) = LOWER($1)
            AND deleted_at IS NULL
          LIMIT 1`,
        [email]
      );

      const user = rows[0];

      // Siempre devolvemos mensaje genérico para no filtrar existencia
      const genericMessage = 'If that email exists, password reset instructions were generated.';

      if (!user?.email) {
        return res.json({ message: genericMessage });
      }

      const normalizedEmail = String(user.email).toLowerCase().trim();
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await pool.query(
        `DELETE FROM password_reset_tokens
          WHERE LOWER(email) = LOWER($1)
             OR expires_at < NOW()
             OR used_at IS NOT NULL`,
        [normalizedEmail]
      );

      await pool.query(
        `INSERT INTO password_reset_tokens (email, token_hash, expires_at)
         VALUES ($1, $2, NOW() + ($3::int * interval '1 minute'))`,
        [normalizedEmail, tokenHash, RESET_TOKEN_TTL_MINUTES]
      );

      const frontendBase = (process.env.FRONTEND_URL || 'http://69.62.69.98:8081').replace(/\/$/, '');
      const resetUrl = `${frontendBase}/reset-password?token=${encodeURIComponent(rawToken)}`;

      let sentByEmail = false;
      try {
        sentByEmail = await sendPasswordResetEmail({
          to: normalizedEmail,
          resetUrl,
        });
      } catch (mailErr) {
        console.error('forgot-password mail error:', mailErr);
      }

      if (sentByEmail) {
        return res.json({ message: genericMessage });
      }

      return res.json({
        message: `${genericMessage} (email provider not configured, showing link for now)`,
        resetUrl,
      });
    } catch (error) {
      console.error('forgot-password error:', error);
      return res.status(500).json({ message: 'Server error during password recovery.' });
    }
  }
);

/* ============================
   POST /api/auth/reset-password
   body: { token, newPassword }
   ============================ */
router.post(
  '/reset-password',
  body('token').isString().isLength({ min: 20 }),
  body('newPassword')
    .matches(STRONG_PASSWORD_REGEX)
    .withMessage(
      'New password must have 8+ chars, uppercase, lowercase, number and symbol'
    ),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid data provided', errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    try {
      await ensurePasswordResetTable();

      const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

      const resetTokenResult = await pool.query(
        `SELECT email
           FROM password_reset_tokens
          WHERE token_hash = $1
            AND used_at IS NULL
            AND expires_at > NOW()
          LIMIT 1`,
        [tokenHash]
      );

      const tokenRow = resetTokenResult.rows[0];
      if (!tokenRow?.email) {
        return res.status(400).json({ message: 'Invalid or expired reset link.' });
      }

      const userResult = await pool.query(
        `SELECT id, password_hash
           FROM users
          WHERE LOWER(email) = LOWER($1)
            AND deleted_at IS NULL
          LIMIT 1`,
        [tokenRow.email]
      );

      const user = userResult.rows[0];
      if (!user?.id) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        return res.status(400).json({ message: 'New password must be different from current password.' });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(newPassword, salt);

      await pool.query('BEGIN');
      try {
        await pool.query(
          `UPDATE users
              SET password_hash = $1,
                  updated_at = NOW()
            WHERE id = $2`,
          [password_hash, user.id]
        );

        await pool.query(
          `UPDATE password_reset_tokens
              SET used_at = NOW()
            WHERE token_hash = $1`,
          [tokenHash]
        );

        await pool.query(
          `DELETE FROM password_reset_tokens
            WHERE LOWER(email) = LOWER($1)
              AND (used_at IS NOT NULL OR expires_at < NOW())`,
          [tokenRow.email]
        );

        await pool.query('COMMIT');
      } catch (txErr) {
        await pool.query('ROLLBACK');
        throw txErr;
      }

      return res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
      console.error('reset-password error:', error);
      return res.status(500).json({ message: 'Server error during password reset.' });
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

/* ============================
   POST /api/auth/change-password
   body: { currentPassword, newPassword }
   ============================ */
router.post(
  "/change-password",
  authenticate,
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .matches(STRONG_PASSWORD_REGEX)
    .withMessage(
      "New password must have 8+ chars, uppercase, lowercase, number and symbol"
    ),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Invalid data provided", errors: errors.array() });
    }

    const userId = req.user.id ?? req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing user id" });
    }
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ error: "New password must be different from current password" });
    }

    try {
      const { rows } = await pool.query(
        `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [userId]
      );
      const user = rows[0];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(newPassword, salt);

      await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [password_hash, userId]
      );

      await writeAuditEvent({
        actorUserId: userId,
        targetUserId: userId,
        action: "auth.change_password",
        entity: "users",
        entityId: String(userId),
        metadata: { source: "settings.security" },
      });

      res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
      console.error("change-password error:", err);
      res.status(500).json({ error: "Server error during password change." });
    }
  }
);

export default router;
