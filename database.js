require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Initialize Pool with SSL options for Supabase compatibility
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('WARNING: DATABASE_URL environment variable is not defined.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString ? {
    rejectUnauthorized: false
  } : false
});

async function getDbConnection() {
  return pool;
}

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create Users Table ("User" table name quoted because 'user' is a Postgres reserved word)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) CHECK(role IN ('admin', 'user')) NOT NULL
      )
    `);

    // 2. Create PanelCompany Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS PanelCompany (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      )
    `);

    // 3. Create PanelOption Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS PanelOption (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        watt_size INTEGER NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        FOREIGN KEY (company_id) REFERENCES PanelCompany(id) ON DELETE CASCADE,
        UNIQUE(company_id, watt_size)
      )
    `);

    // 4. Create Assumptions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS Assumptions (
        id SERIAL PRIMARY KEY,
        generation_per_kw_per_year DOUBLE PRECISION NOT NULL DEFAULT 1500,
        cost_per_unit DOUBLE PRECISION NOT NULL DEFAULT 8.5,
        area_per_kw DOUBLE PRECISION NOT NULL DEFAULT 67.13,
        subsidy_tier1_rate DOUBLE PRECISION NOT NULL DEFAULT 30000,
        subsidy_tier1_kw DOUBLE PRECISION NOT NULL DEFAULT 2,
        subsidy_tier2_rate DOUBLE PRECISION NOT NULL DEFAULT 18000,
        subsidy_tier2_extra_kw DOUBLE PRECISION NOT NULL DEFAULT 1,
        subsidy_cap DOUBLE PRECISION NOT NULL DEFAULT 78000
      )
    `);

    // 5. Create Quotation Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS Quotation (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        date VARCHAR(50) NOT NULL,
        kw_required DOUBLE PRECISION NOT NULL,
        company_id INTEGER NOT NULL REFERENCES PanelCompany(id),
        panel_option_id INTEGER NOT NULL REFERENCES PanelOption(id),
        computed_fields_json TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES "User"(id)
      )
    `);

    // --- SEED DATA ---

    // Seed Users
    const userCountRes = await client.query('SELECT COUNT(*) FROM "User"');
    const userCount = parseInt(userCountRes.rows[0].count, 10);
    if (userCount === 0) {
      const adminHash = await bcrypt.hash('admin123', 10);
      const userHash = await bcrypt.hash('user123', 10);

      await client.query(
        'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        ['Admin User', 'admin@roshnisolar.in', adminHash, 'admin']
      );
      await client.query(
        'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        ['Standard User', 'user@roshnisolar.in', userHash, 'user']
      );
      console.log('Seeded Users in Supabase.');
    }

    // Seed Panel Companies
    const companyCountRes = await client.query('SELECT COUNT(*) FROM PanelCompany');
    const companyCount = parseInt(companyCountRes.rows[0].count, 10);
    if (companyCount === 0) {
      await client.query('INSERT INTO PanelCompany (name) VALUES ($1)', ['Waaree']);
      await client.query('INSERT INTO PanelCompany (name) VALUES ($1)', ['Adani']);
      await client.query('INSERT INTO PanelCompany (name) VALUES ($1)', ['Vikram Solar']);
      console.log('Seeded Panel Companies in Supabase.');
    }

    // Seed Panel Options
    const optionCountRes = await client.query('SELECT COUNT(*) FROM PanelOption');
    const optionCount = parseInt(optionCountRes.rows[0].count, 10);
    if (optionCount === 0) {
      const waaree = await client.query('SELECT id FROM PanelCompany WHERE name = $1', ['Waaree']);
      const adani = await client.query('SELECT id FROM PanelCompany WHERE name = $1', ['Adani']);
      const vikram = await client.query('SELECT id FROM PanelCompany WHERE name = $1', ['Vikram Solar']);

      if (waaree.rows.length > 0) {
        const wId = waaree.rows[0].id;
        await client.query('INSERT INTO PanelOption (company_id, watt_size, price) VALUES ($1, $2, $3)', [wId, 540, 28250]);
        await client.query('INSERT INTO PanelOption (company_id, watt_size, price) VALUES ($1, $2, $3)', [wId, 550, 29000]);
        await client.query('INSERT INTO PanelOption (company_id, watt_size, price) VALUES ($1, $2, $3)', [wId, 600, 31800]);
      }
      if (adani.rows.length > 0) {
        const aId = adani.rows[0].id;
        await client.query('INSERT INTO PanelOption (company_id, watt_size, price) VALUES ($1, $2, $3)', [aId, 540, 27500]);
        await client.query('INSERT INTO PanelOption (company_id, watt_size, price) VALUES ($1, $2, $3)', [aId, 550, 28500]);
      }
      if (vikram.rows.length > 0) {
        const vId = vikram.rows[0].id;
        await client.query('INSERT INTO PanelOption (company_id, watt_size, price) VALUES ($1, $2, $3)', [vId, 540, 28000]);
      }
      console.log('Seeded Panel Options in Supabase.');
    }

    // Seed Assumptions
    const assumptionsCountRes = await client.query('SELECT COUNT(*) FROM Assumptions');
    const assumptionsCount = parseInt(assumptionsCountRes.rows[0].count, 10);
    if (assumptionsCount === 0) {
      await client.query(`
        INSERT INTO Assumptions (
          generation_per_kw_per_year,
          cost_per_unit,
          area_per_kw,
          subsidy_tier1_rate,
          subsidy_tier1_kw,
          subsidy_tier2_rate,
          subsidy_tier2_extra_kw,
          subsidy_cap
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [1500, 8.5, 67.13, 30000, 2, 18000, 1, 78000]);
      console.log('Seeded Assumptions in Supabase.');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  getDbConnection,
  initializeDatabase
};
