import mysql, { type Connection } from "mysql2/promise";

export interface DbEnv {
  DB_HOST: string;
  DB_PORT: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  NODE_ENV?: string;
}

export function loadDbEnv(): DbEnv {
  const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_DATABASE"] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var ${key} — refusing to connect without explicit config.`);
    }
  }
  return {
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: process.env.DB_PORT!,
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    DB_DATABASE: process.env.DB_DATABASE!,
    NODE_ENV: process.env.NODE_ENV,
  };
}

export async function connect(env: DbEnv): Promise<Connection> {
  return mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    multipleStatements: true,
  });
}
