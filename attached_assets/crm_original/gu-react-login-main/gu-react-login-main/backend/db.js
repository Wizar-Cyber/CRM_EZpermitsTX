// db.js
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME
});

// Optional: test connection on start
pool.on("connect", () => {
  console.log("Connected to Postgres");
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

export default pool;