// create-app-user.ts — create (if missing) the backend account described by an app option file and
// grant it SELECT, INSERT, UPDATE, DELETE on its database only. Must be run with the ADMIN cnf:
//   node ../docs/change/tools/with-db-env.mjs <admin-cnf> -- npx tsx ../docs/change/tools/create-app-user.ts <app-cnf>
// The app password is read from <app-cnf> and passed as a query parameter; it is never printed.
// An existing account keeps its password (only the grant is re-applied).
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../../backend/src');
const ADMIN_LIKE = /^(root|doadmin)$/i;

function readClientSection(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inClient = false;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      inClient = line === '[client]';
      continue;
    }
    const i = line.indexOf('=');
    if (inClient && i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

async function main(): Promise<void> {
  const appCnf = process.argv[2];
  if (!appCnf) throw new Error('usage: create-app-user.ts <app-cnf>');
  const app = readClientSection(appCnf);
  if (!app.user || !app.password || !app.database) throw new Error('app cnf needs user, password, database');
  if (ADMIN_LIKE.test(app.user)) throw new Error('refusing: app user must not be an admin account');
  if (!/^[A-Za-z0-9_]{1,64}$/.test(app.database)) throw new Error('unexpected database name');

  const { loadEnv } = await import(`${SRC}/config/env`);
  const { buildPoolOptions } = await import(`${SRC}/config/database`);
  const { createPool } = await import(`${SRC}/infrastructure/database/client`);
  const pool = createPool({ ...buildPoolOptions(loadEnv()), connectionLimit: 1 });
  try {
    const [existing] = (await pool.query('SELECT COUNT(*) AS n FROM mysql.user WHERE user = ?', [
      app.user,
    ])) as unknown as [Array<{ n: number }>];
    if (Number(existing[0]?.n) === 0) {
      await pool.query('CREATE USER ?@? IDENTIFIED BY ?', [app.user, '%', app.password]);
      console.log(`created ${app.user}`);
    } else {
      console.log(`${app.user} already exists; password left unchanged`);
    }
    await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${app.database}\`.* TO ?@?`, [
      app.user,
      '%',
    ]);
    const [grants] = await pool.query('SHOW GRANTS FOR ?@?', [app.user, '%']);
    for (const row of grants as Array<Record<string, string>>) console.log(Object.values(row)[0]);
  } finally {
    await pool.end();
  }
}

main().catch((error: Error & { code?: string }) => {
  console.error('FAILED:', error.code ?? '', error.message.split('\n')[0]);
  process.exit(1);
});
