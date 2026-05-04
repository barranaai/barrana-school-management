/**
 * ExpensesList (Admin)
 *
 * Top-level Expenses section: hero, KPI stats, filters, and a paginated
 * card list. Composes ExpenseFormDialog (create/edit) and
 * ExpenseDetailDrawer (read + admin actions).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  AttachMoney,
  AssessmentRounded,
  CalendarMonth,
  ListAltRounded,
  Lock,
  Receipt,
  Refresh,
  Today,
  TrendingUp,
} from '@mui/icons-material';
import {
  apiService,
  type Expense,
  type ExpenseCategory,
  type ExpenseEnums,
  type ExpenseStats,
  type ExpenseStatus,
} from '../../../../services/apiService';
import SchoolBannerHeader from '../../../common/SchoolBannerHeader';
import { CATEGORY_COLOR, CATEGORY_LABEL, CAD, STATUS_META, formatDate } from './labels';
import ExpenseFormDialog from './ExpenseFormDialog';
import ExpenseDetailDrawer from './ExpenseDetailDrawer';
import ExpensesOverview from './ExpensesOverview';

interface Props {
  schoolBranding?: any;
}

const PAGE_SIZE = 25;

const ExpensesList: React.FC<Props> = ({ schoolBranding }) => {
  const primaryColor =
    schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#17437b';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [enums, setEnums] = useState<ExpenseEnums | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterCategory, setFilterCategory] = useState<'' | ExpenseCategory>('');
  const [filterStatus, setFilterStatus] = useState<'' | ExpenseStatus>('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);

  // Phase 2 — top-level tabs
  const [tab, setTab] = useState<'list' | 'overview'>('list');

  const load = async () => {
    setLoading(true);
    try {
      const [expRes, statsRes, enumsRes] = await Promise.all([
        apiService.getExpenses({
          category: filterCategory || undefined,
          status: filterStatus || undefined,
          q: search || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit: PAGE_SIZE,
        }),
        apiService.getExpenseStats(),
        enums ? Promise.resolve(null as any) : apiService.getExpenseEnums(),
      ]);
      if (expRes.success && Array.isArray(expRes.data)) {
        setExpenses(expRes.data);
        if ((expRes as any).pagination?.totalPages) {
          setTotalPages((expRes as any).pagination.totalPages);
        }
      }
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (enumsRes && (enumsRes as any).success && (enumsRes as any).data) {
        setEnums((enumsRes as any).data as ExpenseEnums);
      }
    } catch (err) {
      console.error('Admin: load expenses error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch the list when the list tab is active — keeps the
    // Overview tab from racing with the list reload.
    if (tab !== 'list') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterStatus, page, from, to, tab]);

  // Debounce search input
  useEffect(() => {
    if (tab !== 'list') return;
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab]);

  const onSaved = (expense: Expense, isNew: boolean) => {
    if (isNew) {
      setExpenses((prev) => [expense, ...prev]);
    } else {
      setExpenses((prev) => prev.map((e) => (e._id === expense._id ? expense : e)));
      setDetail((prev) => (prev?._id === expense._id ? expense : prev));
    }
    // Refresh stats so KPI cards stay accurate.
    apiService.getExpenseStats().then((r) => {
      if (r.success && r.data) setStats(r.data);
    });
  };

  const onChanged = (expense: Expense) => {
    setExpenses((prev) => prev.map((e) => (e._id === expense._id ? expense : e)));
    setDetail((prev) => (prev?._id === expense._id ? expense : prev));
  };

  const filtered = useMemo(() => expenses, [expenses]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <SchoolBannerHeader schoolBranding={schoolBranding} />

      {/* Hero */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 2,
          background: `linear-gradient(135deg, ${primaryColor} 0%, #26aea6 120%)`,
          color: '#fff',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <AttachMoney sx={{ fontSize: 36 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Expenses
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Log school expenses with one click — drop a receipt and let AI fill the form.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <IconButton
                onClick={load}
                sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
                title="Refresh"
              >
                <Refresh />
              </IconButton>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<Add />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                sx={{
                  bgcolor: '#fff',
                  color: primaryColor,
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#f5f5f5' },
                }}
              >
                Add Expense
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v: 'list' | 'overview') => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            px: 2,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab
            value="list"
            label="All Expenses"
            icon={<ListAltRounded fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            value="overview"
            label="Overview & Reports"
            icon={<AssessmentRounded fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {tab === 'overview' && <ExpensesOverview primaryColor={primaryColor} />}

      {/* Stats — list tab only */}
      {tab === 'list' && stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Month to date"
              value={CAD(stats.monthToDate.total)}
              hint={`${stats.monthToDate.count} expenses`}
              color="#1976d2"
              icon={<Today />}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Year to date"
              value={CAD(stats.yearToDate.total)}
              hint={`${stats.yearToDate.count} expenses`}
              color="#2e7d32"
              icon={<TrendingUp />}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Last 30 days"
              value={CAD(stats.last30Days.total)}
              hint={`${stats.last30Days.count} expenses`}
              color="#ef6c00"
              icon={<CalendarMonth />}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Recorded"
              value={String(stats.byStatus.recorded || 0)}
              hint={`${stats.byStatus.void || 0} void`}
              color="#7b1fa2"
              icon={<Receipt />}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'list' && (
        <>
      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              placeholder="Number, vendor, description, tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={filterCategory}
                onChange={(e) => {
                  setPage(1);
                  setFilterCategory(e.target.value as any);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                  <MenuItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filterStatus}
                onChange={(e) => {
                  setPage(1);
                  setFilterStatus(e.target.value as any);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {(Object.keys(STATUS_META) as ExpenseStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
            />
          </Grid>
          <Grid item xs={6} md={2.5}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              No expenses match your filters.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Click "Add Expense" to record one — drop a receipt to auto-fill with AI.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add Expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((exp) => (
            <ExpenseRow
              key={exp._id}
              expense={exp}
              onClick={() => setDetail(exp)}
              onEdit={() => {
                setEditing(exp);
                setFormOpen(true);
              }}
            />
          ))}
        </Stack>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}
        </>
      )}

      <ExpenseFormDialog
        open={formOpen}
        editing={editing}
        enums={enums}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={(exp, isNew) => {
          onSaved(exp, isNew);
          setFormOpen(false);
          setEditing(null);
        }}
      />

      {detail && (
        <ExpenseDetailDrawer
          expense={detail}
          onClose={() => setDetail(null)}
          onChanged={onChanged}
          onEdit={() => {
            setEditing(detail);
            setFormOpen(true);
            setDetail(null);
          }}
          onVoided={() => {
            setExpenses((prev) =>
              prev.map((e) =>
                e._id === detail._id ? { ...e, status: 'void' as const } : e
              )
            );
            setDetail(null);
          }}
        />
      )}
    </Box>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  color: string;
  icon: React.ReactElement;
}> = ({ label, value, hint, color, icon }) => (
  <Card sx={{ borderRadius: 2, height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: color, color: '#fff' }}>{icon}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const ExpenseRow: React.FC<{
  expense: Expense;
  onClick: () => void;
  onEdit: () => void;
}> = ({ expense, onClick, onEdit }) => {
  const status = STATUS_META[expense.status];
  const catColor = CATEGORY_COLOR[expense.category] || '#666';
  return (
    <Card
      sx={{
        borderRadius: 2,
        borderLeft: `4px solid ${catColor}`,
        cursor: 'pointer',
        transition: 'transform .12s ease, box-shadow .12s ease',
        '&:hover': { transform: 'translateY(-1px)', boxShadow: 3 },
        opacity: expense.status === 'void' ? 0.65 : 1,
      }}
      onClick={onClick}
    >
      <CardContent sx={{ py: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: catColor, color: '#fff', width: 36, height: 36 }}>
                <Receipt fontSize="small" />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {expense.vendorName || expense.description || '(no vendor)'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {expense.expenseNumber}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <Chip
              size="small"
              label={CATEGORY_LABEL[expense.category]}
              sx={{ bgcolor: catColor, color: '#fff', fontWeight: 600 }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatDate(expense.incurredAt)}
            </Typography>
            {expense.isPaid && (
              <Typography variant="caption" color="success.main">
                Paid
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} md={2}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
              {CAD(expense.total)}
            </Typography>
            {expense.taxTotal > 0 && (
              <Typography variant="caption" color="text.secondary">
                incl. {CAD(expense.taxTotal)} tax
              </Typography>
            )}
          </Grid>
          <Grid item xs={6} md={2}>
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
              <Chip
                size="small"
                label={status.label}
                sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }}
              />
              {expense.isLocked && (
                <Tooltip title="Locked for compliance">
                  <Lock fontSize="small" sx={{ color: '#616161' }} />
                </Tooltip>
              )}
              <Tooltip title="Edit">
                <span>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    disabled={expense.isLocked || expense.status === 'void'}
                  >
                    Edit
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ExpensesList;
