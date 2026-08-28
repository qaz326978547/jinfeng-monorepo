import type { Pool, PoolConnection } from 'mysql2/promise';

/**
 * Runs `fn` inside a transaction on a dedicated connection. Note that most
 * legacy tables (contact, contact_class, contact_quest, contact_list, faq,
 * seo, ...) are MyISAM and silently ignore transaction boundaries — this
 * helper is meaningful only for InnoDB tables (e.g. the future `users`
 * table). Preserving that MyISAM behaviour is intentional, not a bug.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
