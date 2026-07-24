const puppeteerCore = require('puppeteer-core');
const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;

let puppeteer;
let chromium;

if (isVercel) {
  puppeteer = puppeteerCore;
  // Dynamically set AWS_LAMBDA_JS_RUNTIME on Vercel to ensure @sparticuz/chromium detects AL2023 compatibility
  if (!process.env.AWS_LAMBDA_JS_RUNTIME) {
    const nodeMajor = process.version.split('.')[0].slice(1);
    process.env.AWS_LAMBDA_JS_RUNTIME = `nodejs${nodeMajor}.x`;
  }
  chromium = require('@sparticuz/chromium');
} else {
  puppeteer = require('puppeteer');
}

function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0/-';
  return 'Rs. ' + Math.round(val).toLocaleString('en-IN') + '/-';
}

function getFiscalYear(dateStr) {
  // e.g. "2026-07-16" -> fiscal year "2026-27"
  try {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    // Fiscal year starts in April (month >= 4)
    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  } catch (e) {
    return "2026-27";
  }
}

async function generateQuotationPdf(data) {
  const {
    customer_name,
    date,
    kw_required,
    company_name,
    watt_size,
    computed // containing calculated values
  } = data;

  const fiscalYear = getFiscalYear(date);
  const formattedDate = date.split('-').reverse().join('-'); // "YYYY-MM-DD" -> "DD-MM-YYYY"

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Roshni Solar Quotation</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    @page {
      size: A4;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
      color: #1e293b;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      height: 297mm;
      box-sizing: border-box;
      position: relative;
      page-break-after: always;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #ffffff;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* Branded Header Band */
    .header-container {
      position: relative;
      width: 100%;
    }

    .header-logo-text {
      position: absolute;
      top: 25px;
      left: 45px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 10;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      fill: #ffaa00;
    }

    .brand-title {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 1px;
      margin: 0;
    }

    .brand-subtitle {
      font-size: 11px;
      font-weight: 400;
      color: #e2e8f0;
      margin: 0;
      letter-spacing: 0.5px;
      margin-top: -2px;
    }

    .header-svg {
      display: block;
      width: 100%;
      height: 110px;
    }

    /* Page Content Padding */
    .content {
      padding: 10px 45px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* Page Footer Band */
    .footer-container {
      position: relative;
      width: 100%;
      margin-top: auto;
    }

    .footer-svg {
      display: block;
      width: 100%;
      height: 80px;
    }

    .footer-text-block {
      position: absolute;
      bottom: 12px;
      left: 0;
      right: 0;
      text-align: center;
      color: #ffffff;
      font-size: 11px;
      line-height: 1.5;
      z-index: 10;
      font-weight: 400;
    }

    /* Typography & Layout elements */
    h1, h2, h3 {
      color: #0f172a;
      margin: 0 0 10px 0;
    }

    p {
      margin: 0 0 12px 0;
      line-height: 1.5;
      font-size: 12px;
      text-align: justify;
    }

    .meta-table {
      width: 100%;
      margin-bottom: 15px;
      border-collapse: collapse;
    }

    .meta-table td {
      padding: 3px 0;
      font-size: 12px;
      vertical-align: top;
    }

    .meta-label {
      font-weight: 600;
      width: 130px;
      color: #475569;
    }

    .meta-value {
      color: #0f172a;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 3px;
      margin-top: 15px;
      margin-bottom: 10px;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Standard Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 15px 0;
    }

    .data-table th, .data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      font-size: 11px;
      text-align: left;
      vertical-align: middle;
    }

    .data-table th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 600;
    }

    .table-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e3a8a;
      margin-top: 10px;
      margin-bottom: 5px;
    }

    .footnote {
      font-size: 10px;
      color: #64748b;
      font-style: italic;
      margin-top: -5px;
      margin-bottom: 15px;
    }

    .terms-block {
      background: #f8fafc;
      border-left: 3px solid #3b82f6;
      padding: 10px 15px;
      margin-bottom: 15px;
    }

    .terms-block h3 {
      font-size: 12px;
      margin: 0 0 5px 0;
      color: #1e3a8a;
    }

    .terms-block ol {
      margin: 0;
      padding-left: 15px;
      font-size: 10.5px;
      color: #334155;
    }

    .terms-block li {
      margin-bottom: 4px;
    }

    .bank-block {
      border: 1px dashed #cbd5e1;
      padding: 10px 15px;
      font-size: 11px;
      line-height: 1.5;
      background: #fdfdfd;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .bank-info {
      flex: 1;
    }

    .bank-info strong {
      color: #1e3a8a;
    }

    .signature-area {
      text-align: right;
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
      width: 200px;
    }

    .signature-space {
      height: 40px;
    }
  </style>
</head>
<body>

  <!-- ================= PAGE 1 ================= -->
  <div class="page">
    <div class="header-container">
      <div class="header-logo-text">
        <svg class="logo-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>
          <h1 class="brand-title">ROSHNISOLAR</h1>
          <div class="brand-subtitle">Green-Clean Smart</div>
        </div>
      </div>
      <svg class="header-svg" viewBox="0 0 1000 110" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,0 L1000,0 L1000,60 C900,30 800,90 600,45 C400,0 200,105 0,37 Z" fill="#1e3a8a"/>
        <path d="M0,0 L1000,0 L1000,45 C900,22 800,67 600,33 C400,0 200,75 0,30 Z" fill="#10b981" opacity="0.8"/>
        <path d="M0,0 L1000,0 L1000,30 C900,15 800,45 600,22 C400,0 200,52 0,22 Z" fill="#f59e0b" opacity="0.6"/>
        <path d="M0,0 L1000,0 L1000,15 C900,7 800,22 600,11 C400,0 200,30 0,15 Z" fill="#ef4444" opacity="0.4"/>
      </svg>
    </div>

    <div class="content">
      <table class="meta-table" style="margin-top: 15px;">
        <tr>
          <td class="meta-label">To. Dear Sir</td>
          <td class="meta-value" style="text-align: right; font-weight: 500;">DATE: ${formattedDate}</td>
        </tr>
        <tr>
          <td class="meta-label">VADODARA.</td>
          <td></td>
        </tr>
        <tr>
          <td class="meta-label">Dear Sir,</td>
          <td></td>
        </tr>
        <tr>
          <td colspan="2" style="font-size: 11px; padding: 2px 0; color: #475569; font-style: italic;">
            All Kind of Roof Top Power System, Solar Panels, Solar Water Heater, Solar Street Light Etc.
          </td>
        </tr>
        <tr>
          <td class="meta-label">NAME -</td>
          <td class="meta-value" style="font-weight: 700; color: #1e3a8a;">${customer_name}</td>
        </tr>
        <tr>
          <td class="meta-label">Sub:</td>
          <td class="meta-value" style="font-weight: 600;">
            Quotation for ${kw_required}kw Solar Rooftop System for ${fiscalYear}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="font-size: 10px; font-weight: 700; color: #ef4444;">
            (THIS QUOTATION IS BASED ON THE 2023-24 SOLAR RATES (NORMS))
          </td>
        </tr>
        <tr>
          <td class="meta-label">ADD-</td>
          <td class="meta-value">B 23 VAIKUNTHDHAM TENAMEN, NR.AIR FORCE M PURA ROAD,</td>
        </tr>
      </table>

      <p style="margin-top: 10px;">
        At the beginning, we would like to express our sincere thanks to you, for providing us an opportunity to submit our proposal on the subject matter. ROSHNI ENTERPRISE is an energy solution provider since 2012. We are Authorized Dealers for waaree and we provide solutions in entire solar spectrum from concept to commissioning (C2C cycle) for EPC of on grid connected solar PV plants in Utility and kW scale, Rooftop solar systems, Solar PV equipment like, solar street lights, solar lanterns, solar water heaters, solar air heaters, solar desalination etc.
      </p>

      <div class="section-title">INTRODUCTION</div>
      <p>
        India has an abundance of sunshine and the trend of depletion of fossil fuels is compelling Energy Plan rest examine the feasibility of using renewable source of energy like Solar, Wind etc. We have been active in the field of Solar Photovoltaic (SPV) and is in a position to set MW scale SPV Power Plants. This writes up describes a typical Solar Grid Connect Rooftop Power Plant for captive consumption.
      </p>

      <div class="section-title">SYSTEM CONCEPT</div>
      <p style="margin-bottom: 5px;">
        The Photo voltaic (PV) Grid Tied system consists of mainly of 3 components:
      </p>
      <p style="margin-bottom: 5px; padding-left: 15px; text-indent: -15px;">
        • The Crystal line Silicon PV array<br>
        • Solar Inverter (Power Conditioning Unit)<br>
        • BOS like MMS, AJB, MJB, ACDB, Cables, and Hardware, Earthling & Lighting kit
      </p>
      <p>
        Crystal line silicon Modules are of high-Power density & will convert Sun Light into Electricity. The power generated by the Solar array needs to be 'conditioned' in respect of voltage, phase and frequency to make it Grid – Tied. The Power Conditioning Unit used in grid connected SPV systems consist of Inverter and other electronics for MPPT, Synchronization and remote monitoring. The Module mounting structure with suitable tilt angle for optimized annual is used to hold the module in position.
      </p>
      <p>
        The electrical power generated by the PV array is fed into the load. If the load demand is more than the SPV generation, the balance between SPV power and demand of power at the load end is met by drawing it from the grid. When the load is below the solar generation, excess SPV power will be fed to the grid line. The Solar Grid connect system works in synchronization with the Grid power and essentially need the grid supply. In case of Grid power failure, the system shall automatically shut down preventing the solar power fed back in to the non-active grid line as per the safety norms of electricity act. As the system is Grid tied, necessary permissions from local DISCOM are required for the SPV power evacuation.
      </p>
    </div>

    <div class="footer-container">
      <svg class="footer-svg" viewBox="0 0 1000 80" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,80 L1000,80 L1000,30 C900,60 700,10 500,55 C300,10 100,50 0,25 Z" fill="#1e3a8a"/>
        <path d="M0,80 L1000,80 L1000,38 C900,64 700,18 500,59 C300,18 100,54 0,33 Z" fill="#10b981" opacity="0.8"/>
        <path d="M0,80 L1000,80 L1000,45 C900,68 700,25 500,63 C300,25 100,58 0,40 Z" fill="#f59e0b" opacity="0.6"/>
        <path d="M0,80 L1000,80 L1000,52 C900,72 700,32 500,67 C300,32 100,62 0,48 Z" fill="#ef4444" opacity="0.4"/>
      </svg>
      <div class="footer-text-block">
        B-3, Rishikesh Soc., Opp Novino Company, Makarpura Main Road, Vadodara. M.: 9227104121.<br>
        Email: resolar44@gmail.com &nbsp;&nbsp; www.roshnisolar.in
      </div>
    </div>
  </div>

  <!-- ================= PAGE 2 ================= -->
  <div class="page">
    <div class="header-container">
      <div class="header-logo-text">
        <svg class="logo-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>
          <h1 class="brand-title">ROSHNISOLAR</h1>
          <div class="brand-subtitle">Green-Clean Smart</div>
        </div>
      </div>
      <svg class="header-svg" viewBox="0 0 1000 110" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,0 L1000,0 L1000,60 C900,30 800,90 600,45 C400,0 200,105 0,37 Z" fill="#1e3a8a"/>
        <path d="M0,0 L1000,0 L1000,45 C900,22 800,67 600,33 C400,0 200,75 0,30 Z" fill="#10b981" opacity="0.8"/>
        <path d="M0,0 L1000,0 L1000,30 C900,15 800,45 600,22 C400,0 200,52 0,22 Z" fill="#f59e0b" opacity="0.6"/>
        <path d="M0,0 L1000,0 L1000,15 C900,7 800,22 600,11 C400,0 200,30 0,15 Z" fill="#ef4444" opacity="0.4"/>
      </svg>
    </div>

    <div class="content">
      <div style="font-size: 13px; font-weight: 500; margin-top: 15px; color: #334155;">
        Following are the required project details for your requirement:
      </div>
      <div class="section-title" style="margin-top: 5px;">Commercial Proposal:</div>

      <div class="table-title">Table 1: Technical Specifications</div>
      <table class="data-table">
        <tr>
          <th style="width: 40%;">Field</th>
          <th style="width: 60%;">Value</th>
        </tr>
        <tr>
          <td>Solar plant type</td>
          <td>On Grid (Grid Tied) System</td>
        </tr>
        <tr>
          <td>Solar Plant Size</td>
          <td style="font-weight: 600;">${computed.actual_kw}kw</td>
        </tr>
        <tr>
          <td>Solar Module — PANEL Make</td>
          <td>${company_name} [india's top leading panal company]</td>
        </tr>
        <tr>
          <td>Solar Module — Size & Type</td>
          <td>${watt_size}W BIFACIAL, ${computed.panel_count} Panels</td>
        </tr>
        <tr>
          <td>Solar Module — Panel Performance Warranty</td>
          <td>30 Years</td>
        </tr>
        <tr>
          <td>Solar Module — System warranty</td>
          <td>05 Years</td>
        </tr>
        <tr>
          <td>Inverter</td>
          <td>UTL, SOLARYAN, V-sole, Mindra (India's Most Preferred Solar Inverter Brand) 10 Years WARRANTY</td>
        </tr>
        <tr>
          <td>Mounting Structure</td>
          <td>Elegant 40*80*2mm & 40*40*2mm, Hot Dip Galvanized, APOLLO</td>
        </tr>
        <tr>
          <td>Cable</td>
          <td>Polycab</td>
        </tr>
        <tr>
          <td>Earthing</td>
          <td>As per Govt. Tender E-LINK</td>
        </tr>
        <tr>
          <td>Lightning Arrester</td>
          <td>As per Govt. Tender E-LINK</td>
        </tr>
        <tr>
          <td>ACDB/DCDB</td>
          <td>MCB-HAVELLS, SPD ELMEX</td>
        </tr>
        <tr>
          <td>Maintenance</td>
          <td>5 Years Comprehensive Maintenance for complete system</td>
        </tr>
      </table>

      <div class="table-title">Table 2: Commercial Quotation</div>
      <table class="data-table" style="margin-bottom: 5px;">
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 70%;">Description</th>
          <th style="width: 25%; text-align: right;">Amount</th>
        </tr>
        <tr>
          <td style="text-align: center;">1</td>
          <td style="line-height: 1.4;">
            <strong>NET PAYABLE AMOUNT</strong><br>
            <span style="font-size: 10px; color: #475569;">
              (With standard elevated structure. Includes Subsidy, Installation, Testing & Commissioning of Solar Power Plant, GEDA Registration fees, Discom TFR charges for connectivity included as per (RS.2950), Net Meter, Solar Meter, QCT, Modem and testing charge)
            </span>
          </td>
          <td style="text-align: right; font-weight: 700; font-size: 12px; color: #1e3a8a;">
            ${formatCurrency(computed.net_payable)}
          </td>
        </tr>
        <tr>
          <td style="text-align: center;">2</td>
          <td style="line-height: 1.4;">
            <strong>Elevated Structure</strong><br>
            <span style="font-size: 10px; color: #475569;">
              Lower part of south side 2 meter (6-7ft), higher part of north side (9-10ft) with legs, rafter 40*80*2mm, and purlin 40*40*2mm with hot dip galvanize with RCC work.
            </span>
          </td>
          <td style="text-align: right; font-weight: 600; color: #10b981;">
            FREE
          </td>
        </tr>
        <tr>
          <td style="text-align: center;">3</td>
          <td style="line-height: 1.4;">
            <strong>Subsidy from Central Govt.</strong><br>
            <span style="font-size: 10px; color: #475569;">
              Rs. 30,000/- per kW up to 2 kW, Rs. 18,000/- per kW for additional capacity up to 3 kW. Total Subsidy for systems larger than 3 kW capped at Rs 78,000
            </span>
          </td>
          <td style="text-align: right; font-weight: 700; color: #ef4444;">
            ${formatCurrency(computed.subsidy)}
          </td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="text-align: center;">4</td>
          <td style="line-height: 1.4;">
            <strong>COST AFTER DEDUCTING SUBSIDY</strong><br>
            <span style="font-size: 10px; color: #475569;">
              Rs.30000/- Per Kw Up To 2KW, Rs.18000/- Per Kw for Additional Capacity Up To 3kw. Total Subsidy for Systems Larger Than 3kw Capped at Rs 78000. EFFECTIVE COST.
            </span>
          </td>
          <td style="text-align: right; font-weight: 800; font-size: 13px; color: #1e3a8a; background: #e0f2fe;">
            ${formatCurrency(computed.cost_after_subsidy)}
          </td>
        </tr>
      </table>
      <div class="footnote">
        This system rate based on 540 W solar panel, If panel rating change (During Purchasing) then System rate also change based on panel rating (If panel rating increase then total system cost increase and if decrease then total system cost decrease).
      </div>
    </div>

    <div class="footer-container">
      <svg class="footer-svg" viewBox="0 0 1000 80" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,80 L1000,80 L1000,30 C900,60 700,10 500,55 C300,10 100,50 0,25 Z" fill="#1e3a8a"/>
        <path d="M0,80 L1000,80 L1000,38 C900,64 700,18 500,59 C300,18 100,54 0,33 Z" fill="#10b981" opacity="0.8"/>
        <path d="M0,80 L1000,80 L1000,45 C900,68 700,25 500,63 C300,25 100,58 0,40 Z" fill="#f59e0b" opacity="0.6"/>
        <path d="M0,80 L1000,80 L1000,52 C900,72 700,32 500,67 C300,32 100,62 0,48 Z" fill="#ef4444" opacity="0.4"/>
      </svg>
      <div class="footer-text-block">
        B-3, Rishikesh Soc., Opp Novino Company, Makarpura Main Road, Vadodara. M.: 9227104121.<br>
        Email: resolar4@gmail.com &nbsp;&nbsp; www.roshnisolar.in
      </div>
    </div>
  </div>

  <!-- ================= PAGE 3 ================= -->
  <div class="page">
    <div class="header-container">
      <div class="header-logo-text">
        <svg class="logo-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>
          <h1 class="brand-title">ROSHNISOLAR</h1>
          <div class="brand-subtitle">Green-Clean Smart</div>
        </div>
      </div>
      <svg class="header-svg" viewBox="0 0 1000 110" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,0 L1000,0 L1000,60 C900,30 800,90 600,45 C400,0 200,105 0,37 Z" fill="#1e3a8a"/>
        <path d="M0,0 L1000,0 L1000,45 C900,22 800,67 600,33 C400,0 200,75 0,30 Z" fill="#10b981" opacity="0.8"/>
        <path d="M0,0 L1000,0 L1000,30 C900,15 800,45 600,22 C400,0 200,52 0,22 Z" fill="#f59e0b" opacity="0.6"/>
        <path d="M0,0 L1000,0 L1000,15 C900,7 800,22 600,11 C400,0 200,30 0,15 Z" fill="#ef4444" opacity="0.4"/>
      </svg>
    </div>

    <div class="content">
      <div class="table-title" style="margin-top: 15px;">Table 3: Estimated Savings & Payback</div>
      <table class="data-table">
        <tr>
          <th style="width: 40%;">Label</th>
          <th style="width: 35%;">Working</th>
          <th style="width: 25%; text-align: right;">Value</th>
        </tr>
        <tr>
          <td>Generation per year/Kw</td>
          <td></td>
          <td style="text-align: right;">${computed.generation_per_kw} Unit</td>
        </tr>
        <tr>
          <td>Generation for complete System</td>
          <td>${computed.generation_per_kw} x ${computed.actual_kw}Kw</td>
          <td style="text-align: right; font-weight: 600;">${Math.round(computed.annual_generation).toLocaleString('en-IN')} Unit</td>
        </tr>
        <tr>
          <td>Average Cost per unit</td>
          <td>Rs.${computed.cost_per_unit}*</td>
          <td style="text-align: right;">Rs.${computed.cost_per_unit}*</td>
        </tr>
        <tr>
          <td>Saving against generation/ year</td>
          <td>Rs.${computed.cost_per_unit} x ${Math.round(computed.annual_generation).toLocaleString('en-IN')} Unit</td>
          <td style="text-align: right; font-weight: 700; color: #10b981;">Rs. ${Math.round(computed.annual_saving).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td>Payback period</td>
          <td>${Math.round(computed.cost_after_subsidy).toLocaleString('en-IN')} / ${Math.round(computed.annual_saving).toLocaleString('en-IN')}</td>
          <td style="text-align: right; font-weight: 700; color: #1e3a8a;">Approx. ${computed.payback_years} years</td>
        </tr>
        <tr>
          <td>Area required for installation</td>
          <td></td>
          <td style="text-align: right; font-weight: 600;">${computed.area_required} Sq. Ft</td>
        </tr>
      </table>

      <div class="terms-block">
        <h3>Terms and conditions:</h3>
        <ol>
          <li>Life of Solar System will be 30 Years*</li>
          <li>Performance Warranty of Solar Panel: 90% power output after 10 Years and 80% power output after 30 Years</li>
          <li>Cleaning of Solar Panels will be in client's scope</li>
          <li>Design of solar plant once approved from client won't be altered later. If client wants to amend the design, Charges for the same will be in client's scope.</li>
          <li>Rates are inclusive of GST, Freight, DISCOM charges and five-year free Service.</li>
          <li>Payment Terms: 1st payment 30% of Net Amount, 2nd payment 50%, 3rd payment 20%</li>
          <li>Offer Validity 1 Week from date of offer.</li>
          <li>Maintenance cost in any Natural hazard will be extra.</li>
        </ol>
        <div style="font-size: 10px; color: #64748b; margin-top: 6px; line-height: 1.3;">
          Hope our offer is inline of your requirement. We will be happy or receive your valuable order.
        </div>
      </div>

      <div class="bank-block">
        <div class="bank-info">
          <strong>Bank details:</strong><br>
          NAME - Roshni enterprise<br>
          Bank - HDFC bank<br>
          A/c no - 02518730000081<br>
          IFSC - HDFC0009473<br>
          BRANCH - OMNAGAR, TARSALI, VADODARA.<br>
          GST NO - 24ALEPP4600L1Z6.
        </div>
        <div class="signature-area">
          For ROSHNI ENTERPRISE
          <div class="signature-space"></div>
          <div style="border-top: 1px solid #94a3b8; font-size: 10px; font-weight: 400; color: #64748b; text-align: center; padding-top: 3px;">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>

    <div class="footer-container">
      <svg class="footer-svg" viewBox="0 0 1000 80" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,80 L1000,80 L1000,30 C900,60 700,10 500,55 C300,10 100,50 0,25 Z" fill="#1e3a8a"/>
        <path d="M0,80 L1000,80 L1000,38 C900,64 700,18 500,59 C300,18 100,54 0,33 Z" fill="#10b981" opacity="0.8"/>
        <path d="M0,80 L1000,80 L1000,45 C900,68 700,25 500,63 C300,25 100,58 0,40 Z" fill="#f59e0b" opacity="0.6"/>
        <path d="M0,80 L1000,80 L1000,52 C900,72 700,32 500,67 C300,32 100,62 0,48 Z" fill="#ef4444" opacity="0.4"/>
      </svg>
      <div class="footer-text-block">
        B-3, Rishikesh Soc., Opp Novino Company, Makarpura Main Road, Vadodara. M.: 9227104121.<br>
        Email: resolar44@gmail.com &nbsp;&nbsp; www.roshnisolar.in
      </div>
    </div>
  </div>

</body>
</html>
  `;

  let browser;
  if (isVercel) {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
  } else {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateQuotationPdf
};
