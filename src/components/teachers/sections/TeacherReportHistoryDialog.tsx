import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItem, ListItemText, Typography } from '@mui/material';
import { Download, Visibility } from '@mui/icons-material';
import { reportService, Report } from '../../../services/reportService';

interface Props {
  open: boolean;
  participantId: string;
  participantName: string;
  onClose: () => void;
}

const TeacherReportHistoryDialog: React.FC<Props> = ({ open, participantId, participantName, onClose }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    if (!participantId) return;
    setLoading(true); setError('');
    try {
      const firstPage = await reportService.getReports({ studentId: participantId, limit: 100 });
      const allReports = [...(firstPage.data || [])];
      const pageCount = Math.max(1, firstPage.pages || 1);
      for (let page = 2; page <= pageCount; page += 1) {
        const nextPage = await reportService.getReports({ studentId: participantId, limit: 100, page });
        allReports.push(...(nextPage.data || []));
      }
      setReports(allReports);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Report history could not be loaded.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) void load(); else setSelected(null); }, [open, participantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async (report: Report) => {
    setDownloading(report._id); setError('');
    try { await reportService.downloadReportPdf(report._id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Report could not be downloaded.'); }
    finally { setDownloading(null); }
  };

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>Report History — {participantName}</DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /><Typography>Loading report history…</Typography></Box> :
        selected ? <Box><Button onClick={() => setSelected(null)} sx={{ mb: 1 }}>Back to report history</Button><Typography variant="h6">{selected.title}</Typography><Chip label={selected.status} size="small" sx={{ my: 1 }} /><Divider sx={{ mb: 2 }} /><Typography sx={{ whiteSpace: 'pre-wrap' }}>{selected.content}</Typography></Box> :
          reports.length === 0 ? <Alert severity="info">No reports are available for this participant.</Alert> :
            <List>{reports.map(report => <ListItem key={report._id} divider secondaryAction={<Box sx={{ display: 'flex', gap: 1 }}><Button size="small" startIcon={<Visibility />} onClick={() => setSelected(report)}>View</Button><Button size="small" startIcon={<Download />} disabled={downloading === report._id || !['approved', 'sent'].includes(report.status)} onClick={() => void download(report)}>{downloading === report._id ? 'Preparing…' : 'Download'}</Button></Box>}><ListItemText primary={report.title} secondary={`${new Date(report.createdAt).toLocaleDateString()} · ${report.status}`} /></ListItem>)}</List>}
    </DialogContent><DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
};

export default TeacherReportHistoryDialog;
