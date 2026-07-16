const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { generateQuotationPdf } = require('../utils/pdfGenerator');

// POST /api/quotations (User & Admin)
router.post('/quotations', requireAuth, async (req, res) => {
  const { customer_name, kw_required, company_id, panel_option_id } = req.body;

  if (!customer_name || !kw_required || !company_id || !panel_option_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const kw = parseFloat(kw_required);
  if (isNaN(kw) || kw <= 0) {
    return res.status(400).json({ error: 'kW required must be a positive number' });
  }

  try {
    const db = await getDbConnection();

    // 1. Get panel option & company details
    const panelOptionRes = await db.query(`
      SELECT po.*, pc.name as company_name 
      FROM PanelOption po
      JOIN PanelCompany pc ON po.company_id = pc.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [panel_option_id, company_id]);

    const panelOption = panelOptionRes.rows[0];

    if (!panelOption) {
      return res.status(404).json({ error: 'Selected Panel Option not found' });
    }

    // 2. Get assumptions
    const assumptionsRes = await db.query('SELECT * FROM Assumptions ORDER BY id DESC LIMIT 1');
    const assumptions = assumptionsRes.rows[0];
    if (!assumptions) {
      return res.status(500).json({ error: 'Assumptions not configured' });
    }

    // 3. Compute calculations
    const watt = panelOption.watt_size;
    const price = panelOption.price;

    const panel_count = Math.ceil((kw * 1000) / watt);
    const actual_kw = Number(((panel_count * watt) / 1000).toFixed(2));
    const net_payable = panel_count * price;

    // Subsidy calculation
    let subsidy = 0;
    const t1_rate = assumptions.subsidy_tier1_rate;
    const t1_kw = assumptions.subsidy_tier1_kw;
    const t2_rate = assumptions.subsidy_tier2_rate;
    const cap = assumptions.subsidy_cap;

    if (kw <= t1_kw) {
      subsidy = t1_rate * kw;
    } else if (kw <= 3) {
      // additional capacity up to 3 kW
      subsidy = (t1_rate * t1_kw) + (t2_rate * (kw - t1_kw));
    } else {
      subsidy = cap;
    }

    const cost_after_subsidy = net_payable - subsidy;

    // Generation & Savings
    const generation_per_kw = assumptions.generation_per_kw_per_year;
    const annual_generation = generation_per_kw * actual_kw;
    const cost_per_unit = assumptions.cost_per_unit;
    const annual_saving = cost_per_unit * annual_generation;

    // Payback period
    let payback_years = 0;
    if (annual_saving > 0) {
      payback_years = Number((cost_after_subsidy / annual_saving).toFixed(2));
    }

    // Area required
    const area_per_kw = assumptions.area_per_kw;
    const area_required = Math.round(actual_kw * area_per_kw);

    const computed_fields = {
      panel_count,
      actual_kw,
      net_payable,
      subsidy,
      cost_after_subsidy,
      generation_per_kw,
      annual_generation,
      cost_per_unit,
      annual_saving,
      payback_years,
      area_required
    };

    const dateStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    // 4. Save quotation in DB
    const result = await db.query(`
      INSERT INTO Quotation (
        customer_name,
        date,
        kw_required,
        company_id,
        panel_option_id,
        computed_fields_json,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [
      customer_name.trim(),
      dateStr,
      kw,
      company_id,
      panel_option_id,
      JSON.stringify(computed_fields),
      req.user.id
    ]);

    const quotationId = result.rows[0].id;

    return res.status(201).json({
      message: 'Quotation generated successfully',
      quotationId,
      computed: computed_fields
    });
  } catch (error) {
    console.error('Create quotation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quotations/:id (User & Admin)
router.get('/quotations/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const qRes = await db.query(`
      SELECT q.*, pc.name as company_name, po.watt_size
      FROM Quotation q
      JOIN PanelCompany pc ON q.company_id = pc.id
      JOIN PanelOption po ON q.panel_option_id = po.id
      WHERE q.id = $1
    `, [id]);
    const q = qRes.rows[0];

    if (!q) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Normal users can only access their own quotations
    if (req.user.role !== 'admin' && q.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      ...q,
      computed: JSON.parse(q.computed_fields_json)
    });
  } catch (error) {
    console.error('Fetch quotation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quotations/:id/pdf (User & Admin - returns PDF download/view stream)
router.get('/quotations/:id/pdf', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const qRes = await db.query(`
      SELECT q.*, pc.name as company_name, po.watt_size
      FROM Quotation q
      JOIN PanelCompany pc ON q.company_id = pc.id
      JOIN PanelOption po ON q.panel_option_id = po.id
      WHERE q.id = $1
    `, [id]);
    const q = qRes.rows[0];

    if (!q) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Normal users can only access their own quotations
    if (req.user.role !== 'admin' && q.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const computed = JSON.parse(q.computed_fields_json);

    // Call Puppeteer PDF generator
    const pdfBuffer = await generateQuotationPdf({
      customer_name: q.customer_name,
      date: q.date,
      kw_required: q.kw_required,
      company_name: q.company_name,
      watt_size: q.watt_size,
      computed
    });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quotation_${q.customer_name.replace(/\s+/g, '_')}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation route error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF quotation' });
  }
});

module.exports = router;
