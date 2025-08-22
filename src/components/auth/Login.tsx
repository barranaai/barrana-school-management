import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
} from '@mui/material';
import { ExpandMore, School, ChildCare } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('school_admin');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login({ email, password, role });
      // Navigate based on role
      switch (role) {
        case 'super_admin':
          navigate('/super-admin');
          break;
        case 'school_admin':
          navigate('/admin');
          break;
        case 'teacher':
          navigate('/teachers');
          break;
        case 'parent':
          navigate('/parents');
          break;
        default:
          navigate('/admin');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  const handleDemoLogin = (demoRole: string) => {
    setRole(demoRole);
    
    // Use actual email addresses from the database
    let demoEmail = '';
    switch (demoRole) {
      case 'super_admin':
        demoEmail = 'alex.chen@barrana.ai';
        break;
      case 'school_admin':
        demoEmail = 'sarah.johnson@barranaischool.edu';
        break;
      case 'school_admin2':
        demoEmail = 'michael.thompson.admin@barranaischool.edu';
        break;
      case 'teacher':
        demoEmail = 'emily.rodriguez@barranaischool.edu';
        break;
      case 'teacher2':
        demoEmail = 'michael.chen@barranaischool.edu';
        break;
      case 'teacher3':
        demoEmail = 'sarah.williams@barranaischool.edu';
        break;
      case 'parent':
        demoEmail = 'jennifer.smith@email.com';
        break;
      case 'parent2':
        demoEmail = 'carlos.rodriguez@email.com';
        break;
      case 'parent3':
        demoEmail = 'sarah.johnson@email.com';
        break;
      case 'daycare_admin':
        demoEmail = 'jessica.martinez@barranadaycare.edu';
        break;
      case 'daycare_admin2':
        demoEmail = 'robert.wilson@barranadaycare.edu';
        break;
      case 'daycare_teacher':
        demoEmail = 'maria.rodriguez@barranadaycare.edu';
        break;
      case 'daycare_teacher2':
        demoEmail = 'sarah.johnson@barranadaycare.edu';
        break;
      case 'daycare_teacher3':
        demoEmail = 'emily.chen@barranadaycare.edu';
        break;
      case 'daycare_parent':
        demoEmail = 'jessica.martinez@email.com';
        break;
      case 'daycare_parent2':
        demoEmail = 'carlos.rodriguez@email.com';
        break;
      case 'daycare_parent3':
        demoEmail = 'sarah.johnson@email.com';
        break;
      default:
        demoEmail = 'alex.chen@barrana.ai';
    }
    
    setEmail(demoEmail);
    setPassword('demo123');
    
    // Auto-submit after a short delay
    setTimeout(() => {
      login({ email: demoEmail, password: 'demo123', role: demoRole })
        .then(() => {
          // Navigate based on role
          switch (demoRole) {
            case 'super_admin':
              navigate('/super-admin');
              break;
            case 'school_admin':
            case 'school_admin2':
            case 'daycare_admin':
            case 'daycare_admin2':
              navigate('/admin');
              break;
            case 'teacher':
            case 'teacher2':
            case 'teacher3':
            case 'daycare_teacher':
            case 'daycare_teacher2':
            case 'daycare_teacher3':
              navigate('/teachers');
              break;
            case 'parent':
            case 'parent2':
            case 'parent3':
            case 'daycare_parent':
            case 'daycare_parent2':
            case 'daycare_parent3':
              navigate('/parents');
              break;
            default:
              navigate('/admin');
          }
        })
        .catch((error) => {
          setError('Login failed. Please try again.');
        });
    }, 100);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            Barrana.ai
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
            School Management System
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                label="Role"
              >
                <MenuItem value="super_admin">Super Admin</MenuItem>
                <MenuItem value="school_admin">School Admin</MenuItem>
                <MenuItem value="teacher">Teacher</MenuItem>
                <MenuItem value="parent">Parent</MenuItem>
              </Select>
            </FormControl>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
            >
              Login
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Demo Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click any account below to auto-fill and login
          </Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <School sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Barrana AI School</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Super Admin
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('super_admin')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Alex Chen (alex.chen@barrana.ai) - Super Admin
                </Button>

                <Typography variant="subtitle2" color="primary" gutterBottom sx={{ mt: 2 }}>
                  School Admins
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('school_admin')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Dr. Sarah Johnson (sarah.johnson@barranaischool.edu) - School Admin
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('school_admin2')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Michael Thompson (michael.thompson.admin@barranaischool.edu) - School Admin
                </Button>

                <Typography variant="subtitle2" color="primary" gutterBottom sx={{ mt: 2 }}>
                  Teachers
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('teacher')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Emily Rodriguez (emily.rodriguez@barranaischool.edu) - Mathematics
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('teacher2')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Michael Chen (michael.chen@barranaischool.edu) - English Literature
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('teacher3')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Sarah Williams (sarah.williams@barranaischool.edu) - Science
                </Button>

                <Typography variant="subtitle2" color="primary" gutterBottom sx={{ mt: 2 }}>
                  Parents
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('parent')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Jennifer Smith (jennifer.smith@email.com) - Parent
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('parent2')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Carlos Rodriguez (carlos.rodriguez@email.com) - Parent
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('parent3')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Sarah Johnson (sarah.johnson@email.com) - Parent
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <ChildCare sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Barrana Day Care</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Daycare Admins
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_admin')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Ms. Jessica Martinez (jessica.martinez@barranadaycare.edu) - Daycare Director
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_admin2')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Mr. Robert Wilson (robert.wilson@barranadaycare.edu) - Assistant Director
                </Button>

                <Typography variant="subtitle2" color="primary" gutterBottom sx={{ mt: 2 }}>
                  Daycare Teachers
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_teacher')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Maria Rodriguez (maria.rodriguez@barranadaycare.edu) - Infant Care
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_teacher2')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Sarah Johnson (sarah.johnson@barranadaycare.edu) - Early Childhood Development
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_teacher3')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Emily Chen (emily.chen@barranadaycare.edu) - Toddler Education
                </Button>

                <Typography variant="subtitle2" color="primary" gutterBottom sx={{ mt: 2 }}>
                  Daycare Parents
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_parent')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Jessica Martinez (jessica.martinez@email.com) - Parent
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_parent2')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Carlos Rodriguez (carlos.rodriguez@email.com) - Parent
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleDemoLogin('daycare_parent3')}
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                >
                  Sarah Johnson (sarah.johnson@email.com) - Parent
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
            All demo accounts use password: <strong>demo123</strong>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login; 