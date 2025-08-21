
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Pipelines from './pages/Pipelines';
import Deployments from './pages/Deployments';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import { useAuth } from './hooks/useAuth';

function App() {
  const { isAuthenticated, isLoading } = useAuth()
  const enableAlerts = (import.meta as any).env?.VITE_ENABLE_ALERTS === 'true'

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        Loading...
      </Box>
    )
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="/pipelines/:id" element={<Pipelines />} />
        {/* Back-compat: redirect Builds to Pipelines */}
        <Route path="/builds" element={<Navigate to="/pipelines" replace />} />
        <Route path="/builds/:id" element={<Navigate to="/pipelines/:id" replace />} />
        <Route path="/deployments" element={<Deployments />} />
        <Route path="/deployments/:id" element={<Deployments />} />
        {enableAlerts && <Route path="/alerts" element={<Alerts />} />}
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default App