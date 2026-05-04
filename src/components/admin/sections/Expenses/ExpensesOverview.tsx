/**
 * ExpensesOverview (Phase 2 — Reports & Analytics)
 *
 * Read-only analytics dashboard for school admins:
 *   - Date-range picker with presets
 *   - 4 KPI cards (Total / Average / Tax / Paid vs Unpaid)
 *   - Pie chart: spending by category
 *   - Bar chart: monthly trend
 *   - Top vendors list (with progress bars)
 *   - Tax & payment-method breakdowns
 *   - Export menu (CSV / PDF) — calls the auth-gated /export endpoint
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip as MuiTooltip,
  Typography,
} from '@mui/material';
import {
  CalendarMonth,
  CreditCard,
  Description,
  DownloadRounded,
  PaidRounded,
  PercentRounded,
  PieChartRounded,
  Refresh,
  Storefront,
  TrendingUp,
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  apiService,
  type ExpenseCategory,
  type ExpensePaymentMethod,
  type ExpenseReportRow,
  type ExpenseReportSummary,
} from '../../../../services/apiService';
import {
  CAD,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  TAX_TYPE_LABEL,
} from './labels';
import {
  detectPreset,
  rangeForPreset,
  RANGE_PRESETS,
  type DateRange,
  type RangePresetId,
} from './dateRanges';

interface Props {
  primaryColor?: string;
}

const PAYMENT_COLORS: Record<ExpensePaymentMethod, string> = {
  cash: '#1976d2',
  card: '#7b1fa2',
  bank_transfer: '#0288d1',
  cheque: '#5d4037',
  e_transfer: '#2e7d32',
  other: '#546e7a',
};

const ExpensesOverview: React.FC<Props> = ({ primaryColor = '#17437b' }) => {
  // Default range: this month.
  const initial = useMemo(() => rangeForPreset('thisMonth'), []);
  const [range, setRange] = useState<DateRange>(initial);
  const [presetId, setPresetId] = useState<RangePresetId>('thisMonth');

  const [summary, setSummary] = useState<ExpenseReportSummary | null>(null);
  const [byCategory, setByCategory] = useState<ExpenseReportRow[]>([]);
  const [byPayment, setByPayment] = useState<ExpenseReportRow[]>([]);
  const [byMonth, setByMonth] = useState<ExpenseReportRow[]>([]);
  const [topVendors, setTopVendors] = useState<ExpenseReportRow[]>([]);
  const [taxBreakdown, setTaxBreakdown] = useState<ExpenseReportRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export menu
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const filters = useMemo(
    () => ({ from: range.from || undefined, to: range.to || undefined }),
    [range.from, range.to]
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, catRes, payRes, monthRes, vendRes, taxRes] = await Promise.all([
        apiService.getExpenseReportSummary(filters),
        apiService.getExpenseReportGroup('category', filters),
        apiService.getExpenseReportGroup('paymentMethod', filters),
        apiService.getExpenseReportGroup('month', filters),
        apiService.getExpenseTopVendors({ ...filters, limit: 10 }),
        apiService.getExpenseTaxBreakdown(filters),
      ]);

      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
      else setError(sumRes.error || 'Failed to load summary');

      setByCategory(catRes.success && Array.isArray(catRes.data) ? catRes.data : []);
      setByPayment(payRes.success && Array.isArray(payRes.data) ? payRes.data : []);
      setByMonth(monthRes.success && Array.isArray(monthRes.data) ? monthRes.data : []);
      setTopVendors(vendRes.success && Array.isArray(vendRes.data) ? vendRes.data : []);
      setTaxBreakdown(taxRes.success && Array.isArray(taxRes.data) ? taxRes.data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const onPresetChange = (id: RangePresetId) => {
    setPresetId(id);
    if (id !== 'custom') setRange(rangeForPreset(id));
  };

  const onCustomDateChange = (which: 'from' | 'to', v: string) => {
    setRange((prev) => {
      const next = { ...prev, [which]: v };
      setPresetId(detectPreset(next));
      return next;
    });
  };

  const triggerExport = async (format: 'csv' | 'pdf') => {
    setExportAnchor(null);
    setExporting(format);
    try {
      const result = await apiService.exportExpenses({ ...filters, format });
      if (result.success === true) {
        const a = document.createElement('a');
        a.href = result.blobUrl;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Free the object URL after a tick
        setTimeout(() => URL.revokeObjectURL(result.blobUrl), 1000);
      } else {
        setError(result.error);
      }
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const rangeLabel = (() => {
    if (!range.from && !range.to) return 'All time';
    if (range.from && range.to) return `${range.from} → ${range.to}`;
    if (range.from) return `Since ${range.from}`;
    return `Up to ${range.to}`;
  })();

  // ─── Chart data shaping ────────────────────────────────────────────

  // Recharts plays nicest with explicit series objects keyed by `name`.
  const categoryChartData = useMemo(
    () =>
      byCategory.map((r) => ({
        name: CATEGORY_LABEL[r.key as ExpenseCategory] || r.label || 'Other',
        value: r.total,
        count: r.count,
        percentage: r.percentage,
        fill: CATEGORY_COLOR[r.key as ExpenseCategory] || '#546e7a',
      })),
    [byCategory]
  );

  const monthChartData = useMemo(
    () =>
      byMonth.map((r) => ({
        name: r.label || r.key || '',
        total: r.total,
        count: r.count,
      })),
    [byMonth]
  );

  return (
    <Box>
      {/* ─── Toolbar: range presets + dates + export ─────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {RANGE_PRESETS.map((p) => (
                <Chip
                  key={p.id}
                  label={p.label}
                  onClick={() => onPresetChange(p.id)}
                  color={presetId === p.id ? 'primary' : 'default'}
                  variant={presetId === p.id ? 'filled' : 'outlined'}
                  size="small"
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
              <TextField
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={range.from}
                onChange={(e) => onCustomDateChange('from', e.target.value)}
                sx={{ maxWidth: 180 }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={range.to}
                onChange={(e) => onCustomDateChange('to', e.target.value)}
                sx={{ maxWidth: 180 }}
              />
              <Typography variant="body2" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                {rangeLabel}
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1}>
            <MuiTooltip title="Refresh">
              <IconButton onClick={load} disabled={loading}>
                <Refresh />
              </IconButton>
            </MuiTooltip>
            <Button
              variant="contained"
              startIcon={
                exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadRounded />
              }
              disabled={!!exporting || loading}
              onClick={(e) => setExportAnchor(e.currentTarget)}
              sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: primaryColor, opacity: 0.9 } }}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
            <Menu
              anchorEl={exportAnchor}
              open={Boolean(exportAnchor)}
              onClose={() => setExportAnchor(null)}
            >
              <MenuItem onClick={() => triggerExport('csv')}>
                <Description fontSize="small" sx={{ mr: 1 }} /> CSV (spreadsheet)
              </MenuItem>
              <MenuItem onClick={() => triggerExport('pdf')}>
                <PieChartRounded fontSize="small" sx={{ mr: 1 }} /> PDF (formatted report)
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !summary || summary.count === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 8 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              No expenses in this range.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try a wider date range, or add expenses from the "All Expenses" tab.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ─── KPI cards ──────────────────────────────────────────── */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Total spend"
                value={CAD(summary.total)}
                hint={`${summary.count} expense${summary.count === 1 ? '' : 's'}`}
                color="#1976d2"
                icon={<PaidRounded />}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Average expense"
                value={CAD(summary.avg)}
                hint={`Largest: ${CAD(summary.largest)}`}
                color="#2e7d32"
                icon={<TrendingUp />}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Tax paid"
                value={CAD(summary.taxTotal)}
                hint={`Subtotal: ${CAD(summary.subtotal)}`}
                color="#ef6c00"
                icon={<PercentRounded />}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard
                label="Paid / Unpaid"
                value={`${summary.paid.count} / ${summary.unpaid.count}`}
                hint={`${CAD(summary.unpaid.total)} outstanding`}
                color="#7b1fa2"
                icon={<CreditCard />}
              />
            </Grid>
          </Grid>

          {/* ─── Charts row 1: Category pie + Monthly bar ─────────── */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={5}>
              <ChartCard title="Spending by category" icon={<PieChartRounded />}>
                {categoryChartData.length === 0 ? (
                  <EmptyChart label="No category data" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {categoryChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any, item: any) => {
                          const pct = item?.payload?.percentage;
                          return [
                            `${CAD(Number(value))}${pct != null ? ` · ${pct}%` : ''}`,
                            name,
                          ];
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </Grid>

            <Grid item xs={12} md={7}>
              <ChartCard title="Monthly trend" icon={<CalendarMonth />}>
                {monthChartData.length === 0 ? (
                  <EmptyChart label="No monthly data" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) =>
                          name === 'total' ? [CAD(Number(value)), 'Spend'] : [value, name]
                        }
                      />
                      <Bar dataKey="total" fill={primaryColor} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </Grid>
          </Grid>

          {/* ─── Top vendors + Payment + Tax ──────────────────────── */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <ChartCard title="Top vendors" icon={<Storefront />}>
                {topVendors.length === 0 ? (
                  <EmptyChart label="No vendor data" />
                ) : (
                  <Stack spacing={1.25} sx={{ mt: 1 }}>
                    {topVendors.map((v, idx) => (
                      <VendorRow key={`${v.key}-${idx}`} row={v} color={primaryColor} />
                    ))}
                  </Stack>
                )}
              </ChartCard>
            </Grid>

            <Grid item xs={12} md={3}>
              <ChartCard title="Payment methods" icon={<CreditCard />}>
                {byPayment.length === 0 ? (
                  <EmptyChart label="No payment data" />
                ) : (
                  <Stack spacing={1.25} sx={{ mt: 1 }}>
                    {byPayment.map((p) => {
                      const pmKey = (p.key as ExpensePaymentMethod) || 'other';
                      const color = PAYMENT_COLORS[pmKey] || '#546e7a';
                      const label = PAYMENT_METHOD_LABEL[pmKey] || p.label || 'Other';
                      return (
                        <BreakdownRow
                          key={String(p.key)}
                          label={label}
                          color={color}
                          total={p.total}
                          count={p.count}
                          percentage={p.percentage}
                        />
                      );
                    })}
                  </Stack>
                )}
              </ChartCard>
            </Grid>

            <Grid item xs={12} md={3}>
              <ChartCard title="Tax breakdown" icon={<PercentRounded />}>
                {taxBreakdown.length === 0 ? (
                  <EmptyChart label="No tax data" />
                ) : (
                  <Stack spacing={1.25} sx={{ mt: 1 }}>
                    {taxBreakdown.map((t) => (
                      <BreakdownRow
                        key={String(t.key)}
                        label={
                          TAX_TYPE_LABEL[(t.key as keyof typeof TAX_TYPE_LABEL) || 'OTHER'] ||
                          t.label ||
                          'Other'
                        }
                        color="#ef6c00"
                        total={t.total}
                        count={t.count}
                        percentage={t.percentage}
                      />
                    ))}
                  </Stack>
                )}
              </ChartCard>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  color: string;
  icon: React.ReactElement;
}> = ({ label, value, hint, color, icon }) => (
  <Card sx={{ borderRadius: 2, height: '100%' }}>
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${color}1a`,
            color,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {hint}
          </Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const ChartCard: React.FC<{
  title: string;
  icon: React.ReactElement;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <Card sx={{ borderRadius: 2, height: '100%' }}>
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        {React.cloneElement(icon, { sx: { color: 'text.secondary' } })}
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 1 }} />
      {children}
    </CardContent>
  </Card>
);

const EmptyChart: React.FC<{ label: string }> = ({ label }) => (
  <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

const VendorRow: React.FC<{ row: ExpenseReportRow; color: string }> = ({ row, color }) => (
  <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
        {row.label || '(no vendor)'}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, ml: 1, whiteSpace: 'nowrap' }}>
        {CAD(row.total)}
      </Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={Math.max(2, Math.min(100, row.percentage))}
      sx={{
        height: 6,
        borderRadius: 3,
        bgcolor: '#f0f0f0',
        '& .MuiLinearProgress-bar': { bgcolor: color },
      }}
    />
    <Typography variant="caption" color="text.secondary">
      {row.count} expense{row.count === 1 ? '' : 's'} · {row.percentage.toFixed(1)}%
    </Typography>
  </Box>
);

const BreakdownRow: React.FC<{
  label: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}> = ({ label, color, total, count, percentage }) => (
  <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
        <Typography variant="body2" noWrap>
          {label}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ fontWeight: 700, ml: 1, whiteSpace: 'nowrap' }}>
        {CAD(total)}
      </Typography>
    </Stack>
    <Typography variant="caption" color="text.secondary">
      {count} · {percentage.toFixed(1)}%
    </Typography>
  </Box>
);

export default ExpensesOverview;
