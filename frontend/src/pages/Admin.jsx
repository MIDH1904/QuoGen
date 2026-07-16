import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit, Trash2, Save, FileText, Search, Download, Eye, AlertCircle } from 'lucide-react';

export default function Admin({ token }) {
  const [activeTab, setActiveTab] = useState('history'); // history, companies, options, assumptions

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. Panel Companies state
  const [companies, setCompanies] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState(null); // { id, name }

  // 2. Panel Options & Price state
  const [options, setOptions] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [wattSize, setWattSize] = useState('');
  const [price, setPrice] = useState('');
  const [editingOption, setEditingOption] = useState(null); // { id, company_id, watt_size, price }

  // 3. Assumptions state
  const [assumptions, setAssumptions] = useState({
    generation_per_kw_per_year: 1500,
    cost_per_unit: 8.5,
    area_per_kw: 67.13,
    subsidy_tier1_rate: 30000,
    subsidy_tier1_kw: 2,
    subsidy_tier2_rate: 18000,
    subsidy_tier2_extra_kw: 1,
    subsidy_cap: 78000
  });

  // 4. Quotation history state
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 5. User Management state
  const [users, setUsers] = useState([]);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [editingUser, setEditingUser] = useState(null);

  // Fetch initial data based on active tab
  useEffect(() => {
    setError('');
    setSuccess('');

    if (activeTab === 'companies') {
      fetchCompanies();
    } else if (activeTab === 'options') {
      fetchCompanies();
      fetchOptions();
    } else if (activeTab === 'assumptions') {
      fetchAssumptions();
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  // Run history fetch with search input debounce/effect
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [searchQuery]);

  // --- API CALLS ---

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error('Fetch companies error:', err);
    }
  };

  const fetchOptions = async () => {
    try {
      const response = await fetch('/api/admin/panel-options', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOptions(data);
      }
    } catch (err) {
      console.error('Fetch options error:', err);
    }
  };

  const fetchAssumptions = async () => {
    try {
      const response = await fetch('/api/assumptions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data) setAssumptions(data);
      }
    } catch (err) {
      console.error('Fetch assumptions error:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const url = searchQuery 
        ? `/api/admin/quotations?search=${encodeURIComponent(searchQuery)}`
        : '/api/admin/quotations';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  // --- ACTIONS ---

  // 0. Quotation Deletion Action
  const handleQuotationDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quotation permanently?')) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/quotations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSuccess('Quotation deleted successfully.');
        fetchHistory();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete quotation.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    }
  };

  // User Actions
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim() || !userRole) return;
    if (!editingUser && !userPassword) {
      setError('Password is required for new users.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let response;
      const body = {
        name: userName,
        email: userEmail,
        role: userRole
      };
      if (userPassword) {
        body.password = userPassword;
      }

      if (editingUser) {
        response = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      } else {
        response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      }

      const data = await response.json();
      if (response.ok) {
        setSuccess(editingUser ? 'User updated successfully!' : 'User added successfully!');
        setUserName('');
        setUserEmail('');
        setUserPassword('');
        setUserRole('user');
        setEditingUser(null);
        fetchUsers();
      } else {
        setError(data.error || 'Operation failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSuccess('User deleted successfully.');
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    }
  };

  // 1. Companies Actions
  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let response;
      if (editingCompany) {
        response = await fetch(`/api/admin/companies/${editingCompany.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: companyName })
        });
      } else {
        response = await fetch('/api/admin/companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: companyName })
        });
      }

      const data = await response.json();
      if (response.ok) {
        setSuccess(editingCompany ? 'Company updated successfully!' : 'Company added successfully!');
        setCompanyName('');
        setEditingCompany(null);
        fetchCompanies();
      } else {
        setError(data.error || 'Operation failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyDelete = async (id) => {
    if (!window.confirm('Warning: Deleting a company will also delete all its panel options and prices. Proceed?')) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/companies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSuccess('Company deleted successfully.');
        fetchCompanies();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete company.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    }
  };

  // 2. Options & Pricing Actions
  const handleOptionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompanyId || !wattSize || !price) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let response;
      if (editingOption) {
        response = await fetch(`/api/admin/panel-options/${editingOption.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            watt_size: wattSize,
            price: price
          })
        });
      } else {
        response = await fetch('/api/admin/panel-options', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            company_id: selectedCompanyId,
            watt_size: wattSize,
            price: price
          })
        });
      }

      const data = await response.json();
      if (response.ok) {
        setSuccess(editingOption ? 'Pricing updated successfully!' : 'Watt size & price added successfully!');
        setWattSize('');
        setPrice('');
        setSelectedCompanyId('');
        setEditingOption(null);
        fetchOptions();
      } else {
        setError(data.error || 'Operation failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionDelete = async (id) => {
    if (!window.confirm('Delete this panel option & pricing?')) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/panel-options/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSuccess('Panel option deleted successfully.');
        fetchOptions();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete option.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    }
  };

  // 3. Assumptions Actions
  const handleAssumptionsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/assumptions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(assumptions)
      });

      if (response.ok) {
        setSuccess('Calculation assumptions saved successfully!');
        fetchAssumptions();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save assumptions.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssumptionsChange = (field, val) => {
    setAssumptions(prev => ({
      ...prev,
      [field]: parseFloat(val) || 0
    }));
  };

  // 4. Quotation PDF Actions
  const viewPdf = async (id) => {
    // Pre-open the window immediately to bypass popup blocker
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('<p style="font-family: sans-serif; color: #475569; padding: 20px;">Generating Roshni Solar quotation PDF proposal... Please wait.</p>');
    }

    try {
      const response = await fetch(`/api/quotations/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (newWindow) {
          newWindow.location.href = url;
        }
      } else {
        if (newWindow) newWindow.close();
        alert('Failed to generate PDF quotation.');
      }
    } catch (err) {
      console.error(err);
      if (newWindow) newWindow.close();
      alert('Error fetching PDF.');
    }
  };

  const downloadPdf = async (id, name) => {
    try {
      const response = await fetch(`/api/quotations/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Quotation_${name.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Failed to fetch PDF.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '800' }}>
            Admin <span className="gradient-text">Settings Dashboard</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '15px', marginTop: '6px' }}>
            Manage solar companies, watt sizes, pricing models, and review historical quotations.
          </p>
        </div>
      </div>

      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Quotations Audit
        </button>
        <button 
          className={`tab-btn ${activeTab === 'companies' ? 'active' : ''}`}
          onClick={() => setActiveTab('companies')}
        >
          Solar Companies
        </button>
        <button 
          className={`tab-btn ${activeTab === 'options' ? 'active' : ''}`}
          onClick={() => setActiveTab('options')}
        >
          Wattages & Prices
        </button>
        <button 
          className={`tab-btn ${activeTab === 'assumptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('assumptions')}
        >
          System Assumptions
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Accounts
        </button>
      </div>

      {error && (
        <div className="alert-box alert-danger">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert-box alert-success">
          <span>{success}</span>
        </div>
      )}

      {/* --- TAB CONTENT: HISTORY --- */}
      {activeTab === 'history' && (
        <div className="glass-card">
          <div className="search-bar-container">
            <div className="search-bar">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search quotations by customer name, brand, or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer Name</th>
                  <th>Date</th>
                  <th>kW Requested</th>
                  <th>Final Capacity</th>
                  <th>Solar Panel</th>
                  <th>Total Cost</th>
                  <th>Effective Cost</th>
                  <th>Created By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? (
                  history.map((q) => (
                    <tr key={q.id}>
                      <td>#{q.id}</td>
                      <td style={{ fontWeight: '600' }}>{q.customer_name}</td>
                      <td>{q.date.split('-').reverse().join('-')}</td>
                      <td>{q.kw_required} kW</td>
                      <td>{q.computed.actual_kw} kW</td>
                      <td>{q.company_name} ({q.watt_size}W, {q.computed.panel_count} pcs)</td>
                      <td style={{ color: '#60a5fa' }}>₹{Math.round(q.computed.net_payable).toLocaleString('en-IN')}</td>
                      <td style={{ color: '#34d399', fontWeight: '600' }}>₹{Math.round(q.computed.cost_after_subsidy).toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: '13px', color: '#94a3b8' }}>{q.creator_name}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button onClick={() => viewPdf(q.id)} className="btn-icon" title="View PDF inline">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => downloadPdf(q.id, q.customer_name)} className="btn-icon edit" title="Download PDF file">
                            <Download size={15} />
                          </button>
                          <button onClick={() => handleQuotationDelete(q.id)} className="btn-icon delete" title="Delete quotation permanently">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan="10" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>
                      No quotations found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: COMPANIES --- */}
      {activeTab === 'companies' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Registered Companies</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Company Name</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td style={{ fontWeight: '600' }}>{c.name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => {
                            setEditingCompany(c);
                            setCompanyName(c.name);
                          }} 
                          className="btn-icon edit" 
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleCompanyDelete(c.id)} 
                          className="btn-icon delete" 
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card">
            <div className="form-card-header">
              <h3 style={{ fontSize: '16px' }}>{editingCompany ? 'Edit Company Name' : 'Register New Company'}</h3>
              {editingCompany && (
                <button 
                  onClick={() => {
                    setEditingCompany(null);
                    setCompanyName('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleCompanySubmit}>
              <div className="form-group">
                <label>Company / Brand Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Waaree" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {editingCompany ? 'Save Changes' : 'Add Company'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: OPTIONS & PRICING --- */}
      {activeTab === 'options' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Panel Pricing & Specification Options</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Company</th>
                    <th>Watt Size</th>
                    <th>Price Per Panel</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td style={{ fontWeight: '500' }}>{o.company_name}</td>
                      <td>{o.watt_size}W</td>
                      <td style={{ color: '#10b981', fontWeight: '600' }}>₹{o.price.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => {
                              setEditingOption(o);
                              setSelectedCompanyId(o.company_id);
                              setWattSize(o.watt_size);
                              setPrice(o.price);
                            }} 
                            className="btn-icon edit" 
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleOptionDelete(o.id)} 
                            className="btn-icon delete" 
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card">
            <div className="form-card-header">
              <h3 style={{ fontSize: '16px' }}>{editingOption ? 'Edit Panel Pricing' : 'Add Panel Size & Price'}</h3>
              {editingOption && (
                <button 
                  onClick={() => {
                    setEditingOption(null);
                    setSelectedCompanyId('');
                    setWattSize('');
                    setPrice('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleOptionSubmit}>
              <div className="form-group">
                <label>Company / Brand</label>
                <select 
                  className="form-control"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  disabled={!!editingOption}
                  required
                >
                  <option value="">-- Select Company --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Panel Size in Watts</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="e.g. 540" 
                  value={wattSize}
                  onChange={(e) => setWattSize(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Price per Panel (₹)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="e.g. 28250" 
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {editingOption ? 'Save Changes' : 'Add Option'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: ASSUMPTIONS --- */}
      {activeTab === 'assumptions' && (
        <form onSubmit={handleAssumptionsSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '25px' }}>
            <div className="glass-card">
              <h3 style={{ fontSize: '16px', marginBottom: '20px', color: '#60a5fa' }}>Calculation Assumptions</h3>
              
              <div className="form-group">
                <label>Generation per kW per Year (units)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={assumptions.generation_per_kw_per_year}
                  onChange={(e) => handleAssumptionsChange('generation_per_kw_per_year', e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Template default: 1500 units/kW/year</span>
              </div>

              <div className="form-group">
                <label>Average Tariff cost per Unit (₹)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control" 
                  value={assumptions.cost_per_unit}
                  onChange={(e) => handleAssumptionsChange('cost_per_unit', e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Template default: ₹8.5 / unit</span>
              </div>

              <div className="form-group">
                <label>Area required per kW (sq.ft)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control" 
                  value={assumptions.area_per_kw}
                  onChange={(e) => handleAssumptionsChange('area_per_kw', e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Template default: ~67.13 sq.ft/kW (e.g. 290sq.ft for 4.32kW)</span>
              </div>
            </div>

            <div className="glass-card">
              <h3 style={{ fontSize: '16px', marginBottom: '20px', color: '#f43f5e' }}>Subsidy Slabs Settings</h3>

              <div className="form-group">
                <label>Subsidy Tier 1 Rate (₹/kW)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={assumptions.subsidy_tier1_rate}
                  onChange={(e) => handleAssumptionsChange('subsidy_tier1_rate', e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Default: ₹30,000 / kW</span>
              </div>

              <div className="form-group">
                <label>Subsidy Tier 1 Limit (kW)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={assumptions.subsidy_tier1_kw}
                  onChange={(e) => handleAssumptionsChange('subsidy_tier1_kw', e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Default: up to 2 kW</span>
              </div>

              <div className="form-group">
                <label>Subsidy Tier 2 Rate (₹/kW)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={assumptions.subsidy_tier2_rate}
                  onChange={(e) => handleAssumptionsChange('subsidy_tier2_rate', e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Default: ₹18,000 / kW</span>
              </div>

              <div className="form-group">
                <label>Max Central Subsidy Cap (₹)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={assumptions.subsidy_cap}
                  onChange={(e) => handleAssumptionsChange('subsidy_cap', e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Default: ₹78,000 max subsidy</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button type="submit" className="btn btn-success" disabled={loading} style={{ padding: '12px 35px' }}>
              <Save size={16} /> Save Settings & Assumptions
            </button>
          </div>
        </form>
      )}

      {/* --- TAB CONTENT: USERS MANAGEMENT --- */}
      {activeTab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Registered Accounts</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>#{u.id}</td>
                      <td style={{ fontWeight: '600' }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{ 
                          background: u.role === 'admin' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.06)',
                          color: u.role === 'admin' ? '#60a5fa' : '#94a3b8',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => {
                              setEditingUser(u);
                              setUserName(u.name);
                              setUserEmail(u.email);
                              setUserRole(u.role);
                              setUserPassword('');
                            }} 
                            className="btn-icon edit" 
                            title="Edit User"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleUserDelete(u.id)} 
                            className="btn-icon delete" 
                            title="Delete User"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card">
            <div className="form-card-header">
              <h3 style={{ fontSize: '16px' }}>{editingUser ? 'Edit User Details' : 'Create New Account'}</h3>
              {editingUser && (
                <button 
                  onClick={() => {
                    setEditingUser(null);
                    setUserName('');
                    setUserEmail('');
                    setUserRole('user');
                    setUserPassword('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Amit Patel" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="e.g. amit@roshnisolar.in" 
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password {editingUser && <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(Leave empty to keep current)</span>}</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder={editingUser ? "••••••••" : "Enter password"}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required={!editingUser}
                />
              </div>
              <div className="form-group">
                <label>Access Role</label>
                <select 
                  className="form-control"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  required
                >
                  <option value="user">User (Data Entry only)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {editingUser ? 'Save Account Details' : 'Register Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
