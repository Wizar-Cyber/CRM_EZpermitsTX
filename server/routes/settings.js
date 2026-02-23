import express from "express";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { ensureAuditEventsTable, writeAuditEvent } from "../utils/audit.js";

const router = express.Router();

const ALLOWED_THEMES = new Set(["light", "dark", "system"]);
const ALLOWED_LANGUAGES = new Set(["en", "es"]);
const ALLOWED_DATE_FORMATS = new Set(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]);

const DEFAULT_SETTINGS = {
  theme: "light",
  email_notifications: true,
  sms_notifications: false,
  language: "en",
  timezone: "America/Chicago",
  date_format: "YYYY-MM-DD",
  avatar_url: null,
};

let settingsInfraReady = false;

async function ensureSettingsInfra() {
  if (settingsInfraReady) return;

  await pool.query(
    `ALTER TABLE user_settings
       ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`
  );
  await pool.query(
    `ALTER TABLE user_settings
       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  );
  await pool.query(
    `ALTER TABLE user_settings
       ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Chicago'`
  );
  await pool.query(
    `ALTER TABLE user_settings
       ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD'`
  );
  await pool.query(
    `ALTER TABLE user_settings
       ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL`
  );
  await pool.query(
    `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS recovery_email TEXT NULL`
  );

  await ensureAuditEventsTable();
  settingsInfraReady = true;
}

function isValidTimeZone(value) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validateProfilePayload(payload) {
  const errors = [];
  const updates = {};

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
      updates,
      expectedVersion: null,
    };
  }

  const hasOwn = (k) => Object.prototype.hasOwnProperty.call(payload, k);
  let expectedVersion = null;

  if (hasOwn("version")) {
    const parsedVersion = Number(payload.version);
    if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
      errors.push({ field: "version", message: "version must be an integer >= 1" });
    } else {
      expectedVersion = parsedVersion;
    }
  }

  if (hasOwn("fullname")) {
    const fullname = String(payload.fullname || "").trim();
    if (fullname.length < 2 || fullname.length > 120) {
      errors.push({ field: "fullname", message: "Full name must be between 2 and 120 characters" });
    } else {
      updates.fullname = fullname;
    }
  }

  if (hasOwn("phone")) {
    const phoneRaw = payload.phone;
    const phone = phoneRaw === null || phoneRaw === undefined ? "" : String(phoneRaw).trim();
    if (phone && !/^\+?[0-9()\-\s]{7,20}$/.test(phone)) {
      errors.push({ field: "phone", message: "Phone must contain only numbers and +() - characters" });
    } else {
      updates.phone = phone || null;
    }
  }

  if (hasOwn("language")) {
    const language = String(payload.language || "").toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.has(language)) {
      errors.push({ field: "language", message: "Language must be one of: en, es" });
    } else {
      updates.language = language;
    }
  }

  if (hasOwn("timezone")) {
    const timezone = String(payload.timezone || "").trim();
    if (!timezone || !isValidTimeZone(timezone)) {
      errors.push({ field: "timezone", message: "Timezone is invalid" });
    } else {
      updates.timezone = timezone;
    }
  }

  if (hasOwn("date_format")) {
    const dateFormat = String(payload.date_format || "").trim();
    if (!ALLOWED_DATE_FORMATS.has(dateFormat)) {
      errors.push({
        field: "date_format",
        message: "date_format must be one of: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY",
      });
    } else {
      updates.date_format = dateFormat;
    }
  }

  if (hasOwn("avatar_url")) {
    const avatarUrl = payload.avatar_url === null || payload.avatar_url === undefined
      ? ""
      : String(payload.avatar_url).trim();

    if (!avatarUrl) {
      updates.avatar_url = null;
    } else {
      let validUrl = false;
      try {
        const parsed = new URL(avatarUrl);
        validUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        validUrl = false;
      }

      if (!validUrl || avatarUrl.length > 500) {
        errors.push({ field: "avatar_url", message: "avatar_url must be a valid http(s) URL up to 500 chars" });
      } else {
        updates.avatar_url = avatarUrl;
      }
    }
  }

  if (hasOwn("recovery_email")) {
    const recoveryEmailRaw = payload.recovery_email;
    const recoveryEmail =
      recoveryEmailRaw === null || recoveryEmailRaw === undefined
        ? ""
        : String(recoveryEmailRaw).trim().toLowerCase();

    if (!recoveryEmail) {
      updates.recovery_email = null;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail) || recoveryEmail.length > 255) {
      errors.push({ field: "recovery_email", message: "recovery_email must be a valid email up to 255 chars" });
    } else {
      updates.recovery_email = recoveryEmail;
    }
  }

  if (!Object.keys(updates).length) {
    errors.push({
      field: "body",
      message: "No valid profile fields provided. Allowed: fullname, phone, language, timezone, date_format, avatar_url, recovery_email",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    updates,
    expectedVersion,
  };
}

function validateSettingsPayload(payload) {
  const errors = [];
  const hasOwn = (k) => Object.prototype.hasOwnProperty.call(payload || {}, k);
  const updates = {};
  let expectedVersion = null;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
      updates,
      expectedVersion,
    };
  }

  if (hasOwn("version")) {
    const parsedVersion = Number(payload.version);
    if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
      errors.push({ field: "version", message: "version must be an integer >= 1" });
    } else {
      expectedVersion = parsedVersion;
    }
  }

  if (hasOwn("theme")) {
    const theme = String(payload.theme || "").toLowerCase().trim();
    if (!ALLOWED_THEMES.has(theme)) {
      errors.push({ field: "theme", message: "Theme must be one of: light, dark, system" });
    } else {
      updates.theme = theme;
    }
  }

  if (hasOwn("language")) {
    const language = String(payload.language || "").toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.has(language)) {
      errors.push({ field: "language", message: "Language must be one of: en, es" });
    } else {
      updates.language = language;
    }
  }

  if (hasOwn("email_notifications")) {
    if (typeof payload.email_notifications !== "boolean") {
      errors.push({ field: "email_notifications", message: "email_notifications must be boolean" });
    } else {
      updates.email_notifications = payload.email_notifications;
    }
  }

  if (hasOwn("sms_notifications")) {
    if (typeof payload.sms_notifications !== "boolean") {
      errors.push({ field: "sms_notifications", message: "sms_notifications must be boolean" });
    } else {
      updates.sms_notifications = payload.sms_notifications;
    }
  }

  if (!Object.keys(updates).length) {
    errors.push({
      field: "body",
      message: "No valid settings fields provided. Allowed: theme, language, email_notifications, sms_notifications",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    updates,
    expectedVersion,
  };
}

// 🧩 Obtener configuración del usuario logueado
router.get("/", authenticate, async (req, res) => {
  try {
    await ensureSettingsInfra();
    const userId = req.user.id ?? req.user.userId;

    const result = await pool.query(
      "SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (result.rows.length === 0) {
      // Crear configuración por defecto si no existe
      const insert = await pool.query(
        `INSERT INTO user_settings (
           user_id, theme, email_notifications, sms_notifications, language, timezone, date_format, avatar_url
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          DEFAULT_SETTINGS.theme,
          DEFAULT_SETTINGS.email_notifications,
          DEFAULT_SETTINGS.sms_notifications,
          DEFAULT_SETTINGS.language,
          DEFAULT_SETTINGS.timezone,
          DEFAULT_SETTINGS.date_format,
          DEFAULT_SETTINGS.avatar_url,
        ]
      );
      return res.json(insert.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🧩 Obtener perfil del usuario logueado
router.get("/profile", authenticate, async (req, res) => {
  try {
    await ensureSettingsInfra();
    const userId = req.user.id ?? req.user.userId;

    const settingsRes = await pool.query(
      "SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    let settings = settingsRes.rows[0];

    if (!settings) {
      const insert = await pool.query(
        `INSERT INTO user_settings (
           user_id, theme, email_notifications, sms_notifications, language, timezone, date_format, avatar_url, version, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())
         RETURNING *`,
        [
          userId,
          DEFAULT_SETTINGS.theme,
          DEFAULT_SETTINGS.email_notifications,
          DEFAULT_SETTINGS.sms_notifications,
          DEFAULT_SETTINGS.language,
          DEFAULT_SETTINGS.timezone,
          DEFAULT_SETTINGS.date_format,
          DEFAULT_SETTINGS.avatar_url,
        ]
      );
      settings = insert.rows[0];
    }

    const userRes = await pool.query(
      `SELECT id, fullname, email, phone, recovery_email
         FROM users
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      recovery_email: user.recovery_email || null,
      role_id: req.user.role_id ?? null,
      role: req.user.role ?? null,
      language: settings.language,
      timezone: settings.timezone || DEFAULT_SETTINGS.timezone,
      date_format: settings.date_format || DEFAULT_SETTINGS.date_format,
      avatar_url: settings.avatar_url || null,
      version: settings.version || 1,
      updated_at: settings.updated_at,
    });
  } catch (err) {
    console.error("Error fetching profile settings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 🧩 Actualizar perfil del usuario logueado
router.put("/profile", authenticate, async (req, res) => {
  let client;
  try {
    await ensureSettingsInfra();
    const userId = req.user.id ?? req.user.userId;
    const validation = validateProfilePayload(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid profile payload",
        details: validation.errors,
      });
    }

    const updates = validation.updates;
    const expectedVersion = validation.expectedVersion;

    client = await pool.connect();
    await client.query("BEGIN");

    const userRes = await client.query(
      `SELECT id, fullname, email, phone, recovery_email
         FROM users
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE`,
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const settingsRes = await client.query(
      "SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1 FOR UPDATE",
      [userId]
    );

    let settings = settingsRes.rows[0];
    if (!settings) {
      const inserted = await client.query(
        `INSERT INTO user_settings (
           user_id, theme, email_notifications, sms_notifications, language, timezone, date_format, avatar_url, version, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())
         RETURNING *`,
        [
          userId,
          DEFAULT_SETTINGS.theme,
          DEFAULT_SETTINGS.email_notifications,
          DEFAULT_SETTINGS.sms_notifications,
          DEFAULT_SETTINGS.language,
          DEFAULT_SETTINGS.timezone,
          DEFAULT_SETTINGS.date_format,
          DEFAULT_SETTINGS.avatar_url,
        ]
      );
      settings = inserted.rows[0];
    }

    const currentVersion = Number(settings.version || 1);
    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Profile changed on another session. Refresh and try again.",
        code: "PROFILE_VERSION_CONFLICT",
        currentVersion,
      });
    }

    const nextFullname = updates.fullname ?? user.fullname;
    const nextPhone = updates.phone !== undefined ? updates.phone : user.phone;
    const nextRecoveryEmail = updates.recovery_email !== undefined ? updates.recovery_email : user.recovery_email;
    await client.query(
      `UPDATE users
          SET fullname = $2,
              phone = $3,
              recovery_email = $4,
              updated_at = NOW()
        WHERE id = $1`,
      [userId, nextFullname, nextPhone, nextRecoveryEmail]
    );

    const nextLanguage = updates.language ?? settings.language ?? DEFAULT_SETTINGS.language;
    const nextTimezone = updates.timezone ?? settings.timezone ?? DEFAULT_SETTINGS.timezone;
    const nextDateFormat = updates.date_format ?? settings.date_format ?? DEFAULT_SETTINGS.date_format;
    const nextAvatarUrl = updates.avatar_url !== undefined ? updates.avatar_url : (settings.avatar_url ?? null);

    const updatedSettingsRes = await client.query(
      `UPDATE user_settings
          SET language = $2,
              timezone = $3,
              date_format = $4,
              avatar_url = $5,
              version = COALESCE(version, 1) + 1,
              updated_at = NOW()
        WHERE user_id = $1
        RETURNING *`,
      [userId, nextLanguage, nextTimezone, nextDateFormat, nextAvatarUrl]
    );

    const updatedSettings = updatedSettingsRes.rows[0];

    await client.query("COMMIT");

    await writeAuditEvent({
      actorUserId: userId,
      targetUserId: userId,
      action: "settings.profile.update",
      entity: "users",
      entityId: String(userId),
      metadata: {
        fields: Object.keys(updates),
        expectedVersion,
        resultingVersion: updatedSettings?.version ?? null,
      },
    });

    return res.json({
      success: true,
      profile: {
        id: userId,
        fullname: nextFullname,
        email: user.email,
        phone: nextPhone,
        recovery_email: nextRecoveryEmail,
        role_id: req.user.role_id ?? null,
        role: req.user.role ?? null,
        language: updatedSettings.language,
        timezone: updatedSettings.timezone,
        date_format: updatedSettings.date_format,
        avatar_url: updatedSettings.avatar_url,
        version: updatedSettings.version,
        updated_at: updatedSettings.updated_at,
      },
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("Error updating profile settings:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    if (client) client.release();
  }
});

// 🧩 Actualizar configuración
router.put("/", authenticate, async (req, res) => {
  let client;
  try {
    await ensureSettingsInfra();
    const userId = req.user.id ?? req.user.userId;
    const validation = validateSettingsPayload(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid settings payload",
        details: validation.errors,
      });
    }

    const updates = validation.updates;
    const expectedVersion = validation.expectedVersion;
    const theme = updates.theme ?? DEFAULT_SETTINGS.theme;
    const emailNotifications =
      updates.email_notifications ?? DEFAULT_SETTINGS.email_notifications;
    const smsNotifications =
      updates.sms_notifications ?? DEFAULT_SETTINGS.sms_notifications;
    const language = updates.language ?? DEFAULT_SETTINGS.language;

    client = await pool.connect();
    await client.query("BEGIN");

    const existingRes = await client.query(
      "SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1 FOR UPDATE",
      [userId]
    );

    let persisted;

    if (!existingRes.rows.length) {
      const inserted = await client.query(
        `INSERT INTO user_settings (
           user_id, theme, email_notifications, sms_notifications, language, timezone, date_format, avatar_url, version, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())
         RETURNING *`,
        [
          userId,
          theme,
          emailNotifications,
          smsNotifications,
          language,
          DEFAULT_SETTINGS.timezone,
          DEFAULT_SETTINGS.date_format,
          DEFAULT_SETTINGS.avatar_url,
        ]
      );
      persisted = inserted.rows[0];
    } else {
      const current = existingRes.rows[0];
      const currentVersion = Number(current.version || 1);

      if (expectedVersion !== null && expectedVersion !== currentVersion) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Settings changed on another session. Refresh and try again.",
          code: "SETTINGS_VERSION_CONFLICT",
          currentVersion,
        });
      }

      const updated = await client.query(
        `UPDATE user_settings
            SET theme = COALESCE($2, theme),
                email_notifications = COALESCE($3, email_notifications),
                sms_notifications = COALESCE($4, sms_notifications),
                language = COALESCE($5, language),
                version = COALESCE(version, 1) + 1,
                updated_at = NOW()
          WHERE user_id = $1
          RETURNING *`,
        [userId, theme, emailNotifications, smsNotifications, language]
      );

      persisted = updated.rows[0];
    }

    await client.query("COMMIT");

    await writeAuditEvent({
      actorUserId: userId,
      targetUserId: userId,
      action: "settings.update",
      entity: "user_settings",
      entityId: String(userId),
      metadata: {
        fields: Object.keys(updates),
        expectedVersion,
        resultingVersion: persisted?.version ?? null,
      },
    });

    if (!persisted) {
      return res.status(500).json({ error: "Unable to persist settings" });
    }

    res.json({ success: true, settings: persisted });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("Error updating settings:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (client) client.release();
  }
});

export default router;
