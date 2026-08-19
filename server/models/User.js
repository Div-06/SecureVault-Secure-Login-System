const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/database');

const dataFile = path.join(__dirname, '..', 'database', 'dev-data.json');

// Circuit breaker: once MySQL fails, skip it for the rest of this process run
let dbDown = false;

function isDbUnavailable(err) {
  if (!err) return false;
  const codes = [
    'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', 'ECONNRESET',
    'ER_BAD_DB_ERROR', 'ER_ACCESS_DENIED_ERROR', 'ER_NOT_SUPPORTED_AUTH_MODE',
    'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  ];
  if (codes.includes(err.code)) return true;
  if (err instanceof AggregateError) return true;
  if (err.message && /ECONNREFUSED|connection refused|Cannot enqueue/i.test(err.message)) return true;
  return false;
}


async function readStore() {
  try {
    return JSON.parse(await fs.readFile(dataFile, 'utf8'));
  } catch {
    return { users: [], login_history: [], audit_logs: [], counters: { users: 1, login_history: 1, audit_logs: 1 } };
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2));
}

async function fallback(work) {
  const store = await readStore();
  const result = await work(store);
  await writeStore(store);
  return result;
}

async function queryOrFallback(query, fallbackWork) {
  if (dbDown) {
    return fallback(fallbackWork);
  }
  try {
    return await query();
  } catch (err) {
    if (!isDbUnavailable(err)) throw err;
    dbDown = true; // trip the circuit breaker
    console.warn('[DB] MySQL unavailable — switching to JSON fallback for this session');
    return fallback(fallbackWork);
  }
}

function now() {
  return new Date().toISOString();
}

function publicDbUser(user) {
  if (!user) return null;
  const { password_hash, reset_token, reset_token_expires, two_factor_temp_secret, ...safe } = user;
  return { ...safe };
}

class User {
  static async findById(id) {
    return queryOrFallback(
      async () => {
        const [rows] = await pool.execute(
          'SELECT id, full_name, username, email, is_verified, is_locked, failed_attempts, locked_until, two_factor_enabled, two_factor_secret, profile_picture, last_login, created_at, updated_at FROM users WHERE id = ?',
          [id]
        );
        return rows[0] || null;
      },
      async (store) => publicDbUser(store.users.find((user) => Number(user.id) === Number(id)))
    );
  }

  static async findByEmail(email) {
    return queryOrFallback(
      async () => {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        return rows[0] || null;
      },
      async (store) => store.users.find((user) => user.email === email.toLowerCase().trim()) || null
    );
  }

  static async findByUsername(username) {
    return queryOrFallback(
      async () => {
        const [rows] = await pool.execute('SELECT id, username FROM users WHERE username = ?', [username]);
        return rows[0] || null;
      },
      async (store) => {
        const user = store.users.find((item) => item.username === username);
        return user ? { id: user.id, username: user.username } : null;
      }
    );
  }

  static async create({ full_name, username, email, password_hash }) {
    return queryOrFallback(
      async () => {
        const [result] = await pool.execute(
          'INSERT INTO users (full_name, username, email, password_hash) VALUES (?, ?, ?, ?)',
          [full_name, username, email.toLowerCase().trim(), password_hash]
        );
        return result.insertId;
      },
      async (store) => {
        const id = store.counters.users++;
        store.users.push({
          id,
          full_name,
          username,
          email: email.toLowerCase().trim(),
          password_hash,
          is_verified: 0,
          is_locked: 0,
          failed_attempts: 0,
          locked_until: null,
          two_factor_enabled: 0,
          two_factor_secret: null,
          two_factor_temp_secret: null,
          reset_token: null,
          reset_token_expires: null,
          profile_picture: null,
          last_login: null,
          created_at: now(),
          updated_at: now(),
        });
        return id;
      }
    );
  }

  static async update(id, fields) {
    const allowed = ['full_name', 'username', 'email', 'profile_picture'];
    const updates = [];
    const values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (updates.length === 0) return false;

    return queryOrFallback(
      async () => {
        values.push(id);
        await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        return true;
      },
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (!user) return false;
        Object.assign(user, fields, { updated_at: now() });
        return true;
      }
    );
  }

  static async updateLastLogin(id) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) user.last_login = now();
      }
    );
  }

  static async incrementFailedAttempts(id) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?', [id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) user.failed_attempts = Number(user.failed_attempts || 0) + 1;
      }
    );
  }

  static async resetFailedAttempts(id) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET failed_attempts = 0, is_locked = 0, locked_until = NULL WHERE id = ?', [id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) Object.assign(user, { failed_attempts: 0, is_locked: 0, locked_until: null });
      }
    );
  }

  static async lockAccount(id, until) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET is_locked = 1, locked_until = ? WHERE id = ?', [until, id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) Object.assign(user, { is_locked: 1, locked_until: until });
      }
    );
  }

  static async unlockAccount(id) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET is_locked = 0, locked_until = NULL, failed_attempts = 0 WHERE id = ?', [id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) Object.assign(user, { is_locked: 0, locked_until: null, failed_attempts: 0 });
      }
    );
  }

  static async setResetToken(id, token, expires) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) Object.assign(user, { reset_token: token, reset_token_expires: expires });
      }
    );
  }

  static async clearResetToken(id) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) Object.assign(user, { reset_token: null, reset_token_expires: null });
      }
    );
  }

  static async findByResetToken(token) {
    return queryOrFallback(
      async () => {
        const [rows] = await pool.execute('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
        return rows[0] || null;
      },
      async (store) => store.users.find((user) => user.reset_token === token && new Date(user.reset_token_expires) > new Date()) || null
    );
  }

  static async updatePassword(id, hash) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) Object.assign(user, { password_hash: hash, updated_at: now() });
      }
    );
  }

  static async setTwoFactorTempSecret(id, secret) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET two_factor_temp_secret = ? WHERE id = ?', [secret, id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) user.two_factor_temp_secret = secret;
      }
    );
  }

  static async enableTwoFactor(id) {
    return queryOrFallback(
      async () => {
        const [rows] = await pool.execute('SELECT two_factor_temp_secret FROM users WHERE id = ?', [id]);
        if (!rows[0] || !rows[0].two_factor_temp_secret) throw new Error('No temp secret found');
        await pool.execute(
          'UPDATE users SET two_factor_enabled = 1, two_factor_secret = two_factor_temp_secret, two_factor_temp_secret = NULL WHERE id = ?',
          [id]
        );
      },
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (!user?.two_factor_temp_secret) throw new Error('No temp secret found');
        user.two_factor_enabled = 1;
        user.two_factor_secret = user.two_factor_temp_secret;
        user.two_factor_temp_secret = null;
      }
    );
  }

  static async disableTwoFactor(id) {
    return queryOrFallback(
      async () => pool.execute('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_temp_secret = NULL WHERE id = ?', [id]),
      async (store) => {
        const user = store.users.find((item) => Number(item.id) === Number(id));
        if (user) Object.assign(user, { two_factor_enabled: 0, two_factor_secret: null, two_factor_temp_secret: null });
      }
    );
  }

  static async getAll() {
    return queryOrFallback(
      async () => {
        const [rows] = await pool.execute(
          'SELECT id, full_name, username, email, is_verified, is_locked, two_factor_enabled, last_login, created_at FROM users ORDER BY created_at DESC'
        );
        return rows;
      },
      async (store) => store.users.map(publicDbUser).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    );
  }

  static async addLoginHistory({ user_id, ip_address, user_agent, status, device_type }) {
    return queryOrFallback(
      async () => pool.execute(
        'INSERT INTO login_history (user_id, ip_address, user_agent, status, device_type) VALUES (?, ?, ?, ?, ?)',
        [user_id, ip_address, user_agent, status, device_type]
      ),
      async (store) => {
        store.login_history.push({
          id: store.counters.login_history++,
          user_id,
          ip_address,
          user_agent,
          status,
          device_type,
          location: null,
          created_at: now(),
        });
      }
    );
  }

  static async getLoginHistory(user_id, limit = 10) {
    const safeLimit = Math.min(Number(limit) || 10, 100);
    return queryOrFallback(
      async () => {
        const [rows] = await pool.query(
          'SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
          [user_id, safeLimit]
        );
        return rows;
      },
      async (store) => store.login_history
        .filter((row) => Number(row.user_id) === Number(user_id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, safeLimit)
    );
  }

  static async addAuditLog({ userId = null, action, details = '', ipAddress = null }) {
    return queryOrFallback(
      async () => pool.execute(
        'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
        [userId, action, details, ipAddress]
      ),
      async (store) => {
        store.audit_logs.push({
          id: store.counters.audit_logs++,
          user_id: userId,
          action,
          details,
          ip_address: ipAddress,
          created_at: now(),
        });
      }
    );
  }

  static async getAuditLogs(userId, limit = 25) {
    const safeLimit = Math.min(Number(limit) || 25, 100);
    return queryOrFallback(
      async () => {
        const [rows] = await pool.query(
          'SELECT id, action, details, ip_address, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
          [userId, safeLimit]
        );
        return rows;
      },
      async (store) => store.audit_logs
        .filter((row) => Number(row.user_id) === Number(userId))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, safeLimit)
    );
  }
}

module.exports = User;
