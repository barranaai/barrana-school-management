/**
 * Shared label/colour maps for the Expenses module.
 * Single source of truth so all sub-components render identically.
 */

import type {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseStatus,
  ExpenseTaxType,
} from '../../../../services/apiService';

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  salaries: 'Salaries',
  rent: 'Rent',
  utilities: 'Utilities',
  supplies: 'Supplies',
  food: 'Food',
  transport: 'Transport',
  maintenance: 'Maintenance',
  software: 'Software & SaaS',
  marketing: 'Marketing',
  training: 'Training',
  insurance: 'Insurance',
  taxes: 'Taxes',
  events: 'Events',
  fees: 'Fees & Licenses',
  other: 'Other',
};

export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  salaries: '#1976d2',
  rent: '#6d4c41',
  utilities: '#0288d1',
  supplies: '#7b1fa2',
  food: '#e65100',
  transport: '#00838f',
  maintenance: '#455a64',
  software: '#3949ab',
  marketing: '#c2185b',
  training: '#2e7d32',
  insurance: '#5d4037',
  taxes: '#bf360c',
  events: '#43a047',
  fees: '#827717',
  other: '#546e7a',
};

export const PAYMENT_METHOD_LABEL: Record<ExpensePaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  e_transfer: 'e-Transfer',
  other: 'Other',
};

export const STATUS_META: Record<
  ExpenseStatus,
  { label: string; color: string; bg: string }
> = {
  recorded: { label: 'Recorded', color: '#1b5e20', bg: '#e8f5e9' },
  void: { label: 'Void', color: '#616161', bg: '#eeeeee' },
};

export const TAX_TYPE_LABEL: Record<ExpenseTaxType, string> = {
  GST: 'GST',
  HST: 'HST',
  PST: 'PST',
  QST: 'QST',
  OTHER: 'Other',
};

export const CAD = (n: number): string =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: '2-digit' });
};
