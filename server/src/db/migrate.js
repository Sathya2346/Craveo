import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, 'schema.sql');

export async function migrate({ fresh = false, database = env.db.database, quiet = false } = {}) {
  const root = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    ...(env.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    await root.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await root.changeUser({ database });

    if (fresh) {
      await root.query('SET FOREIGN_KEY_CHECKS = 0');
      const [tables] = await root.query(
        `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?`,
        [database],
      );
      for (const table of tables) {
        await root.query(`DROP TABLE IF EXISTS \`${table.name}\``);
      }
      await root.query('SET FOREIGN_KEY_CHECKS = 1');
      if (!quiet) console.log(`[db] dropped ${tables.length} tables in ${database}`);
    }

    const schema = await fs.readFile(schemaPath, 'utf8');
    await root.query(schema);
    if (!quiet) console.log(`[db] schema ready in ${database}`);
  } finally {
    await root.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  const fresh = process.argv.includes('--fresh');
  migrate({ fresh })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[db] migration failed:', error.message);
      process.exit(1);
    });
}
