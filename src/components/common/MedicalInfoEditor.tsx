/**
 * MedicalInfoEditor
 *
 * Chip-based multi-input editor for a student's medical information.
 * Edits four parallel arrays: allergies, conditions, medications, and
 * dietary restrictions. Type → press Enter (or comma) → adds a chip.
 * Click ✕ on a chip to remove it.
 *
 * Used by: Admin Student Management (add/edit student form).
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  Stack,
  Paper,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Medication as MedicationIcon,
  MedicalServices as MedicalServicesIcon,
  Restaurant as RestaurantIcon,
  AddCircleOutline,
} from '@mui/icons-material';
import type { MedicalInfo } from '../../contexts/DataContext';

export interface MedicalInfoEditorProps {
  value?: MedicalInfo | string | null;
  onChange: (next: MedicalInfo) => void;
  disabled?: boolean;
}

type SectionKey = keyof MedicalInfo;

interface SectionDef {
  key: SectionKey;
  label: string;
  placeholder: string;
  icon: React.ReactElement;
  color: string;
  bgColor: string;
}

const SECTIONS: SectionDef[] = [
  {
    key: 'allergies',
    label: 'Allergies',
    placeholder: 'e.g. Peanuts, Dairy, Bee stings',
    icon: <WarningIcon fontSize="small" />,
    color: '#d32f2f',
    bgColor: 'rgba(211, 47, 47, 0.06)',
  },
  {
    key: 'medications',
    label: 'Medications',
    placeholder: 'e.g. Inhaler, EpiPen',
    icon: <MedicationIcon fontSize="small" />,
    color: '#1976d2',
    bgColor: 'rgba(25, 118, 210, 0.06)',
  },
  {
    key: 'conditions',
    label: 'Medical Conditions',
    placeholder: 'e.g. Asthma, Diabetes',
    icon: <MedicalServicesIcon fontSize="small" />,
    color: '#7b1fa2',
    bgColor: 'rgba(123, 31, 162, 0.06)',
  },
  {
    key: 'dietaryRestrictions',
    label: 'Dietary Restrictions',
    placeholder: 'e.g. Vegetarian, Halal, Gluten-free',
    icon: <RestaurantIcon fontSize="small" />,
    color: '#2e7d32',
    bgColor: 'rgba(46, 125, 50, 0.06)',
  },
];

/** Coerce any incoming `value` (string, undefined, or object) to a clean MedicalInfo. */
function normalize(value: MedicalInfoEditorProps['value']): MedicalInfo {
  if (!value) {
    return { allergies: [], conditions: [], medications: [], dietaryRestrictions: [] };
  }
  if (typeof value === 'string') {
    // Legacy: free-text was stored as a string. Migrate by treating it as a
    // single allergy-bucket entry so the data is preserved on first edit.
    const trimmed = value.trim();
    return {
      allergies: trimmed ? [trimmed] : [],
      conditions: [],
      medications: [],
      dietaryRestrictions: [],
    };
  }
  return {
    allergies: value.allergies ?? [],
    conditions: value.conditions ?? [],
    medications: value.medications ?? [],
    dietaryRestrictions: value.dietaryRestrictions ?? [],
  };
}

const MedicalInfoEditor: React.FC<MedicalInfoEditorProps> = ({ value, onChange, disabled }) => {
  const data = normalize(value);
  const [drafts, setDrafts] = useState<Record<SectionKey, string>>({
    allergies: '',
    medications: '',
    conditions: '',
    dietaryRestrictions: '',
  });

  const setDraft = (key: SectionKey, v: string) =>
    setDrafts((prev) => ({ ...prev, [key]: v }));

  const commitDraft = (key: SectionKey) => {
    const raw = drafts[key].trim();
    if (!raw) return;
    // Allow comma-separated entries in a single keystroke
    const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return;
    const current = data[key] ?? [];
    const dedup = Array.from(new Set([...current, ...tokens]));
    onChange({ ...data, [key]: dedup });
    setDraft(key, '');
  };

  const removeChip = (key: SectionKey, idx: number) => {
    const current = data[key] ?? [];
    const next = current.filter((_, i) => i !== idx);
    onChange({ ...data, [key]: next });
  };

  return (
    <Stack spacing={2}>
      {SECTIONS.map((section) => {
        const items = data[section.key] ?? [];
        return (
          <Paper
            key={section.key}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              borderColor: 'rgba(0, 0, 0, 0.12)',
              backgroundColor: section.bgColor,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ color: section.color, display: 'inline-flex' }}>{section.icon}</Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: section.color }}>
                {section.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {items.length} {items.length === 1 ? 'entry' : 'entries'}
              </Typography>
            </Box>

            {items.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                {items.map((item, idx) => (
                  <Chip
                    key={`${section.key}-${idx}-${item}`}
                    label={item}
                    onDelete={disabled ? undefined : () => removeChip(section.key, idx)}
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
            )}

            <TextField
              size="small"
              fullWidth
              placeholder={section.placeholder}
              value={drafts[section.key]}
              onChange={(e) => setDraft(section.key, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitDraft(section.key);
                }
              }}
              onBlur={() => commitDraft(section.key)}
              disabled={disabled}
              InputProps={{
                endAdornment: (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: drafts[section.key] ? section.color : 'text.disabled',
                      cursor: drafts[section.key] && !disabled ? 'pointer' : 'default',
                      ml: 1,
                    }}
                    onClick={() => commitDraft(section.key)}
                    title="Add"
                  >
                    <AddCircleOutline fontSize="small" />
                  </Box>
                ),
                sx: { backgroundColor: '#fff' },
              }}
              helperText="Press Enter or comma to add"
            />
          </Paper>
        );
      })}
    </Stack>
  );
};

export default MedicalInfoEditor;
