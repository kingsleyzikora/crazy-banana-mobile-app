const { Pool } = require('pg');

let pool = null;

async function connectDatabase() {
  try {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'userdb',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20, // maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the connection
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');

    // Create users table if it doesn't exist
    await createUsersTable(client);

    client.release();
    return pool;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
}

async function createUsersTable(client) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      gender VARCHAR(50) NOT NULL,
      sex VARCHAR(50) NOT NULL,
      occupation VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
  `;

  try {
    await client.query(createTableQuery);
    console.log('Users table created or already exists');
  } catch (error) {
    console.error('Error creating users table:', error);
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDatabase() first.');
  }
  return pool;
}

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function disconnectDatabase() {
  if (pool) {
    await pool.end();
    console.log('PostgreSQL pool disconnected');
  }
}

module.exports = {
  connectDatabase,
  getPool,
  query,
  disconnectDatabase
};
