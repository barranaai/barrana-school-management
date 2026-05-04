/**
 * SchoolBannerHeader
 *
 * The school identity banner shown at the top of every dashboard
 * section (school name, established year, address, email, phone, logo).
 * Renders nothing if no branding object is supplied.
 *
 * Markup mirrors the inline banner used in ReportsListing /
 * StudentManagement / AllReports etc., extracted so the new
 * Incidents and Meetings sections render the same identity.
 */

import React, { useEffect, useState } from 'react';
import { Avatar, Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { Business } from '@mui/icons-material';

interface SchoolBannerHeaderProps {
  schoolBranding?: any;
}

/** Raw logo path/string from School Configuration (usually branding.logo → /uploads/logos/…) */
function getRawSchoolLogo(branding: any): string | null {
  const candidates = [
    branding?.logo,
    branding?.branding?.logo,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

/**
 * Turn stored logo path into a browser-loadable URL.
 * - Absolute http(s): unchanged
 * - Relative /uploads/…: prepend API/public origin so dev proxy + prod hosts both work
 */
function resolveSchoolLogoUrl(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const apiBase = process.env.REACT_APP_API_URL || '';
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    const origin = apiBase.replace(/\/?api\/?$/i, '').replace(/\/$/, '');
    return `${origin}${path}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** Bust browser cache after logo re-upload in School Configuration */
function withLogoCacheBuster(resolvedUrl: string, branding: any): string {
  const raw = branding?.updatedAt;
  if (!raw) return resolvedUrl;
  const ts = new Date(raw).getTime();
  if (Number.isNaN(ts)) return resolvedUrl;
  const sep = resolvedUrl.includes('?') ? '&' : '?';
  return `${resolvedUrl}${sep}v=${ts}`;
}

const SchoolBannerHeader: React.FC<SchoolBannerHeaderProps> = ({ schoolBranding }) => {
  // ─── Hooks must run before any early return (rules-of-hooks). ─────
  // Compute logo dependencies up front so the effect's deps are stable
  // even when `schoolBranding` is undefined.
  const rawLogo = schoolBranding ? getRawSchoolLogo(schoolBranding) : null;
  const updatedAt = schoolBranding?.updatedAt;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [rawLogo, updatedAt]);

  if (!schoolBranding) return null;

  const primaryColor =
    schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#273890';
  const secondaryColor =
    schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#7f0f4a';

  const logoUrl = rawLogo ? withLogoCacheBuster(resolveSchoolLogoUrl(rawLogo), schoolBranding) : null;
  const displayName = schoolBranding.schoolName || schoolBranding.name || 'School';

  const showImage = Boolean(logoUrl && !imgFailed);

  return (
    <Card
      sx={{
        mb: 3,
        mt: 2,
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
        borderRadius: '16px !important',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 3,
          }}
        >
          <Box sx={{ flex: 1, minWidth: '300px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {schoolBranding.schoolName || schoolBranding.name || 'School Name'}
              </Typography>
              {schoolBranding.established && (
                <Chip
                  label={`Estd: ${schoolBranding.established}`}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.3)',
                    color: 'white',
                    fontWeight: 600,
                    height: '32px',
                  }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {schoolBranding.address && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'white', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    📍 {schoolBranding.address}
                  </Typography>
                </Box>
              )}
              {schoolBranding.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'white', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    ✉️ {schoolBranding.email}
                  </Typography>
                </Box>
              )}
              {schoolBranding.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'white', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    📞 {schoolBranding.phone}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '120px',
            }}
          >
            <Box
              sx={{
                bgcolor: 'rgba(255,255,255,0.95)',
                borderRadius: 3,
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                minWidth: '140px',
                minHeight: '140px',
                maxWidth: '180px',
                maxHeight: '180px',
              }}
            >
              {showImage ? (
                <Box
                  component="img"
                  src={logoUrl!}
                  alt={`${displayName} logo`}
                  onError={() => setImgFailed(true)}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Avatar
                  variant="rounded"
                  sx={{
                    width: '100%',
                    height: '100%',
                    minHeight: 112,
                    bgcolor: 'rgba(255,255,255,0.98)',
                    color: primaryColor,
                    borderRadius: 2,
                  }}
                >
                  {displayName.trim().charAt(0) ? (
                    <Typography sx={{ fontSize: '2.75rem', fontWeight: 800, lineHeight: 1 }}>
                      {displayName.trim().charAt(0).toUpperCase()}
                    </Typography>
                  ) : (
                    <Business sx={{ fontSize: 56 }} />
                  )}
                </Avatar>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SchoolBannerHeader;
