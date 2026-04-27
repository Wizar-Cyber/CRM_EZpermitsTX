/**
 * Import historical data from Excel into houston_311_bcv.
 *
 * Rules:
 * - Uniqueness key: case_number
 * - If record does NOT exist → INSERT with is_historical=true
 * - If record EXISTS:
 *     • Compare classification (manual_classification / consulta)
 *     • If Excel classification differs from DB → update to Excel value
 *     • Always ensure is_historical=true for pre-April-20 records
 *
 * Excel ESTADO mapping:
 *   "Green ✅ Lead"     → manual_classification='green', consulta=null, status='GREEN'
 *   "Red 🚫 Discarded"  → manual_classification='red',   consulta='red', status='RED'
 *
 * Run: node server/scripts/import-excel-historical.js
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import pool from "../db.js";
import path from "path";

const EXCEL_PATH = path.resolve(
  "C:/Users/ripre/OneDrive/SmartFlow/Proyecto Huston/DATA HOUSTON TX.xlsx"
);
const CUTOFF = new Date("2026-04-20T00:00:00");

function parseClassification(estado) {
  if (!estado) return { manual_classification: null, consulta: null, status: "GREEN" };
  const s = String(estado).toLowerCase();
  if (s.includes("red")) {
    return { manual_classification: "red", consulta: "red", status: "RED" };
  }
  return { manual_classification: "green", consulta: null, status: "GREEN" };
}

async function run() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  console.log(`📂 Loaded ${rows.length} rows from Excel.`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const client = await pool.connect();
  try {
    for (const row of rows) {
      const rawCaseNumber = row["Case Number"];
      if (!rawCaseNumber) { skipped++; continue; }

      const caseNumber = String(rawCaseNumber).trim();
      const createdDateLocal = row["Created Date Local"]
        ? new Date(row["Created Date Local"])
        : null;
      const incidentAddress = row["Incident Address"] ?? null;
      const description = row["Description"] ?? null;
      const resolution = row["Resolution Notes"] ?? null;
      const { manual_classification, consulta, status } = parseClassification(row["ESTADO"]);
      const isHistorical = !createdDateLocal || createdDateLocal < CUTOFF;

      try {
        const existing = await client.query(
          `SELECT manual_classification, consulta, is_historical
             FROM houston_311_bcv
            WHERE case_number = $1
            LIMIT 1`,
          [caseNumber]
        );

        if (existing.rowCount === 0) {
          // INSERT
          await client.query(
            `INSERT INTO houston_311_bcv
               (case_number, incident_address, created_date_local,
                description, resolution,
                manual_classification, consulta, status,
                is_historical,
                current_state)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'CASE_REVIEW')
             ON CONFLICT (case_number) DO NOTHING`,
            [
              caseNumber,
              incidentAddress,
              createdDateLocal,
              description,
              resolution,
              manual_classification,
              consulta,
              status,
              isHistorical,
            ]
          );
          inserted++;
        } else {
          // UPDATE — only touch classification fields and is_historical flag
          const db = existing.rows[0];
          const classificationChanged =
            db.manual_classification !== manual_classification ||
            db.consulta !== consulta;
          const flagNeedsUpdate = isHistorical && !db.is_historical;

          if (classificationChanged || flagNeedsUpdate) {
            await client.query(
              `UPDATE houston_311_bcv
                  SET manual_classification = $1,
                      consulta              = $2,
                      status                = $3,
                      is_historical         = is_historical OR $4,
                      updated_at            = NOW()
                WHERE case_number = $5`,
              [manual_classification, consulta, status, isHistorical, caseNumber]
            );
            updated++;
          } else {
            skipped++;
          }
        }
      } catch (rowErr) {
        console.error(`  ⚠️  Row ${caseNumber}: ${rowErr.message}`);
        errors++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("\n📊 Import summary:");
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Updated  : ${updated}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Errors   : ${errors}`);
  console.log("✅ Done.");
}

run();
