import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Se conecta usando variables individuales desde tu archivo .env
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

export default pool;