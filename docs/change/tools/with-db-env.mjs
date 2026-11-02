#!/usr/bin/env node
// with-db-env.mjs — run a command with the backend's DB_* env vars taken from a MySQL option file.
//
//   node with-db-env.mjs <cnf> [--expect-db <name>] -- <command> [args...]
//
// The option file ([client] host / port / user / password / database / ssl-ca) stays in ~/secure
// (chmod 600). Its values are passed to the child process environment only — the password is never
// printed. DB_SSL=true and DB_SSL_CA=<contents of ssl-ca> are always set, so the backend verifies the
// CA and the server hostname (config/database.ts).
//
// Safety: refuses hosts that are not *.ondigitalocean.com (and anything mentioning zeabur), refuses
// placeholder values, and with --expect-db refuses any other database name.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export function readCnf(path) {
  const out = {};
  let inClient = false;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      inClient = line === '[client]';
      continue;
    }
    if (!inClient) continue;
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

export function envFromCnf(cnf, expectDb) {
  for (const key of ['host', 'port', 'user', 'password', 'database', 'ssl-ca']) {
    if (!cnf[key] || cnf[key].startsWith('REPLACE_WITH')) {
      throw new Error(`cnf: ${key} is missing or still a placeholder`);
    }
  }
  if (/zeabur/i.test(cnf.host) || !/\.ondigitalocean\.com$/i.test(cnf.host)) {
    throw new Error('refusing: host is not a DigitalOcean managed database (*.ondigitalocean.com)');
  }
  if (expectDb && cnf.database !== expectDb) {
    throw new Error(`refusing: cnf database is "${cnf.database}", expected "${expectDb}"`);
  }
  return {
    DB_HOST: cnf.host,
    DB_PORT: cnf.port,
    DB_USER: cnf.user,
    DB_PASSWORD: cnf.password,
    DB_DATABASE: cnf.database,
    DB_SSL: 'true',
    DB_SSL_CA: readFileSync(cnf['ssl-ca'], 'utf8'),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const sep = argv.indexOf('--');
  if (sep < 1) {
    console.error('usage: node with-db-env.mjs <cnf> [--expect-db <name>] -- <command> [args...]');
    process.exit(2);
  }
  const opts = argv.slice(0, sep);
  const cnfPath = opts[0];
  const expectAt = opts.indexOf('--expect-db');
  const expectDb = expectAt >= 0 ? opts[expectAt + 1] : undefined;
  try {
    const env = envFromCnf(readCnf(cnfPath), expectDb);
    const [cmd, ...args] = argv.slice(sep + 1);
    const result = spawnSync(cmd, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? 'development',
        // loadEnv() requires one; these tools never sign tokens with it.
        JWT_SECRET: process.env.JWT_SECRET ?? 'ops-tooling-placeholder-not-used',
        ...env,
      },
    });
    process.exit(result.status ?? 1);
  } catch (error) {
    console.error(String(error.message));
    process.exit(2);
  }
}
