import 'dotenv/config';
import pg from 'pg';

// Debug: Ver qué variables de entorno se leen
console.log("🔍 ENV DB CONFIG:", {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD ? "***" : "❌ MISSING",
});

// Validar que tenemos las credenciales necesarias
if (!process.env.DB_PASSWORD) {
  console.warn("⚠️  DB_PASSWORD no está definido. Usando DATABASE_URL si está disponible.");
}

const { Pool } = pg;

// Usar DATABASE_URL si está disponible, sino usar variables individuales
const pool = new Pool(
  process.env.DATABASE_URL ? 
  { connectionString: process.env.DATABASE_URL } :
  {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
  }
);

export default pool;
