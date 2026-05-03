/**
 * MedicalInfoDisplay
 *
 * Read-only display of a student's medical information. Used by
 * Teachers (with optional alert strip), Parents, and any other place
 * that needs to show—without editing—a student's medical profile.
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Paper,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Medication as MedicationIcon,
  MedicalServices as MedicalServicesIcon,
  Restaurant as RestaurantIcon,
  HealthAndSafety,
} from '@mui/icons-material';
import type { MedicalInfo } from '../../contexts/DataContext';

export interface MedicalInfoDisplayProps {
  value?: MedicalInfo | string | null;
  /** When true and any allergies/medications/conditions exist, show a top alert strip. */
  showSafetyAlert?: boolean;
  /** When true, show empty sections with "None recorded" text. Defaults to false (hide empties). */
  showEmptySections?: boolean;
  /** Optional emergency contact string to render alongside (read-only). */
  emergencyContact?: string;
}

interface SectionDef {
  key: keyof MedicalInfo;
  label: string;
  icon: React.ReactElement;
  color: string;
  bgColor: string;
}

const SECTIONS: SectionDef[] = [
  {
    key: 'allergies',
    label: 'Allergies',
    icon: <WarningIcon fontSize="small" />,
    color: '#d32f2f',
    bgColor: 'rgba(211, 47, 47, 0.06)',
  },
  {
    key: 'medications',
    label: 'Medications',
    icon: <MedicationIcon fontSize="small" />,
    color: '#1976d2',
    bgColor: 'rgba(25, 118, 210, 0.06)',
  },
  {
    key: 'conditions',
    label: 'Medical Conditions',
    icon: <MedicalServicesIcon fontSize="small" />,
    color: '#7b1fa2',
    bgColor: 'rgba(123, 31, 162, 0.06)',
  },
  {
    key: 'dietaryRestrictions',
    label: 'Dietary Restrictions',
    icon: <RestaurantIcon fontSize="small" />,
    color: '#2e7d32',
    bgColor: 'rgba(46, 125, 50, 0.06)',
  },
];

function normalize(value: MedicalInfoDisplayProps['value']): MedicalInfo {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? { allergies: [trimmed] } : {};
  }
  return value;
}

const MedicalInfoDisplay: React.FC<MedicalInfoDisplayProps> = ({
  value,
  showSafetyAlert,
  showEmptySections,
  emergencyContact,
}) => {
  const data = normalize(value);

  const allergies = data.allergies ?? [];
  const medications = data.medications ?? [];
  const conditions = data.conditions ?? [];
  const dietaryRestrictions = data.dietaryRestrictions ?? [];

  const hasAnyMedical =
    allergies.length > 0 ||
    medications.length > 0 ||
    conditions.length > 0 ||
    dietaryRestrictions.length > 0;

  const hasSafetyCritical = allergies.length > 0 || medications.length > 0 || conditions.length > 0;

  if (!hasAnyMedical && !emergencyContact) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
        <HealthAndSafety sx={{ color: 'text.disabled', fontSize: 32, mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          No medical information on file.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {showSafetyAlert && hasSafetyCritical && (
        <Alert
          severity="warning"
          icon={<HealthAndSafety />}
          sx={{
            borderRadius: 2,
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>Medical Alert</AlertTitle>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {allergies.map((a, i) => (
              <Chip key={`alrg-${i}`} label={`⚠ ${a}`} size="small" color="error" sx={{ fontWeight: 600 }} />
            ))}
            {medications.map((m, i) => (
              <Chip key={`med-${i}`} label={`💊 ${m}`} size="small" color="info" sx={{ fontWeight: 600 }} />
            ))}
            {conditions.map((c, i) => (
              <Chip key={`cnd-${i}`} label={c} size="small" sx={{ fontWeight: 600, bgcolor: '#7b1fa2', color: '#fff' }} />
            ))}
          </Box>
        </Alert>
      )}

      {SECTIONS.map((section) => {
        const items = (data[section.key] ?? []) as string[];
        if (items.length === 0 && !showEmptySections) return null;
        return (
          <Paper
            key={section.key}
            variant="outlined"
            sx={{
              p: 1.75,
              borderRadius: 2,
              borderColor: 'rgba(0, 0, 0, 0.12)',
              backgroundColor: section.bgColor,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: items.length > 0 ? 1 : 0 }}>
              <Box sx={{ color: section.color, display: 'inline-flex' }}>{section.icon}</Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: section.color }}>
                {section.label}
              </Typography>
            </Box>
            {items.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {items.map((item, idx) => (
                  <Chip
                    key={`${section.key}-${idx}-${item}`}
                    label={item}
                    size="small"
                    sx={{
                      fontWeight: 500,
                      borderColor: section.color,
                      color: section.color,
                      backgroundColor: '#fff',
                    }}
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                None recorded
              </Typography>
            )}
          </Paper>
        );
      })}

      {emergencyContact && (
        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, borderColor: 'rgba(0, 0, 0, 0.12)', bgcolor: 'rgba(33, 150, 243, 0.04)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0', mb: 0.5 }}>
            Emergency Contact
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {emergencyContact}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
};

export default MedicalInfoDisplay;
