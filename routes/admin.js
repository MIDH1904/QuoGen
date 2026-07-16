const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDbConnection } = require('../database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ==========================================
// 1. PANEL COMPANIES ENDPOINTS
// ==========================================

// GET /api/companies (User & Admin)
router.get('/companies', requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.query('SELECT * FROM PanelCompany ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Fetch companies error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/companies (Admin only)
router.post('/admin/companies', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.query('SELECT id FROM PanelCompany WHERE name = $1', [name.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Company name already exists' });
    }

    const result = await db.query('INSERT INTO PanelCompany (name) VALUES ($1) RETURNING *', [name.trim()]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create company error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/companies/:id (Admin only)
router.put('/admin/companies/:id', requireAdmin, async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  try {
    const db = await getDbConnection();
    const company = await db.query('SELECT id FROM PanelCompany WHERE id = $1', [id]);
    if (company.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const duplicate = await db.query('SELECT id FROM PanelCompany WHERE name = $1 AND id != $2', [name.trim(), id]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Company name already exists' });
    }

    const result = await db.query('UPDATE PanelCompany SET name = $1 WHERE id = $2 RETURNING *', [name.trim(), id]);
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update company error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/companies/:id (Admin only)
router.delete('/admin/companies/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const company = await db.query('SELECT id FROM PanelCompany WHERE id = $1', [id]);
    if (company.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Cascade deletes panel options
    await db.query('DELETE FROM PanelCompany WHERE id = $1', [id]);
    return res.json({ message: 'Company and its options deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// 2. PANEL OPTIONS ENDPOINTS
// ==========================================

// GET /api/companies/:companyId/options (User & Admin)
router.get('/companies/:companyId/options', requireAuth, async (req, res) => {
  const { companyId } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.query(
      'SELECT * FROM PanelOption WHERE company_id = $1 ORDER BY watt_size ASC',
      [companyId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Fetch company options error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/panel-options (Admin only)
router.get('/admin/panel-options', requireAdmin, async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.query(`
      SELECT po.*, pc.name as company_name 
      FROM PanelOption po
      JOIN PanelCompany pc ON po.company_id = pc.id
      ORDER BY pc.name ASC, po.watt_size ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error('Fetch panel options error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/panel-options (Admin only)
router.post('/admin/panel-options', requireAdmin, async (req, res) => {
  const { company_id, watt_size, price } = req.body;

  if (!company_id || !watt_size || price === undefined) {
    return res.status(400).json({ error: 'company_id, watt_size, and price are required' });
  }

  const numericWatt = parseInt(watt_size, 10);
  const numericPrice = parseFloat(price);

  if (isNaN(numericWatt) || numericWatt <= 0) {
    return res.status(400).json({ error: 'Watt size must be a positive integer' });
  }
  if (isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number' });
  }

  try {
    const db = await getDbConnection();
    const company = await db.query('SELECT id FROM PanelCompany WHERE id = $1', [company_id]);
    if (company.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const existing = await db.query(
      'SELECT id FROM PanelOption WHERE company_id = $1 AND watt_size = $2',
      [company_id, numericWatt]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Watt size already exists for this company' });
    }

    const insertRes = await db.query(
      'INSERT INTO PanelOption (company_id, watt_size, price) VALUES ($1, $2, $3) RETURNING id',
      [company_id, numericWatt, numericPrice]
    );
    
    const newOptionRes = await db.query(`
      SELECT po.*, pc.name as company_name 
      FROM PanelOption po
      JOIN PanelCompany pc ON po.company_id = pc.id
      WHERE po.id = $1
    `, [insertRes.rows[0].id]);

    return res.status(201).json(newOptionRes.rows[0]);
  } catch (error) {
    console.error('Create panel option error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/panel-options/:id (Admin only)
router.put('/api/admin/panel-options/:id', requireAdmin, async (req, res) => {
  const { watt_size, price } = req.body;
  const { id } = req.params;

  if (watt_size === undefined || price === undefined) {
    return res.status(400).json({ error: 'watt_size and price are required' });
  }

  const numericWatt = parseInt(watt_size, 10);
  const numericPrice = parseFloat(price);

  if (isNaN(numericWatt) || numericWatt <= 0) {
    return res.status(400).json({ error: 'Watt size must be a positive integer' });
  }
  if (isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number' });
  }

  try {
    const db = await getDbConnection();
    const option = await db.query('SELECT * FROM PanelOption WHERE id = $1', [id]);
    if (option.rows.length === 0) {
      return res.status(404).json({ error: 'Panel option not found' });
    }

    const duplicate = await db.query(
      'SELECT id FROM PanelOption WHERE company_id = $1 AND watt_size = $2 AND id != $3',
      [option.rows[0].company_id, numericWatt, id]
    );
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Watt size already exists for this company' });
    }

    await db.query(
      'UPDATE PanelOption SET watt_size = $1, price = $2 WHERE id = $3',
      [numericWatt, numericPrice, id]
    );

    const updatedRes = await db.query(`
      SELECT po.*, pc.name as company_name 
      FROM PanelOption po
      JOIN PanelCompany pc ON po.company_id = pc.id
      WHERE po.id = $1
    `, [id]);

    return res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error('Update panel option error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/panel-options/:id (Admin only)
router.delete('/api/admin/panel-options/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const option = await db.query('SELECT id FROM PanelOption WHERE id = $1', [id]);
    if (option.rows.length === 0) {
      return res.status(404).json({ error: 'Panel option not found' });
    }

    await db.query('DELETE FROM PanelOption WHERE id = $1', [id]);
    return res.json({ message: 'Panel option deleted successfully' });
  } catch (error) {
    console.error('Delete panel option error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// 3. ASSUMPTIONS ENDPOINTS
// ==========================================

// GET /api/assumptions (User & Admin)
router.get('/assumptions', requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.query('SELECT * FROM Assumptions ORDER BY id DESC LIMIT 1');
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch assumptions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/assumptions (Admin only)
router.put('/admin/assumptions', requireAdmin, async (req, res) => {
  const {
    generation_per_kw_per_year,
    cost_per_unit,
    area_per_kw,
    subsidy_tier1_rate,
    subsidy_tier1_kw,
    subsidy_tier2_rate,
    subsidy_tier2_extra_kw,
    subsidy_cap
  } = req.body;

  try {
    const db = await getDbConnection();
    const current = await db.query('SELECT id FROM Assumptions ORDER BY id DESC LIMIT 1');

    if (current.rows.length > 0) {
      await db.query(`
        UPDATE Assumptions SET
          generation_per_kw_per_year = $1,
          cost_per_unit = $2,
          area_per_kw = $3,
          subsidy_tier1_rate = $4,
          subsidy_tier1_kw = $5,
          subsidy_tier2_rate = $6,
          subsidy_tier2_extra_kw = $7,
          subsidy_cap = $8
        WHERE id = $9
      `, [
        generation_per_kw_per_year,
        cost_per_unit,
        area_per_kw,
        subsidy_tier1_rate,
        subsidy_tier1_kw,
        subsidy_tier2_rate,
        subsidy_tier2_extra_kw,
        subsidy_cap,
        current.rows[0].id
      ]);
    } else {
      await db.query(`
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
      `, [
        generation_per_kw_per_year,
        cost_per_unit,
        area_per_kw,
        subsidy_tier1_rate,
        subsidy_tier1_kw,
        subsidy_tier2_rate,
        subsidy_tier2_extra_kw,
        subsidy_cap
      ]);
    }

    const updated = await db.query('SELECT * FROM Assumptions ORDER BY id DESC LIMIT 1');
    return res.json(updated.rows[0]);
  } catch (error) {
    console.error('Update assumptions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// 4. QUOTATIONS HISTORY BROWSE (Admin only)
// ==========================================

// GET /api/admin/quotations (Admin only)
router.get('/admin/quotations', requireAdmin, async (req, res) => {
  const { search } = req.query;
  try {
    const db = await getDbConnection();
    let query = `
      SELECT q.*, pc.name as company_name, po.watt_size, u.name as creator_name
      FROM Quotation q
      JOIN PanelCompany pc ON q.company_id = pc.id
      JOIN PanelOption po ON q.panel_option_id = po.id
      JOIN "User" u ON q.created_by = u.id
    `;
    const params = [];

    if (search) {
      query += ` WHERE q.customer_name ILIKE $1 OR pc.name ILIKE $2 OR u.name ILIKE $3`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY q.id DESC`;

    const result = await db.query(query, params);

    // Parse JSON fields
    const formatted = result.rows.map(q => ({
      ...q,
      computed: JSON.parse(q.computed_fields_json)
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('Fetch admin quotations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/quotations/:id (Admin only)
router.delete('/api/admin/quotations/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const q = await db.query('SELECT id FROM Quotation WHERE id = $1', [id]);
    if (q.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    await db.query('DELETE FROM Quotation WHERE id = $1', [id]);
    return res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    console.error('Delete quotation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// 5. USER MANAGEMENT ENDPOINTS (Admin only)
// ==========================================

// GET /api/admin/users
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.query('SELECT id, name, email, role FROM "User" ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Fetch users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users
router.post('/admin/users', requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.query('SELECT id FROM "User" WHERE email = $1', [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertRes = await db.query(
      'INSERT INTO "User" (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name.trim(), email.trim(), passwordHash, role]
    );

    const newUser = await db.query('SELECT id, name, email, role FROM "User" WHERE id = $1', [insertRes.rows[0].id]);
    return res.status(201).json(newUser.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id
router.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  const { id } = req.params;

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const db = await getDbConnection();
    const user = await db.query('SELECT id FROM "User" WHERE id = $1', [id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const duplicate = await db.query('SELECT id FROM "User" WHERE email = $1 AND id != $2', [email.trim(), id]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already taken' });
    }

    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE "User" SET name = $1, email = $2, role = $3, password_hash = $4 WHERE id = $5',
        [name.trim(), email.trim(), role, passwordHash, id]
      );
    } else {
      await db.query(
        'UPDATE "User" SET name = $1, email = $2, role = $3 WHERE id = $4',
        [name.trim(), email.trim(), role, id]
      );
    }

    const updatedUser = await db.query('SELECT id, name, email, role FROM "User" WHERE id = $1', [id]);
    return res.json(updatedUser.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (req.user.id === parseInt(id, 10)) {
    return res.status(400).json({ error: 'You cannot delete yourself' });
  }

  try {
    const db = await getDbConnection();
    const user = await db.query('SELECT id FROM "User" WHERE id = $1', [id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query('DELETE FROM "User" WHERE id = $1', [id]);
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
