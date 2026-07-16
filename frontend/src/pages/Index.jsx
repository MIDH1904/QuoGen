import React, { useState, useEffect } from 'react';
import { FileText, Download, Sparkles, AlertCircle } from 'lucide-react';

export default function Index({ token, user }) {
  const [customerName, setCustomerName] = useState('');
  const [kwRequired, setKwRequired] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [options, setOptions] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [quotationId, setQuotationId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [computedData, setComputedData] = useState(null);

  // Load companies on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Load options when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      fetchOptions(selectedCompanyId);
    } else {
      setOptions([]);
      setSelectedOptionId('');
    }
  }, [selectedCompanyId]);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchOptions = async (companyId) => {
    try {
      const response = await fetch(`/api/companies/${companyId}/options`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setOptions(data);
        // Automatically select the first option if available
        if (data.length > 0) {
          setSelectedOptionId(data[0].id);
        } else {
          setSelectedOptionId('');
        }
      }
    } catch (err) {
      console.error('Error fetching panel options:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName || !kwRequired || !selectedCompanyId || !selectedOptionId) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_name: customerName,
          kw_required: kwRequired,
          company_id: selectedCompanyId,
          panel_option_id: selectedOptionId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Quotation generated successfully!');
        setQuotationId(data.quotationId);
        setComputedData(data.computed);
        // Load the PDF Blob URL
        await fetchPdfBlob(data.quotationId);
      } else {
        setError(data.error || 'Failed to generate quotation.');
      }
    } catch (err) {
      console.error('Submit quotation error:', err);
      setError('Connection error. Failed to save quotation.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPdfBlob = async (qId) => {
    try {
      const response = await fetch(`/api/quotations/${qId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        setError('Generated quotation record created, but PDF rendering failed.');
      }
    } catch (err) {
      console.error('PDF fetch error:', err);
      setError('Failed to load PDF file.');
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Quotation_${customerName.trim().replace(/\s+/g, '_')}_${kwRequired}kW.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-container">
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800' }}>
          Solar Rooftop <span className="gradient-text">Quotation Creator</span>
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', marginTop: '6px' }}>
          Enter customer details and solar capacity below to generate a pixel-consistent A4 PDF.
        </p>
      </div>

      <div className="data-entry-layout">
        {/* Left Side: Data Entry Form */}
        <div className="glass-card">
          <h3 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#3b82f6" /> Enter Quotation Details
          </h3>

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

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="customerName">Customer Name</label>
              <input
                id="customerName"
                type="text"
                className="form-control"
                placeholder="e.g. Rajesh Kumar"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="kwRequired">kW Required</label>
              <input
                id="kwRequired"
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 4.32"
                value={kwRequired}
                onChange={(e) => setKwRequired(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="company">Panel Company</label>
              <select
                id="company"
                className="form-control"
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedOptionId('');
                }}
                disabled={loading}
                required
              >
                <option value="">-- Select Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="wattSize">Panel Size (Watts)</label>
              <select
                id="wattSize"
                className="form-control"
                value={selectedOptionId}
                onChange={(e) => setSelectedOptionId(e.target.value)}
                disabled={loading || !selectedCompanyId}
                required
              >
                <option value="">-- Select Size --</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.watt_size}W - (Rs. {o.price.toLocaleString('en-IN')}/panel)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '15px' }}
              disabled={loading}
            >
              {loading ? (
                <>Generating PDF...</>
              ) : (
                <>
                  <Sparkles size={16} /> Generate Proposal
                </>
              )}
            </button>
          </form>

          {computedData && (
            <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '13.5px' }}>
              <h4 style={{ color: '#94a3b8', marginBottom: '12px' }}>Calculation Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Solar Panels Required:</span>
                  <span style={{ fontWeight: '600' }}>{computedData.panel_count} Panels</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Actual Solar plant Size:</span>
                  <span style={{ fontWeight: '600' }}>{computedData.actual_kw} kW</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Net Cost (Pre-subsidy):</span>
                  <span style={{ fontWeight: '600' }}>₹{Math.round(computedData.net_payable).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Govt. Subsidy:</span>
                  <span style={{ fontWeight: '600', color: '#f43f5e' }}>₹{Math.round(computedData.subsidy).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Cost after Subsidy:</span>
                  <span style={{ fontWeight: '600', color: '#10b981' }}>₹{Math.round(computedData.cost_after_subsidy).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payback Period:</span>
                  <span style={{ fontWeight: '600', color: '#3b82f6' }}>Approx. {computedData.payback_years} Years</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: PDF Preview */}
        <div className="glass-card pdf-preview-box">
          {pdfUrl ? (
            <>
              <iframe
                title="Quotation PDF Preview"
                src={`${pdfUrl}#toolbar=0`}
                className="pdf-viewer-iframe"
              />
              <div className="pdf-actions">
                <span style={{ fontSize: '13.5px', color: '#94a3b8' }}>
                  A4 Fixed PDF Layout Generated
                </span>
                <button onClick={handleDownload} className="btn btn-success">
                  <Download size={16} /> Download PDF
                </button>
              </div>
            </>
          ) : (
            <div className="pdf-placeholder">
              <FileText size={54} />
              <h4 style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '8px' }}>
                Quotation Preview Area
              </h4>
              <p style={{ color: '#64748b', maxWidth: '300px', fontSize: '13px', margin: '0 auto' }}>
                Fill in the inputs on the left and click "Generate Proposal" to render the quote.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
