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
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PLATFORM } from '../../constants/platformBranding';

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
      setError('Login failed. Please check your credentials and try again.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${PLATFORM.colors.primary} 0%, ${PLATFORM.colors.secondary} 100%)`,
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 480, width: '100%', borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              component="img"
              src={PLATFORM.logo}
              alt={PLATFORM.name}
              sx={{ height: 70, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
            />
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                color: PLATFORM.colors.grey,
                fontStyle: 'italic',
                letterSpacing: '0.3px',
              }}
            >
              {PLATFORM.tagline}
            </Typography>
          </Box>

          <Typography
            variant="h6"
            align="center"
            sx={{
              mb: 3,
              fontWeight: 600,
              color: PLATFORM.colors.primary,
              borderBottom: `2px solid ${PLATFORM.colors.accent}`,
              pb: 1.5,
            }}
          >
            Sign In to Your Account
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
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: PLATFORM.colors.secondary },
                '& .MuiInputLabel-root.Mui-focused': { color: PLATFORM.colors.secondary },
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: PLATFORM.colors.secondary },
                '& .MuiInputLabel-root.Mui-focused': { color: PLATFORM.colors.secondary },
              }}
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
              sx={{
                py: 1.5,
                fontWeight: 700,
                fontSize: '1rem',
                background: `linear-gradient(135deg, ${PLATFORM.colors.primary} 0%, ${PLATFORM.colors.secondary} 100%)`,
                boxShadow: '0 4px 16px rgba(23,67,123,0.35)',
                borderRadius: 2,
                '&:hover': {
                  background: `linear-gradient(135deg, ${PLATFORM.colors.secondary} 0%, ${PLATFORM.colors.primary} 100%)`,
                  boxShadow: '0 6px 20px rgba(23,67,123,0.45)',
                },
              }}
            >
              Sign In
            </Button>
          </Box>

          {/* Footer */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: PLATFORM.colors.grey, fontSize: '0.7rem' }}>
              © {new Date().getFullYear()} {PLATFORM.name}. All rights reserved.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
