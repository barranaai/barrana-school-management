/**
 * Expense Report Service
 *
 * Aggregations + export rendering for the Expense Reports & Analytics
 * (Phase 2). Pure functions: no Express knowledge — the route layer feeds
 * a scoped query/range and renders the response.
 *
 * Design notes:
 *   • All aggregations honour the multi-tenant schoolId scope built by the
 *     caller (super_admin → all, school_admin → own school).
 *   • `void` records are excluded by default; pass `includeVoid: true` to
 *     include them (e.g. compliance views).
 *   • Money is stored as integer CAD cents on the model. This service
 *     returns major units (decimal CAD) so the frontend never has to know
 *     about the cents trick.
 *   • CSV/PDF rendering live here so the route can stream/return the
 *     output without growing.
 */

const Expense = require('../models/Expense');

const VOID_FILTER = { status: { $ne: 'void' } };

// ─── Money / format helpers ────────────────────────────────────────────

function centsToMajor(c) {
  if (!Number.isFinite(c)) return 0;
  return Math.round(c) / 100;
}

const cadFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
});

function formatCAD(cents) {
  return cadFormatter.format(centsToMajor(cents));
}

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ─── Range / match helpers ─────────────────────────────────────────────

function buildMatch({ baseScope, from, to, includeVoid }) {
  const match = { ...baseScope };
  if (!includeVoid) Object.assign(match, VOID_FILTER);
  if (from || to) {
    match.incurredAt = {};
    if (from) match.incurredAt.$gte = new Date(from);
    if (to) match.incurredAt.$lte = new Date(to);
  }
  return match;
}

// ─── Category labels (mirror frontend so PDFs/CSVs read nicely) ────────

const CATEGORY_LABEL = {
  salaries: 'Salaries & Wages',
  rent: 'Rent & Lease',
  utilities: 'Utilities',
  supplies: 'Supplies',
  food: 'Food & Catering',
  transport: 'Transport',
  maintenance: 'Maintenance',
  software: 'Software & Subscriptions',
  marketing: 'Marketing',
  training: 'Training & Development',
  insurance: 'Insurance',
  taxes: 'Taxes',
  events: 'Events',
  fees: 'Bank/Service Fees',
  other: 'Other',
};

const PAYMENT_LABEL = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  e_transfer: 'e-Transfer',
  other: 'Other',
};

function labelFor(dimension, key) {
  if (dimension === 'category') return CATEGORY_LABEL[key] || key || 'Other';
  if (dimension === 'paymentMethod') return PAYMENT_LABEL[key] || key || 'Other';
  if (dimension === 'taxType') return key || 'OTHER';
  return key;
}

// ─── Summary ───────────────────────────────────────────────────────────

/**
 * High-level KPIs for the Overview page.
 * Returns CAD major units.
 */
async function getSummary({ baseScope, from, to, includeVoid = false }) {
  const match = buildMatch({ baseScope, from, to, includeVoid });
  // Status counts always include void records, regardless of includeVoid flag,
  // so admins can see "X recorded / Y void" even on a non-void summary.
  const matchWithVoids = buildMatch({ baseScope, from, to, includeVoid: true });

  const [agg, byStatus, byPaid] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          taxTotal: { $sum: '$taxTotal' },
          subtotal: { $sum: '$subtotal' },
          count: { $sum: 1 },
          maxTotal: { $max: '$total' },
        },
      },
    ]),
    Expense.aggregate([
      { $match: matchWithVoids },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$isPaid', count: { $sum: 1 }, total: { $sum: '$total' } } },
    ]),
  ]);

  const a = agg[0] || {};
  const total = a.total || 0;
  const count = a.count || 0;

  const statusCounts = byStatus.reduce(
    (acc, x) => ({ ...acc, [x._id || 'unknown']: x.count }),
    {}
  );
  const paid = byPaid.find((x) => x._id === true);
  const unpaid = byPaid.find((x) => x._id !== true);

  return {
    range: { from: from || null, to: to || null },
    currency: 'CAD',
    total: centsToMajor(total),
    subtotal: centsToMajor(a.subtotal || 0),
    taxTotal: centsToMajor(a.taxTotal || 0),
    count,
    avg: count ? centsToMajor(Math.round(total / count)) : 0,
    largest: centsToMajor(a.maxTotal || 0),
    paid: {
      count: paid?.count || 0,
      total: centsToMajor(paid?.total || 0),
    },
    unpaid: {
      count: unpaid?.count || 0,
      total: centsToMajor(unpaid?.total || 0),
    },
    statusCounts,
  };
}

// ─── Group by dimension ────────────────────────────────────────────────

/**
 * Group expenses by a single dimension. Returns rows sorted by total desc.
 *
 * dimension ∈ category | paymentMethod | vendor | taxType | day | week | month | year
 */
async function groupBy({
  baseScope,
  from,
  to,
  dimension,
  includeVoid = false,
  limit = 0,
}) {
  const match = buildMatch({ baseScope, from, to, includeVoid });

  let pipeline;

  if (dimension === 'taxType') {
    // taxes is an array of subdocs — unwind to count each tax type once per record
    pipeline = [
      { $match: match },
      { $unwind: '$taxes' },
      {
        $group: {
          _id: '$taxes.type',
          total: { $sum: '$taxes.amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ];
  } else if (dimension === 'vendor') {
    pipeline = [
      { $match: match },
      {
        $group: {
          _id: { $ifNull: [{ $toLower: '$vendorName' }, '(no vendor)'] },
          displayName: { $first: { $ifNull: ['$vendorName', '(no vendor)'] } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
          lastDate: { $max: '$incurredAt' },
        },
      },
      { $sort: { total: -1 } },
    ];
  } else if (dimension === 'day' || dimension === 'week' || dimension === 'month' || dimension === 'year') {
    const formatBy = {
      day: '%Y-%m-%d',
      week: '%G-W%V', // ISO week
      month: '%Y-%m',
      year: '%Y',
    }[dimension];

    pipeline = [
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: formatBy, date: '$incurredAt', timezone: 'America/Toronto' } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          taxTotal: { $sum: '$taxTotal' },
        },
      },
      { $sort: { _id: 1 } }, // chronological for time-series
    ];
  } else {
    // category | paymentMethod | other plain field
    pipeline = [
      { $match: match },
      {
        $group: {
          _id: `$${dimension}`,
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ];
  }

  if (limit > 0) pipeline.push({ $limit: limit });

  const rows = await Expense.aggregate(pipeline);

  // Compute the grand total once so we can attach % to each row.
  const grandTotal = rows.reduce((sum, r) => sum + (r.total || 0), 0) || 1;

  return rows.map((r) => {
    const isTimeSeries = dimension === 'day' || dimension === 'week' || dimension === 'month' || dimension === 'year';
    const key = r._id == null ? null : r._id;
    return {
      key,
      label:
        dimension === 'vendor'
          ? r.displayName || '(no vendor)'
          : isTimeSeries
            ? key
            : labelFor(dimension, key),
      total: centsToMajor(r.total || 0),
      count: r.count || 0,
      ...(isTimeSeries
        ? {
            subtotal: centsToMajor(r.subtotal || 0),
            taxTotal: centsToMajor(r.taxTotal || 0),
          }
        : {}),
      ...(dimension === 'vendor' && r.lastDate ? { lastDate: r.lastDate } : {}),
      percentage: Math.round(((r.total || 0) / grandTotal) * 1000) / 10, // 1dp
    };
  });
}

// ─── Top vendors ───────────────────────────────────────────────────────

async function getTopVendors({ baseScope, from, to, limit = 10, includeVoid = false }) {
  return groupBy({ baseScope, from, to, dimension: 'vendor', includeVoid, limit });
}

// ─── Tax breakdown ─────────────────────────────────────────────────────

async function getTaxBreakdown({ baseScope, from, to, includeVoid = false }) {
  return groupBy({ baseScope, from, to, dimension: 'taxType', includeVoid });
}

// ─── Raw rows for export ───────────────────────────────────────────────

async function listForExport({ baseScope, from, to, includeVoid = false, filters = {} }) {
  const match = buildMatch({ baseScope, from, to, includeVoid });
  if (filters.category) match.category = filters.category;
  if (filters.paymentMethod) match.paymentMethod = filters.paymentMethod;
  if (filters.status && includeVoid) match.status = filters.status;

  const docs = await Expense.find(match)
    .sort({ incurredAt: -1, createdAt: -1 })
    .populate({ path: 'recordedBy', select: 'firstName lastName' })
    .lean();

  return docs;
}

// ─── CSV export ────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  { key: 'expenseNumber', header: 'Expense #' },
  { key: 'incurredAt', header: 'Date', map: (e) => formatDate(e.incurredAt) },
  { key: 'category', header: 'Category', map: (e) => CATEGORY_LABEL[e.category] || e.category },
  { key: 'subcategory', header: 'Subcategory' },
  { key: 'vendorName', header: 'Vendor' },
  { key: 'description', header: 'Description' },
  { key: 'subtotal', header: 'Subtotal (CAD)', map: (e) => centsToMajor(e.subtotal).toFixed(2) },
  { key: 'taxTotal', header: 'Tax Total (CAD)', map: (e) => centsToMajor(e.taxTotal).toFixed(2) },
  { key: 'total', header: 'Total (CAD)', map: (e) => centsToMajor(e.total).toFixed(2) },
  { key: 'paymentMethod', header: 'Payment Method', map: (e) => PAYMENT_LABEL[e.paymentMethod] || e.paymentMethod || '' },
  { key: 'paymentReference', header: 'Payment Ref' },
  { key: 'isPaid', header: 'Paid', map: (e) => (e.isPaid ? 'Yes' : 'No') },
  { key: 'paidAt', header: 'Paid On', map: (e) => formatDate(e.paidAt) },
  { key: 'status', header: 'Status' },
  {
    key: 'recordedBy',
    header: 'Recorded By',
    map: (e) =>
      e.recordedBy
        ? `${e.recordedBy.firstName || ''} ${e.recordedBy.lastName || ''}`.trim()
        : '',
  },
  { key: 'tags', header: 'Tags', map: (e) => (Array.isArray(e.tags) ? e.tags.join('; ') : '') },
];

function rowsToCsv(rows) {
  const header = CSV_COLUMNS.map((c) => csvEscape(c.header)).join(',');
  const lines = rows.map((e) =>
    CSV_COLUMNS.map((c) => csvEscape(c.map ? c.map(e) : e[c.key])).join(',')
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}

// ─── PDF rendering (HTML → puppeteer) ──────────────────────────────────

function htmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a fully self-contained HTML report. Designed for puppeteer's
 * `setContent` — no external assets needed.
 */
function renderReportHtml({
  schoolName = 'School',
  from,
  to,
  summary,
  byCategory,
  byPaymentMethod,
  topVendors,
  taxBreakdown,
  byMonth,
  rows = [],
  generatedAt = new Date(),
}) {
  const rangeLabel =
    from && to
      ? `${formatDate(from)} → ${formatDate(to)}`
      : from
        ? `Since ${formatDate(from)}`
        : to
          ? `Up to ${formatDate(to)}`
          : 'All time';

  const tableSection = (title, rowsForSection) => {
    if (!rowsForSection || rowsForSection.length === 0) return '';
    return `
      <section class="section">
        <h2>${htmlEscape(title)}</h2>
        <table class="data">
          <thead>
            <tr>
              <th>Group</th>
              <th class="num">Count</th>
              <th class="num">Total (CAD)</th>
              <th class="num">% of Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsForSection
              .map(
                (r) => `
              <tr>
                <td>${htmlEscape(r.label || '—')}</td>
                <td class="num">${r.count}</td>
                <td class="num">$${(r.total || 0).toFixed(2)}</td>
                <td class="num">${(r.percentage || 0).toFixed(1)}%</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </section>
    `;
  };

  const detailRows =
    rows.length === 0
      ? ''
      : `
        <section class="section">
          <h2>Detailed Expense Records (${rows.length})</h2>
          <table class="data compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Category</th>
                <th>Vendor</th>
                <th>Description</th>
                <th class="num">Subtotal</th>
                <th class="num">Tax</th>
                <th class="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (e) => `
                <tr>
                  <td>${htmlEscape(e.expenseNumber || '')}</td>
                  <td>${formatDate(e.incurredAt)}</td>
                  <td>${htmlEscape(CATEGORY_LABEL[e.category] || e.category || '')}</td>
                  <td>${htmlEscape(e.vendorName || '')}</td>
                  <td>${htmlEscape(e.description || '')}</td>
                  <td class="num">${formatCAD(e.subtotal)}</td>
                  <td class="num">${formatCAD(e.taxTotal)}</td>
                  <td class="num"><strong>${formatCAD(e.total)}</strong></td>
                  <td>${htmlEscape(e.status || '')}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </section>
      `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Expense Report — ${htmlEscape(schoolName)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      margin: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    header.report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    header h1 { font-size: 20px; margin: 0 0 4px; color: #1e3a8a; }
    header .subtitle { color: #6b7280; font-size: 12px; }
    header .meta { text-align: right; color: #6b7280; font-size: 10px; }

    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
    .kpi {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f9fafb;
    }
    .kpi .label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi .value { font-size: 16px; font-weight: 700; color: #111827; margin-top: 4px; }
    .kpi .sub { color: #6b7280; font-size: 10px; margin-top: 2px; }

    h2 { font-size: 13px; color: #1e3a8a; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .section { page-break-inside: avoid; margin-bottom: 12px; }

    table.data { width: 100%; border-collapse: collapse; }
    table.data th, table.data td {
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10.5px;
      vertical-align: top;
    }
    table.data thead th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
      border-bottom: 1px solid #d1d5db;
    }
    table.data .num { text-align: right; font-variant-numeric: tabular-nums; }
    table.data.compact th, table.data.compact td { padding: 4px 6px; font-size: 9.5px; }

    footer {
      position: fixed;
      bottom: 4mm;
      left: 12mm;
      right: 12mm;
      color: #9ca3af;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <header class="report-header">
    <div>
      <h1>Expense Report</h1>
      <div class="subtitle">${htmlEscape(schoolName)} · ${rangeLabel}</div>
    </div>
    <div class="meta">
      <div>Generated ${formatDate(generatedAt)}</div>
      <div>Currency: CAD</div>
    </div>
  </header>

  <section class="section">
    <div class="kpis">
      <div class="kpi">
        <div class="label">Total Spend</div>
        <div class="value">${cadFormatter.format(summary.total)}</div>
        <div class="sub">${summary.count} expense${summary.count === 1 ? '' : 's'}</div>
      </div>
      <div class="kpi">
        <div class="label">Average Expense</div>
        <div class="value">${cadFormatter.format(summary.avg)}</div>
        <div class="sub">Largest: ${cadFormatter.format(summary.largest)}</div>
      </div>
      <div class="kpi">
        <div class="label">Tax Paid</div>
        <div class="value">${cadFormatter.format(summary.taxTotal)}</div>
        <div class="sub">Subtotal: ${cadFormatter.format(summary.subtotal)}</div>
      </div>
      <div class="kpi">
        <div class="label">Paid vs Unpaid</div>
        <div class="value">${summary.paid.count} / ${summary.unpaid.count}</div>
        <div class="sub">${cadFormatter.format(summary.unpaid.total)} outstanding</div>
      </div>
    </div>
  </section>

  ${tableSection('Spending by Category', byCategory)}
  ${tableSection('Spending by Payment Method', byPaymentMethod)}
  ${tableSection('Top Vendors', topVendors)}
  ${tableSection('Tax Breakdown', taxBreakdown)}
  ${tableSection('Spending by Month', byMonth)}
  ${detailRows}

  <footer>
    <span>Kidsible — Expense Report</span>
    <span>${htmlEscape(schoolName)}</span>
  </footer>
</body>
</html>`;
}

module.exports = {
  getSummary,
  groupBy,
  getTopVendors,
  getTaxBreakdown,
  listForExport,
  rowsToCsv,
  renderReportHtml,
  CATEGORY_LABEL,
  PAYMENT_LABEL,
};
