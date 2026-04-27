/**
 * Migration: add is_historical flag to houston_311_bcv
 *
 * 1. Adds the column (idempotent — safe to run again).
 * 2. Marks every record whose created_date_local < 2026-04-20 as historical.
 *
 * Run: node server/scripts/migrate-historical-flag.js
 */

import pool from "../db.js";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Add column if not present
    await client.query(`
      ALTER TABLE houston_311_bcv
        ADD COLUMN IF NOT EXISTS is_historical BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log("✅ Column is_historical ensured.");

    // 2. Mark all pre-cutoff records
    const { rowCount } = await client.query(`
      UPDATE houston_311_bcv
         SET is_historical = TRUE
       WHERE created_date_local < '2026-04-20'
         AND is_historical = FALSE
    `);
    console.log(`✅ Marked ${rowCount} existing records as historical.`);

    await client.query("COMMIT");
    console.log("✅ Migration committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed, rolled back:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
