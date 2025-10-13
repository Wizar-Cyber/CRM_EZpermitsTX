import { pool } from "./db.js";

try {
  const res = await pool.query("SELECT NOW() as now");
  console.log("✅ Conexión exitosa. Hora del servidor:", res.rows[0].now);
} catch (err) {
  console.error("❌ Error al conectar:", err);
} finally {
  process.exit();
}
