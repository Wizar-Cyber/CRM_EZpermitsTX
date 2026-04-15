import pool from "../db.js";

let auditReady = false;

export async function ensureAuditEventsTable() {
  if (auditReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id INTEGER NULL,
      target_user_id INTEGER NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created ON audit_events(actor_user_id, created_at DESC)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_audit_events_target_created ON audit_events(target_user_id, created_at DESC)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_audit_events_entity_created ON audit_events(entity, created_at DESC)`
  );

  auditReady = true;
}

export async function writeAuditEvent({
  actorUserId = null,
  targetUserId = null,
  action,
  entity,
  entityId = null,
  metadata = {},
}) {
  if (!action || !entity) return;

  try {
    await ensureAuditEventsTable();
    const result = await pool.query(
      `INSERT INTO audit_events (
        actor_user_id,
        target_user_id,
        action,
        entity,
        entity_id,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id`,
      [
        actorUserId,
        targetUserId,
        action,
        entity,
        entityId,
        JSON.stringify(metadata || {}),
      ]
    );
    console.log(`✅ Audit recorded: id=${result.rows[0]?.id}, action=${action}, actor=${actorUserId}, target=${targetUserId}`);
  } catch (err) {
    console.error(`❌ Audit write error for action "${action}":`, err.message);
  }
}
