import React from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Button } from '@mui/material';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const enableAlerts = (import.meta as any).env?.VITE_ENABLE_ALERTS === 'true'

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CI/CD Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            <Button color="inherit" onClick={() => navigate('/dashboard')}>Dashboard</Button>
            <Button color="inherit" onClick={() => navigate('/pipelines')}>Pipelines</Button>
            <Button color="inherit" onClick={() => navigate('/deployments')}>Deployments</Button>
            {enableAlerts && (
              <Button color="inherit" onClick={() => navigate('/alerts')}>Alerts</Button>
            )}
            <Button color="inherit" onClick={() => navigate('/settings')}>Settings</Button>
          </Box>
          <Button color="inherit" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
        {children}
      </Container>
    </Box>
  );
};

export default Layout; 