import mysql from 'mysql2/promise';
import { env } from './env.js';

const poolOptions = (database) => ({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  // DECIMAL comes back as a JS number so money math never touches strings.
  decimalNumbers: true,
  // Interpret every DATETIME as UTC; the pool pins the session time zone too.
  timezone: 'Z',
  dateStrings: false,
  multipleStatements: false,
  ...(env.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const pool = mysql.createPool(poolOptions(env.db.database));

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

/** Run a query and return rows (or the OkPacket for writes). */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query and return the first row, or null. */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/** Run a query and return the OkPacket (insertId, affectedRows...). */
export async function execute(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/** Transaction helper. The callback receives a scoped query function. */
export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tx = {
      query: async (sql, params = []) => {
        const [rows] = await connection.query(sql, params);
        return rows;
      },
      one: async (sql, params = []) => {
        const [rows] = await connection.query(sql, params);
        return rows.length ? rows[0] : null;
      },
      execute: async (sql, params = []) => {
        const [result] = await connection.query(sql, params);
        return result;
      },
    };
    const result = await work(tx);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase() {
  const row = await queryOne('SELECT 1 AS ok');
  return row?.ok === 1;
}

export async function closePool() {
  await pool.end();
}

export { poolOptions };
