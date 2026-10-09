import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { PLATFORM } from '../../constants/platformBranding';

export default function PasswordRecoveryLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${PLATFORM.colors.primary} 0%, ${PLATFORM.colors.secondary} 100%)`, p: 2 }}>
    <Card sx={{ maxWidth: 480, width: '100%', borderRadius: 3 }}><CardContent sx={{ p: 4 }}><Box sx={{ textAlign: 'center', mb: 3 }}><Box component="img" src={PLATFORM.logo} alt={PLATFORM.name} sx={{ height: 70, maxWidth: '100%', objectFit: 'contain' }} /></Box><Typography variant="h6" align="center" sx={{ mb: 3, fontWeight: 600 }}>{title}</Typography>{children}</CardContent></Card>
  </Box>;
}
