import type { Pool, PoolConnection } from 'mysql2/promise';

/**
 * Runs `fn` inside a transaction on a dedicated connection. Since the
 * DigitalOcean migration (2026-10-23) every table is InnoDB, so a failure
 * rolls back all writes made through `connection`. Before that, contact,
 * contact_class, contact_quest, contact_list, faq and seo were MyISAM and
 * silently ignored the transaction boundary.
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
