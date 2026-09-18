import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import {
  StandardPackage,
  StandardPackageAdoption,
  StandardPackageServiceError,
  standardPackageService
} from '../../../services/standardPackageService';

const genericFailure =
  'Unable to load or adopt Standard Packages. Check your access and connection, then try again.';

function assignedSchoolId(user: any): string {
  return typeof user?.schoolId === 'string'
    ? user.schoolId
    : user?.schoolId?._id || '';
}

function packageId(adoption: StandardPackageAdoption): string {
  return typeof adoption.packageId === 'string'
    ? adoption.packageId
    : adoption.packageId?._id;
}

function displayType(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map(word => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ');
}

export default function StandardPackageManagement() {
  const { user, token } = useAuth();
  const schoolId = assignedSchoolId(user);

  if (!user || !token || user.role !== 'school_admin' || !schoolId) {
    return <Alert severity="error">Organization Administrator access required.</Alert>;
  }

  return (
    <StandardPackageList
      key={user._id + token + schoolId}
      token={token}
    />
  );
}

function StandardPackageList({ token }: { token: string }) {
  const api = useMemo(() => standardPackageService(token), [token]);
  const [packages, setPackages] = useState<StandardPackage[]>([]);
  const [adoptions, setAdoptions] = useState<StandardPackageAdoption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState<StandardPackage>();
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([api.listPublished(), api.listAdoptions()])
      .then(([available, adopted]) => {
        if (!active) return;
        setPackages(available.filter(item => item.status === 'published'));
        setAdoptions(adopted);
      })
      .catch(() => {
        if (active) setError(genericFailure);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, refresh]);

  const adoptedIds = useMemo(
    () => new Set(adoptions.map(packageId)),
    [adoptions]
  );

  async function adopt() {
    if (!selected || busyId) return;
    const target = selected;
    setBusyId(target._id);
    setError('');
    setSuccess('');

    try {
      await api.adopt(target._id);
      setSelected(undefined);
      setSuccess(
        target.name +
          ' version ' +
          target.version +
          ' was adopted. This organization now has its own editable copy.'
      );
      setRefresh(value => value + 1);
    } catch (caught) {
      setSelected(undefined);
      if (
        caught instanceof StandardPackageServiceError &&
        caught.code === 'ALREADY_ADOPTED'
      ) {
        setError(
          'This package version has already been adopted by this organization.'
        );
        setRefresh(value => value + 1);
      } else if (
        caught instanceof StandardPackageServiceError &&
        caught.code === 'NOT_AUTHORIZED'
      ) {
        setError(
          'You are not authorized to adopt Standard Packages for this organization.'
        );
      } else {
        setError(genericFailure);
      }
    } finally {
      setBusyId('');
    }
  }

  return (
    <Stack spacing={3} sx={{ py: 3 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Standard Packages
        </Typography>
        <Typography color="text.secondary">
          Start with a ready-made Kidsible configuration and customize it for
          your organization. Adoption creates an independent organization-owned
          copy and never changes the Kidsible standard.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      {loading ? (
        <CircularProgress aria-label="Loading Standard Packages" />
      ) : packages.length === 0 ? (
        <Alert severity="info">
          No published Standard Packages are currently available.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {packages.map(item => {
            const adopted = adoptedIds.has(item._id);
            const types = item.organizationTypes?.length
              ? item.organizationTypes.map(displayType).join(', ')
              : 'All organization types';

            return (
              <Card key={item._id} variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                    >
                      <Typography variant="h6">{item.name}</Typography>
                      <Chip label={'Version ' + item.version} size="small" />
                      {adopted && (
                        <Chip label="Adopted" color="success" size="small" />
                      )}
                    </Stack>
                    <Typography color="text.secondary">
                      {item.description || 'No description provided.'}
                    </Typography>
                    <Typography variant="body2">
                      Organization type: {types}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Includes organization-owned Programs, Levels,
                      Requirements, Parameters, Roadmaps and Planned Sessions.
                    </Typography>
                    {adopted && (
                      <Alert severity="success">
                        This organization has its own editable copy.
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
                <CardActions>
                  <Button
                    variant="contained"
                    disabled={adopted || !!busyId}
                    onClick={() => setSelected(item)}
                    aria-label={'Adopt ' + item.name + ' version ' + item.version}
                  >
                    {adopted ? 'Adopted' : 'Adopt Standard'}
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog
        open={!!selected}
        onClose={() => {
          if (!busyId) setSelected(undefined);
        }}
      >
        <DialogTitle>Adopt Standard Package</DialogTitle>
        <DialogContent>
          <Typography>
            Adopt {selected?.name} version {selected?.version}? Kidsible will
            create an independent configuration for this organization. You can
            customize the copied configuration afterward.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={!!busyId} onClick={() => setSelected(undefined)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!!busyId}
            onClick={adopt}
          >
            {busyId ? 'Adopting...' : 'Confirm adoption'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
