import { createPool, PoolConnection, Pool } from 'mysql2/promise';
import path from "path";
import dotenv from "dotenv";
const ENV_PATH = path.join(__dirname, '/../.env');

dotenv.config({ path: ENV_PATH });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'my-secret-pw',
  database: process.env.DB_NAME || 'line_notify',
};

export const pool: Pool = createPool(dbConfig);

// コネクションプールからコネクションを取得
export async function getDBConnection(): Promise<PoolConnection> {
  return await pool.getConnection();
}