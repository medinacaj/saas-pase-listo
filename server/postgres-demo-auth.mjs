/**
 * PaseListo local DEMO PostgreSQL buyer accounts and sessions.
 * Credentials are scrypt hashes created in buyer-server.mjs; session tokens
 * never reach this adapter, only their SHA-256 digests.
 * Experimental only: no email verification, MFA, TLS termination or real users.
 */
const bad = (status, message) => Object.assign(new Error(message), { status });

export function createPostgresDemoAuth({ pool }) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function") {
    throw Error("Se requiere un pool PostgreSQL compatible");
  }
  async function initialize() {
    await pool.query("SELECT 1 FROM demo_buyers LIMIT 1");
    await pool.query("SELECT 1 FROM demo_buyer_sessions LIMIT 1");
  }
  async function register({ id, email, salt, digest }) {
    const client = await pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      // A shared transaction lock keeps the 100-account test limit consistent.
      await client.query("SELECT pg_advisory_xact_lock(20261110, 2)");
      const count = await client.query("SELECT count(*)::int AS n FROM demo_buyers");
      if (count.rows[0].n >= 100) throw bad(429, "Límite de cuentas de prueba alcanzado");
      const result = await client.query(
        `INSERT INTO demo_buyers(id, email, salt, digest)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, salt, digest, created_at`,
        [id, email, salt, digest]
      );
      await client.query("COMMIT");
      open = false;
      return { id: result.rows[0].id, email: result.rows[0].email,
        salt: result.rows[0].salt, digest: result.rows[0].digest };
    } catch (err) {
      if (open) await client.query("ROLLBACK");
      if (err.code === "23505") throw bad(409, "La cuenta ya existe en esta demo");
      throw err;
    } finally {
      client.release();
    }
  }
  async function findByEmail(email) {
    const { rows } = await pool.query(
      "SELECT id, email, salt, digest FROM demo_buyers WHERE email = $1",
      [email]
    );
    return rows[0] || null;
  }
  async function createSession({ tokenHash, buyerId, expiresAt }) {
    await pool.query("DELETE FROM demo_buyer_sessions WHERE expires_at <= now()");
    await pool.query(
      `INSERT INTO demo_buyer_sessions(token_hash, buyer_id, expires_at)
       VALUES ($1, $2, $3::timestamptz)`,
      [tokenHash, buyerId, new Date(expiresAt).toISOString()]
    );
  }
  async function sessionForToken(tokenHash) {
    const { rows } = await pool.query(
      `SELECT b.id AS buyer_id, b.email, s.expires_at
       FROM demo_buyer_sessions s
       JOIN demo_buyers b ON b.id = s.buyer_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash]
    );
    if (!rows.length) return null;
    return {
      key: tokenHash,
      buyerId: rows[0].buyer_id,
      buyer: { id: rows[0].buyer_id, email: rows[0].email },
      expiresAt: new Date(rows[0].expires_at).getTime()
    };
  }
  async function deleteSession(tokenHash) {
    await pool.query("DELETE FROM demo_buyer_sessions WHERE token_hash = $1", [tokenHash]);
  }
  return { initialize, register, findByEmail, createSession, sessionForToken, deleteSession };
}
