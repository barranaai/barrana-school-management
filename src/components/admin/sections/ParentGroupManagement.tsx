import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Chip,
  CircularProgress,
  InputAdornment,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Group,
  Search,
  PersonAdd,
  PersonRemove,
  Close,
  People,
} from '@mui/icons-material';
import apiService from '../../../services/apiService';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';

interface ParentGroupManagementProps {
  schoolBranding?: any;
}

interface ParentGroupFormData {
  name: string;
  description: string;
}

interface Parent {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface ParentGroup {
  _id: string;
  name: string;
  description: string;
  memberCount: number;
  members: Array<{
    parentId: Parent;
  }>;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

const ParentGroupManagement: React.FC<ParentGroupManagementProps> = ({ schoolBranding }) => {
  const [groups, setGroups] = useState<ParentGroup[]>([]);
  const [allParents, setAllParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Dialog states
  const [openGroupDialog, setOpenGroupDialog] = useState(false);
  const [openMembersDialog, setOpenMembersDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ParentGroup | null>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  
  // Form states
  const [groupForm, setGroupForm] = useState<ParentGroupFormData>({
    name: '',
    description: '',
  });
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParents, setSelectedParents] = useState<Parent[]>([]);

  // Helper function to get branding colors
  const getBrandingColors = () => {
    const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';
    const secondaryColor = schoolBranding?.branding?.secondaryColor || schoolBranding?.secondaryColor || '#764ba2';
    return { primaryColor, secondaryColor };
  };

  const { primaryColor, secondaryColor } = getBrandingColors();
  const brandingGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
  const brandingGradientHover = `linear-gradient(135deg, ${primaryColor}dd 0%, ${secondaryColor}dd 100%)`;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsRes, parentsRes] = await Promise.all([
        apiService.request('/parent-groups'),
        apiService.request('/users', 'GET', undefined, { role: 'parent' }),
      ]);

      if (groupsRes.success) {
        setGroups(groupsRes.data);
      }
      
      if (parentsRes.success) {
        setAllParents(parentsRes.data);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGroupDialog = (group?: ParentGroup) => {
    if (group) {
      setIsEditingGroup(true);
      setSelectedGroup(group);
      setGroupForm({
        name: group.name,
        description: group.description,
      });
    } else {
      setIsEditingGroup(false);
      setSelectedGroup(null);
      setGroupForm({
        name: '',
        description: '',
      });
    }
    setOpenGroupDialog(true);
  };

  const handleCloseGroupDialog = () => {
    setOpenGroupDialog(false);
    setIsEditingGroup(false);
    setSelectedGroup(null);
    setGroupForm({
      name: '',
      description: '',
    });
  };

  const handleSubmitGroup = async () => {
    try {
      setError(null);
      
      if (!groupForm.name.trim()) {
        setError('Group name is required');
        return;
      }

      if (isEditingGroup && selectedGroup) {
        const response = await apiService.request(
          `/parent-groups/${selectedGroup._id}`,
          'PUT',
          groupForm
        );
        
        if (response.success) {
          setSuccess('Parent group updated successfully');
          loadData();
          handleCloseGroupDialog();
        }
      } else {
        const response = await apiService.request('/parent-groups', 'POST', groupForm);
        
        if (response.success) {
          setSuccess('Parent group created successfully');
          loadData();
          handleCloseGroupDialog();
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to save parent group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this parent group?')) return;

    try {
      const response = await apiService.request(`/parent-groups/${groupId}`, 'DELETE');
      
      if (response.success) {
        setSuccess('Parent group deleted successfully');
        loadData();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete parent group');
    }
  };

  const handleOpenMembersDialog = (group: ParentGroup) => {
    setSelectedGroup(group);
    setOpenMembersDialog(true);
  };

  const handleCloseMembersDialog = () => {
    setOpenMembersDialog(false);
    setSelectedGroup(null);
    setSelectedParents([]);
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedParents.length === 0) return;

    try {
      setError(null);
      
      const memberIds = selectedParents.map(p => p._id);
      const response = await apiService.request(
        `/parent-groups/${selectedGroup._id}/members`,
        'POST',
        { parentIds: memberIds }
      );
      
      if (response.success) {
        setSuccess(`Added ${selectedParents.length} member(s) to group`);
        setSelectedParents([]);
        loadData();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to add members');
    }
  };

  const handleRemoveMember = async (parentId: string) => {
    if (!selectedGroup) return;
    if (!window.confirm('Are you sure you want to remove this member from the group?')) return;

    try {
      const response = await apiService.request(
        `/parent-groups/${selectedGroup._id}/members/${parentId}`,
        'DELETE'
      );
      
      if (response.success) {
        setSuccess('Member removed from group');
        loadData();
        // Update the selected group to reflect the change
        const updatedGroup = groups.find(g => g._id === selectedGroup._id);
        if (updatedGroup) {
          setSelectedGroup(updatedGroup);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to remove member');
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAvailableParents = () => {
    if (!selectedGroup) return allParents;
    
    const memberIds = selectedGroup.members.map(m => m.parentId._id);
    return allParents.filter(p => !memberIds.includes(p._id));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  const getRandomCardColor = (index: number) => {
    return themeColors.cardColors[index % themeColors.cardColors.length];
  };

  return (
    <Box>
      {schoolBranding && (
        <Paper
          elevation={0}
          sx={{
            background: `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#273890'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#7f0f4a'} 100%)`,
            borderRadius: 4,
            p: 3,
            mb: 4,
            mt: 0,
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={9}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {schoolBranding.name || 'School Name'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                {schoolBranding.established && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📅 Est. {schoolBranding.established}
                  </Typography>
                )}
                {schoolBranding.address && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📍 {typeof schoolBranding.address === 'string' 
                      ? schoolBranding.address 
                      : `${schoolBranding.address.street}, ${schoolBranding.address.city}, ${schoolBranding.address.state}`}
                  </Typography>
                )}
                {schoolBranding.email && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    ✉️ {schoolBranding.email}
                  </Typography>
                )}
                {schoolBranding.phone && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📞 {schoolBranding.phone}
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              {(schoolBranding.logo || schoolBranding.branding?.logo) && (() => {
                const logoPath = schoolBranding.logo || schoolBranding.branding?.logo || '';
                const logoUrl = logoPath.startsWith('http://') || logoPath.startsWith('https://') 
                  ? logoPath 
                  : `${(process.env.REACT_APP_API_URL || 'http://localhost:5050').replace('/api', '')}${logoPath.startsWith('/') ? logoPath : '/' + logoPath}`;
                return (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Box sx={{
                      bgcolor: 'rgba(255,255,255,0.95)',
                      borderRadius: 3,
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <img 
                        src={logoUrl} 
                        alt={schoolBranding.name}
                        style={{ 
                          maxWidth: '120px',
                          maxHeight: '120px',
                          objectFit: 'contain'
                        }}
                      />
                    </Box>
                  </Box>
                );
              })()}
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography 
            variant="h5" 
            fontWeight={600} 
            gutterBottom
            sx={{
              background: schoolBranding 
                ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            👥 Parent Group Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create and manage parent groups for targeted communications
          </Typography>
        </Box>
        <NotificationIcon />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenGroupDialog()}
          sx={{
            background: brandingGradient,
            borderRadius: 2,
            px: 3,
            '&:hover': {
              background: brandingGradientHover,
            },
          }}
        >
          Create Group
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: primaryColor, width: 56, height: 56 }}>
                  <Group />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={600}>
                    {groups.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Groups
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#10b981', width: 56, height: 56 }}>
                  <People />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={600}>
                    {allParents.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Parents
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#f59e0b', width: 56, height: 56 }}>
                  <PersonAdd />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={600}>
                    {groups.reduce((sum, g) => sum + g.memberCount, 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Memberships
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search parent groups..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />

      {/* Groups Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f9fafb' }}>
            <TableRow>
              <TableCell><strong>Group Name</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell align="center"><strong>Members</strong></TableCell>
              <TableCell><strong>Created By</strong></TableCell>
              <TableCell><strong>Created</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm ? 'No groups found matching your search' : 'No parent groups created yet'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map((group) => (
                <TableRow key={group._id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Group color="primary" />
                      <Typography fontWeight={600}>{group.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {group.description || 'No description'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${group.memberCount} members`}
                      color="primary"
                      size="small"
                      onClick={() => handleOpenMembersDialog(group)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {group.createdBy?.firstName} {group.createdBy?.lastName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(group.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenMembersDialog(group)}
                        title="Manage Members"
                      >
                        <PersonAdd />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenGroupDialog(group)}
                        title="Edit Group"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteGroup(group._id)}
                        title="Delete Group"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Group Dialog */}
      <Dialog open={openGroupDialog} onClose={handleCloseGroupDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          background: brandingGradient,
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Typography variant="h6" fontWeight={600}>
            {isEditingGroup ? '✏️ Edit Parent Group' : '➕ Create Parent Group'}
          </Typography>
          <IconButton onClick={handleCloseGroupDialog} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: '24px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Group Name"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                required
                placeholder="e.g., Grade 1 Parents, Field Trip Committee"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Describe the purpose of this group..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={handleCloseGroupDialog} 
            variant="outlined"
            sx={{
              borderColor: '#d32f2f',
              color: '#d32f2f',
              '&:hover': {
                borderColor: '#b71c1c',
                backgroundColor: 'rgba(211, 47, 47, 0.05)',
                color: '#b71c1c',
              },
              '&:active': {
                borderColor: '#c62828',
                backgroundColor: 'rgba(198, 40, 40, 0.1)',
                color: '#c62828',
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitGroup}
            disabled={!groupForm.name.trim()}
            sx={{
              background: brandingGradient,
              px: 3,
              '&:hover': {
                background: brandingGradientHover,
              },
            }}
          >
            {isEditingGroup ? 'Update Group' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog 
        open={openMembersDialog} 
        onClose={handleCloseMembersDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            maxHeight: '80vh',
          }
        }}
      >
        {selectedGroup && (
          <>
            <DialogTitle sx={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Typography variant="h6" fontWeight={600}>
                👥 Manage Members: {selectedGroup.name}
              </Typography>
              <IconButton onClick={handleCloseMembersDialog} sx={{ color: 'white' }}>
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 3, pt: '24px !important' }}>
              {/* Add Members Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Add Members
                </Typography>
                <Autocomplete
                  multiple
                  options={getAvailableParents()}
                  getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
                  value={selectedParents}
                  onChange={(_, newValue) => setSelectedParents(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search and select parents..."
                      variant="outlined"
                    />
                  )}
                />
                {selectedParents.length > 0 && (
                  <Button
                    variant="contained"
                    startIcon={<PersonAdd />}
                    onClick={handleAddMembers}
                    sx={{ mt: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    Add {selectedParents.length} Member(s)
                  </Button>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Current Members Section */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Current Members ({selectedGroup.memberCount})
                </Typography>
                {selectedGroup.members.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No members in this group yet
                  </Typography>
                ) : (
                  <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
                    {selectedGroup.members.map((member) => (
                      <ListItem
                        key={member.parentId._id}
                        sx={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 2,
                          mb: 1,
                        }}
                      >
                        <Avatar sx={{ mr: 2, bgcolor: primaryColor }}>
                          {member.parentId.firstName[0]}{member.parentId.lastName[0]}
                        </Avatar>
                        <ListItemText
                          primary={`${member.parentId.firstName} ${member.parentId.lastName}`}
                          secondary={
                            <>
                              {member.parentId.email}
                              {member.parentId.phone && ` • ${member.parentId.phone}`}
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            color="error"
                            onClick={() => handleRemoveMember(member.parentId._id)}
                            title="Remove from group"
                          >
                            <PersonRemove />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={handleCloseMembersDialog} variant="contained">
                Done
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ParentGroupManagement;

