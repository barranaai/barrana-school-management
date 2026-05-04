/**
 * ExpenseFormDialog
 *
 * Receipt-first create/edit form for expenses. Drop-zone at the top:
 *   - On drop, the receipt is uploaded to /api/expenses/ocr
 *   - The backend stores the file and runs gpt-4o vision extraction
 *   - The form pre-fills with parsed fields (each shown with an
 *     "AI-suggested" pill so the admin knows what to double-check)
 *   - On save, we POST /api/expenses, sending back the staged attachment
 *     so the file is only saved once.
 *
 * For the "edit" mode we don't re-run OCR — we just edit fields. New
 * receipts can still be uploaded via the existing-record attachments UI
 * inside ExpenseDetailDrawer (Phase 1.5 — added in v1 too).
 *
 * If OCR is unavailable or fails the form opens empty and the admin
 * fills it in manually; the upload flow is never blocking.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CloudUpload,
  Close,
  Delete as DeleteIcon,
  PictureAsPdf,
  Image as ImageIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  apiService,
  type CreateExpenseInput,
  type Expense,
  type ExpenseCategory,
  type ExpenseEnums,
  type ExpensePaymentMethod,
  type ExpenseStagedAttachment,
  type ExpenseTax,
  type ExpenseTaxType,
} from '../../../../services/apiService';
import {
  CAD,
  CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  TAX_TYPE_LABEL,
} from './labels';

interface Props {
  open: boolean;
  editing: Expense | null;
  enums: ExpenseEnums | null;
  onClose: () => void;
  onSaved: (expense: Expense, isNew: boolean) => void;
}

interface FormState {
  incurredAt: string; // YYYY-MM-DD
  category: ExpenseCategory | '';
  subcategory: string;
  vendorName: string;
  description: string;
  subtotal: string; // major units string (so we don't fight with decimal input)
  taxes: Array<{ type: ExpenseTaxType; rate: string; amount: string }>;
  total: string;
  paymentMethod: ExpensePaymentMethod | '';
  paymentReference: string;
  isPaid: boolean;
  paidAt: string;
  tags: string[];
  attachments: ExpenseStagedAttachment[];
  ocrSuggestions: Set<keyof FormState>;
  ocrConfidence: number | null;
}

const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isoToDateInput = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyForm = (): FormState => ({
  incurredAt: todayIso(),
  category: '',
  subcategory: '',
  vendorName: '',
  description: '',
  subtotal: '',
  taxes: [],
  total: '',
  paymentMethod: '',
  paymentReference: '',
  isPaid: false,
  paidAt: '',
  tags: [],
  attachments: [],
  ocrSuggestions: new Set(),
  ocrConfidence: null,
});

const ExpenseFormDialog: React.FC<Props> = ({ open, editing, enums, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Reset / hydrate form whenever dialog opens
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        incurredAt: isoToDateInput(editing.incurredAt) || todayIso(),
        category: editing.category,
        subcategory: editing.subcategory || '',
        vendorName: editing.vendorName || '',
        description: editing.description || '',
        subtotal: String(editing.subtotal ?? ''),
        taxes: (editing.taxes || []).map((t) => ({
          type: t.type,
          rate: t.rate ? String(t.rate) : '',
          amount: String(t.amount),
        })),
        total: String(editing.total ?? ''),
        paymentMethod: editing.paymentMethod || '',
        paymentReference: editing.paymentReference || '',
        isPaid: !!editing.isPaid,
        paidAt: isoToDateInput(editing.paidAt),
        tags: editing.tags || [],
        attachments: [],
        ocrSuggestions: new Set(),
        ocrConfidence: null,
      });
    } else {
      setForm(emptyForm());
    }
    setErrorMsg(null);
  }, [open, editing]);

  // ─── Money math ────────────────────────────────────────────────────
  const taxTotal = useMemo(
    () =>
      form.taxes.reduce(
        (sum, t) => sum + (Number.isFinite(parseFloat(t.amount)) ? parseFloat(t.amount) : 0),
        0
      ),
    [form.taxes]
  );

  const computedTotal = useMemo(() => {
    const sub = parseFloat(form.subtotal);
    const total = sub + taxTotal;
    return Number.isFinite(total) ? total : 0;
  }, [form.subtotal, taxTotal]);

  // Auto-sync total when user hasn't manually overridden it.
  const totalLooksAuto =
    !form.total ||
    Math.abs(parseFloat(form.total || '0') - computedTotal) < 0.01;

  useEffect(() => {
    if (totalLooksAuto && Number.isFinite(computedTotal) && computedTotal > 0) {
      setForm((f) => ({ ...f, total: computedTotal.toFixed(2) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedTotal]);

  // ─── OCR ───────────────────────────────────────────────────────────
  const runOcr = async (file: File) => {
    setScanning(true);
    setErrorMsg(null);
    const toastId = toast.loading('Scanning receipt with AI…');
    try {
      const res = await apiService.ocrReceipt(file);
      if (!res.success || !res.data) {
        toast.error(res.error || 'Scan failed', { id: toastId });
        return;
      }

      const { attachment, parsed, ocr, error, warning } = res.data;

      // Always stage the uploaded file even if parsing failed.
      const next: FormState = { ...form, attachments: [...form.attachments, attachment] };
      const suggestions = new Set<keyof FormState>(form.ocrSuggestions);

      const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        next[key] = value;
        suggestions.add(key);
      };

      if (parsed.vendorName) set('vendorName', parsed.vendorName);
      if (parsed.incurredAt) set('incurredAt', isoToDateInput(parsed.incurredAt));
      if (typeof parsed.subtotal === 'number') set('subtotal', parsed.subtotal.toFixed(2));
      if (typeof parsed.total === 'number') set('total', parsed.total.toFixed(2));
      if (Array.isArray(parsed.taxes) && parsed.taxes.length) {
        set(
          'taxes',
          parsed.taxes.map((t) => ({
            type: t.type,
            rate: t.rate ? String(t.rate) : '',
            amount: String(t.amount),
          }))
        );
      }
      if (parsed.paymentMethod) set('paymentMethod', parsed.paymentMethod);

      // Category is a SUGGESTION only — never auto-applied per design B.
      // We surface it in the UI as a hint instead of writing to form.

      next.ocrSuggestions = suggestions;
      next.ocrConfidence = ocr?.confidence ?? null;
      setForm(next);

      if (warning) {
        toast(warning, { id: toastId, icon: 'ℹ️' });
      } else if (error) {
        toast.error('Receipt saved, but AI could not read it. Please fill manually.', { id: toastId });
      } else {
        toast.success('Receipt scanned — please review the highlighted fields.', { id: toastId });
      }

      // Show a category suggestion as an inline tip, not auto-applied.
      if (parsed.category) {
        (next as any)._suggestedCategory = parsed.category;
        setForm({ ...next });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Scan failed', { id: toastId });
    } finally {
      setScanning(false);
    }
  };

  // ─── Drop zone handlers ───────────────────────────────────────────
  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    // Only the first file gets OCR'd; extras are added as raw attachments.
    runOcr(arr[0]);
    if (arr.length > 1) {
      // Stage additional files without OCR (they'll save with the expense).
      const extras = arr.slice(1).map(
        (f): ExpenseStagedAttachment => ({
          filename: f.name,
          originalName: f.name,
          mimeType: f.type,
          size: f.size,
          // No storagePath until uploaded — these need POSTing via /attachments
          // route after expense is created. For v1 we simply require user to
          // re-upload extras via the detail drawer; keep UX honest.
          storagePath: '',
        })
      );
      if (extras.length) {
        toast(`Note: only the first file is auto-scanned. Re-upload others after saving.`, {
          icon: 'ℹ️',
        });
      }
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  // ─── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setErrorMsg(null);

    if (!form.category) {
      setErrorMsg('Please choose a category.');
      return;
    }
    if (!form.subtotal || parseFloat(form.subtotal) < 0) {
      setErrorMsg('Subtotal is required and must be ≥0.');
      return;
    }
    if (!form.incurredAt) {
      setErrorMsg('Date is required.');
      return;
    }

    const taxes: ExpenseTax[] = form.taxes
      .map((t) => ({
        type: t.type,
        rate: t.rate ? parseFloat(t.rate) : null,
        amount: parseFloat(t.amount),
      }))
      .filter((t) => Number.isFinite(t.amount) && t.amount >= 0);

    const payload: CreateExpenseInput = {
      incurredAt: new Date(form.incurredAt).toISOString(),
      category: form.category as ExpenseCategory,
      subcategory: form.subcategory.trim() || undefined,
      vendorName: form.vendorName.trim() || undefined,
      description: form.description.trim() || undefined,
      subtotal: parseFloat(form.subtotal),
      taxes,
      total: form.total ? parseFloat(form.total) : undefined,
      paymentMethod: (form.paymentMethod || undefined) as ExpensePaymentMethod | undefined,
      paymentReference: form.paymentReference.trim() || undefined,
      isPaid: form.isPaid,
      paidAt: form.isPaid && form.paidAt ? new Date(form.paidAt).toISOString() : null,
      tags: form.tags,
    };

    if (!editing) {
      // Only attach staged files (those that came from /ocr and have storagePath).
      payload.attachments = form.attachments.filter((a) => !!a.storagePath);
      if (form.ocrSuggestions.size > 0) {
        payload.ocr = {
          processed: true,
          processedAt: new Date().toISOString(),
          confidence: form.ocrConfidence ?? null,
        };
      }
    }

    setSaving(true);
    try {
      const res = editing
        ? await apiService.updateExpense(editing._id, payload)
        : await apiService.createExpense(payload);
      if (!res.success || !res.data) {
        setErrorMsg(res.error || 'Save failed');
        return;
      }
      toast.success(editing ? 'Expense updated' : 'Expense saved');
      onSaved(res.data, !editing);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const isAi = (key: keyof FormState) => form.ocrSuggestions.has(key);
  const aiHelper = (key: keyof FormState) =>
    isAi(key) ? (
      <Chip
        size="small"
        icon={<AutoAwesome sx={{ fontSize: 14 }} />}
        label="AI-suggested"
        sx={{ bgcolor: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}
      />
    ) : null;

  const suggestedCategory = (form as any)._suggestedCategory as ExpenseCategory | undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {editing ? `Edit Expense — ${editing.expenseNumber}` : 'Add Expense'}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Close"
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!editing && (
          <Paper
            variant="outlined"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              p: 3,
              borderRadius: 2,
              borderStyle: 'dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              bgcolor: dragOver ? 'rgba(25,118,210,0.04)' : 'background.paper',
              textAlign: 'center',
              cursor: 'pointer',
              mb: 2,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
              {scanning ? (
                <CircularProgress size={28} />
              ) : (
                <CloudUpload sx={{ fontSize: 36, color: 'primary.main' }} />
              )}
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {scanning ? 'Scanning receipt…' : 'Drop a receipt to auto-fill with AI'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Images (JPG/PNG/WEBP/HEIC) or PDF • Up to 25 MB • Or fill manually below.
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        {form.attachments.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            {form.attachments.map((a, i) => (
              <Chip
                key={i}
                icon={
                  /pdf/i.test(a.mimeType || '') ? (
                    <PictureAsPdf fontSize="small" />
                  ) : (
                    <ImageIcon fontSize="small" />
                  )
                }
                label={a.originalName || a.filename}
                onDelete={() =>
                  setForm((f) => ({
                    ...f,
                    attachments: f.attachments.filter((_, idx) => idx !== i),
                  }))
                }
              />
            ))}
          </Stack>
        )}

        {form.ocrConfidence !== null && (
          <Alert severity={form.ocrConfidence >= 0.7 ? 'success' : 'warning'} sx={{ mb: 2 }}>
            AI confidence: {(form.ocrConfidence * 100).toFixed(0)}% — please review highlighted fields
            before saving.
          </Alert>
        )}

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Date"
              size="small"
              required
              InputLabelProps={{ shrink: true }}
              value={form.incurredAt}
              onChange={(e) => setForm((f) => ({ ...f, incurredAt: e.target.value }))}
              helperText={aiHelper('incurredAt')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={form.category}
                onChange={(e) => {
                  setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }));
                }}
              >
                {(enums?.categories || (Object.keys(CATEGORY_LABEL) as ExpenseCategory[])).map(
                  (c) => (
                    <MenuItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>
            {suggestedCategory && form.category !== suggestedCategory && (
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  size="small"
                  icon={<AutoAwesome sx={{ fontSize: 14 }} />}
                  label={`AI suggests: ${CATEGORY_LABEL[suggestedCategory]} — click to apply`}
                  onClick={() => setForm((f) => ({ ...f, category: suggestedCategory }))}
                  sx={{ bgcolor: '#fff8e1', color: '#ef6c00', fontWeight: 600 }}
                />
              </Box>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Vendor"
              value={form.vendorName}
              onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
              helperText={aiHelper('vendorName')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Subcategory (optional)"
              value={form.subcategory}
              onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider textAlign="left">
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                AMOUNT (CAD)
              </Typography>
            </Divider>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              type="number"
              required
              label="Subtotal"
              value={form.subtotal}
              onChange={(e) => setForm((f) => ({ ...f, subtotal: e.target.value }))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                inputProps: { min: 0, step: '0.01' },
              }}
              helperText={aiHelper('subtotal')}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Tax total"
              value={taxTotal.toFixed(2)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                readOnly: true,
              }}
              helperText="Auto: sum of taxes below"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Total"
              value={form.total}
              onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                inputProps: { min: 0, step: '0.01' },
              }}
              helperText={
                isAi('total')
                  ? aiHelper('total')
                  : `Auto: ${CAD(computedTotal)} (override if needed)`
              }
            />
          </Grid>

          <Grid item xs={12}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                TAXES
              </Typography>
              <Button
                size="small"
                startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    taxes: [...f.taxes, { type: 'GST', rate: '0.05', amount: '' }],
                  }))
                }
              >
                Add tax line
              </Button>
              {isAi('taxes') && aiHelper('taxes')}
            </Stack>
            <Stack spacing={1}>
              {form.taxes.map((t, i) => (
                <Grid container spacing={1} key={i} alignItems="center">
                  <Grid item xs={4} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        label="Type"
                        value={t.type}
                        onChange={(e) =>
                          setForm((f) => {
                            const taxes = [...f.taxes];
                            taxes[i] = { ...taxes[i], type: e.target.value as ExpenseTaxType };
                            return { ...f, taxes };
                          })
                        }
                      >
                        {(enums?.taxTypes || (Object.keys(TAX_TYPE_LABEL) as ExpenseTaxType[])).map(
                          (tt) => (
                            <MenuItem key={tt} value={tt}>
                              {TAX_TYPE_LABEL[tt]}
                            </MenuItem>
                          )
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={4} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Rate"
                      placeholder="0.05"
                      value={t.rate}
                      onChange={(e) =>
                        setForm((f) => {
                          const taxes = [...f.taxes];
                          taxes[i] = { ...taxes[i], rate: e.target.value };
                          return { ...f, taxes };
                        })
                      }
                      InputProps={{ inputProps: { min: 0, max: 1, step: '0.001' } }}
                    />
                  </Grid>
                  <Grid item xs={3} md={5}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Amount"
                      value={t.amount}
                      onChange={(e) =>
                        setForm((f) => {
                          const taxes = [...f.taxes];
                          taxes[i] = { ...taxes[i], amount: e.target.value };
                          return { ...f, taxes };
                        })
                      }
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        inputProps: { min: 0, step: '0.01' },
                      }}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          taxes: f.taxes.filter((_, idx) => idx !== i),
                        }))
                      }
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12}>
            <Divider textAlign="left">
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                PAYMENT
              </Typography>
            </Divider>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Method</InputLabel>
              <Select
                label="Method"
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paymentMethod: e.target.value as ExpensePaymentMethod }))
                }
              >
                <MenuItem value="">—</MenuItem>
                {(enums?.paymentMethods || (Object.keys(PAYMENT_METHOD_LABEL) as ExpensePaymentMethod[])).map(
                  (p) => (
                    <MenuItem key={p} value={p}>
                      {PAYMENT_METHOD_LABEL[p]}
                    </MenuItem>
                  )
                )}
              </Select>
              {isAi('paymentMethod') && (
                <Box sx={{ mt: 0.5 }}>{aiHelper('paymentMethod')}</Box>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Reference (e.g. cheque #)"
              value={form.paymentReference}
              onChange={(e) => setForm((f) => ({ ...f, paymentReference: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isPaid}
                  onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))}
                />
              }
              label="Paid"
            />
            {form.isPaid && (
              <TextField
                size="small"
                fullWidth
                type="date"
                label="Paid on"
                InputLabelProps={{ shrink: true }}
                value={form.paidAt}
                onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))}
                sx={{ mt: 1 }}
              />
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || scanning}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save expense'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExpenseFormDialog;
