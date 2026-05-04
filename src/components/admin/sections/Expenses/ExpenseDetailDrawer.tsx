/**
 * ExpenseDetailDrawer
 *
 * Slide-in panel showing the full expense record with admin actions:
 *   - View all fields, receipts, and full edit history
 *   - Edit (delegates to ExpenseFormDialog via onEdit callback)
 *   - Upload additional receipts to an existing expense
 *   - Toggle compliance lock
 *   - Void (soft-delete)
 *
 * Receipt thumbnails are fetched through the auth-gated download route
 * via apiService.fetchExpenseAttachment(), which returns a blob URL.
 */

import React, { useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close,
  CloudUpload,
  Delete as DeleteIcon,
  Edit,
  History as HistoryIcon,
  Image as ImageIcon,
  Lock,
  LockOpen,
  PictureAsPdf,
  Receipt,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  apiService,
  type Expense,
  type ExpenseAttachment,
} from '../../../../services/apiService';
import {
  CAD,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  STATUS_META,
  TAX_TYPE_LABEL,
  formatDate,
} from './labels';

interface Props {
  expense: Expense;
  onClose: () => void;
  onChanged: (next: Expense) => void;
  onVoided: () => void;
  onEdit: () => void;
}

const userLabel = (u: any): string => {
  if (!u) return '—';
  if (typeof u === 'string') return u;
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—';
};

const ExpenseDetailDrawer: React.FC<Props> = ({ expense, onClose, onChanged, onVoided, onEdit }) => {
  const [busy, setBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const status = STATUS_META[expense.status];
  const catColor = CATEGORY_COLOR[expense.category] || '#666';

  const handleLockToggle = async () => {
    setBusy(true);
    const res = await apiService.toggleExpenseLock(expense._id, !expense.isLocked);
    setBusy(false);
    if (res.success && res.data) {
      onChanged(res.data);
      toast.success(res.data.isLocked ? 'Expense locked' : 'Expense unlocked');
    } else {
      toast.error(res.error || 'Lock toggle failed');
    }
  };

  const handleVoid = async () => {
    setBusy(true);
    const res = await apiService.voidExpense(expense._id, voidReason);
    setBusy(false);
    if (res.success && res.data) {
      toast.success('Expense voided');
      onChanged(res.data);
      setConfirmVoid(false);
      onVoided();
    } else {
      toast.error(res.error || 'Void failed');
    }
  };

  const handleUploadAttachments = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const res = await apiService.uploadExpenseAttachments(expense._id, Array.from(files));
    setBusy(false);
    if (res.success && res.data) {
      onChanged(res.data);
      toast.success('Attachment uploaded');
    } else {
      toast.error(res.error || 'Upload failed');
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    setBusy(true);
    const res = await apiService.deleteExpenseAttachment(expense._id, attachmentId);
    setBusy(false);
    if (res.success && res.data) {
      onChanged(res.data);
      toast.success('Attachment removed');
    } else {
      toast.error(res.error || 'Delete failed');
    }
  };

  const openAttachmentPreview = async (a: ExpenseAttachment) => {
    const url = await apiService.fetchExpenseAttachment(a.url);
    if (url) setPreviewSrc(url);
    else toast.error('Could not load attachment');
  };

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100vw', md: 560 }, p: 0 } }}
    >
      <Box
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${catColor} 0%, #17437b 120%)`,
          color: '#fff',
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
            <Receipt />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" sx={{ opacity: 0.8 }}>
              {expense.expenseNumber}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {expense.vendorName || expense.description || '(no vendor)'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              <Chip
                size="small"
                label={CATEGORY_LABEL[expense.category]}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }}
              />
              <Chip
                size="small"
                label={status.label}
                sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }}
              />
              {expense.isLocked && (
                <Chip
                  size="small"
                  icon={<Lock fontSize="small" />}
                  label="Locked"
                  sx={{ bgcolor: '#eeeeee', color: '#424242' }}
                />
              )}
            </Stack>
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#fff' }}>
            <Close />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ p: 3 }}>
        {/* Money summary */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32' }}>
            {CAD(expense.total)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Subtotal {CAD(expense.subtotal)} + Tax {CAD(expense.taxTotal)}
          </Typography>
        </Box>

        {/* Core fields */}
        <Box sx={{ mb: 3 }}>
          <Field label="Date">{formatDate(expense.incurredAt)}</Field>
          <Field label="Recorded by">
            {userLabel(expense.recordedBy)} · {formatDate(expense.recordedAt)}
          </Field>
          {expense.subcategory && <Field label="Subcategory">{expense.subcategory}</Field>}
          {expense.description && <Field label="Description">{expense.description}</Field>}
          {expense.paymentMethod && (
            <Field label="Payment">
              {PAYMENT_METHOD_LABEL[expense.paymentMethod]}
              {expense.paymentReference ? ` · ${expense.paymentReference}` : ''}
              {expense.isPaid && expense.paidAt
                ? ` · paid on ${formatDate(expense.paidAt)}`
                : expense.isPaid
                ? ' · paid'
                : ' · unpaid'}
            </Field>
          )}
        </Box>

        {/* Taxes breakdown */}
        {expense.taxes && expense.taxes.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Taxes
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {expense.taxes.map((t, i) => (
                <Stack
                  key={i}
                  direction="row"
                  justifyContent="space-between"
                  sx={{ fontSize: 14 }}
                >
                  <span>
                    {TAX_TYPE_LABEL[t.type]}
                    {t.rate ? ` (${(t.rate * 100).toFixed(2)}%)` : ''}
                  </span>
                  <span>{CAD(t.amount)}</span>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Attachments */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Receipts ({expense.attachments?.length || 0})
            </Typography>
            <Button
              size="small"
              startIcon={<CloudUpload />}
              disabled={expense.isLocked || expense.status === 'void' || busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Add file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files) handleUploadAttachments(e.target.files);
                e.target.value = '';
              }}
            />
          </Stack>
          {(!expense.attachments || expense.attachments.length === 0) && (
            <Typography variant="body2" color="text.secondary">
              No attachments yet.
            </Typography>
          )}
          <Stack spacing={1}>
            {(expense.attachments || []).map((a) => (
              <Stack
                key={a._id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {/pdf/i.test(a.mimeType || '') ? (
                  <PictureAsPdf color="action" />
                ) : (
                  <ImageIcon color="action" />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                  >
                    {a.originalName || a.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.size ? `${Math.round(a.size / 1024)} KB` : ''}
                  </Typography>
                </Box>
                <Button size="small" onClick={() => openAttachmentPreview(a)}>
                  View
                </Button>
                <Tooltip title={expense.isLocked ? 'Unlock to delete' : 'Delete'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={expense.isLocked || expense.status === 'void' || busy}
                      onClick={() => handleDeleteAttachment(a._id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* OCR meta */}
        {expense.ocr?.processed && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              AI scan
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {expense.ocr.model || 'gpt-4o'}
              {typeof expense.ocr.confidence === 'number'
                ? ` · ${(expense.ocr.confidence * 100).toFixed(0)}% confidence`
                : ''}
              {expense.ocr.processedAt ? ` · ${formatDate(expense.ocr.processedAt)}` : ''}
            </Typography>
          </Box>
        )}

        {/* Edit history */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <HistoryIcon fontSize="small" color="action" />
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              History
            </Typography>
          </Stack>
          {(!expense.editHistory || expense.editHistory.length === 0) && (
            <Typography variant="body2" color="text.secondary">
              No history yet.
            </Typography>
          )}
          <Stack spacing={1}>
            {(expense.editHistory || [])
              .slice()
              .reverse()
              .map((h, i) => (
                <Box key={i} sx={{ borderLeft: '2px solid', borderColor: 'divider', pl: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {h.summary || 'Updated'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(h.editedAt)} · {userLabel(h.editedBy)}
                    {h.fieldsChanged && h.fieldsChanged.length > 0
                      ? ` · ${h.fieldsChanged.join(', ')}`
                      : ''}
                  </Typography>
                </Box>
              ))}
          </Stack>
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={onEdit}
            disabled={expense.isLocked || expense.status === 'void' || busy}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            startIcon={expense.isLocked ? <LockOpen /> : <Lock />}
            onClick={handleLockToggle}
            disabled={busy}
          >
            {expense.isLocked ? 'Unlock' : 'Lock'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setConfirmVoid(true)}
            disabled={expense.isLocked || expense.status === 'void' || busy}
          >
            Void
          </Button>
        </Stack>
      </Box>

      {/* Void confirm dialog */}
      <Dialog open={confirmVoid} onClose={() => setConfirmVoid(false)} fullWidth maxWidth="xs">
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Void this expense?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The record stays for audit but is excluded from totals.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Reason (optional)"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setConfirmVoid(false)} disabled={busy}>
              Cancel
            </Button>
            <Button color="error" variant="contained" onClick={handleVoid} disabled={busy}>
              {busy ? <CircularProgress size={18} /> : 'Void expense'}
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Attachment preview dialog */}
      <Dialog open={!!previewSrc} onClose={() => setPreviewSrc(null)} maxWidth="md" fullWidth>
        <Box sx={{ position: 'relative', bgcolor: '#000' }}>
          <IconButton
            onClick={() => setPreviewSrc(null)}
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', zIndex: 1 }}
          >
            <Close />
          </IconButton>
          {previewSrc && (
            <Box
              component="img"
              src={previewSrc}
              alt="Receipt preview"
              sx={{
                width: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block',
                background: '#000',
              }}
              onError={() => {
                // PDFs etc. — fall back to opening in new tab.
                if (previewSrc) window.open(previewSrc, '_blank', 'noopener');
                setPreviewSrc(null);
              }}
            />
          )}
        </Box>
      </Dialog>
    </Drawer>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ mb: 1 }}>
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
      {label.toUpperCase()}
    </Typography>
    <Typography variant="body2">{children}</Typography>
  </Box>
);

export default ExpenseDetailDrawer;
