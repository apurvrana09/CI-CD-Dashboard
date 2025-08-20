import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  MenuItem,
  Switch,
  FormControlLabel,
  Paper,
  Divider,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Snackbar,
  Alert as MuiAlert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import { createAlert, deleteAlert, listAlerts, testAlert, updateAlert, type Alert, type AlertType } from '../services/alerts';
import api from '../services/api';

const defaultType: AlertType = 'BUILD_FAILURE';

const Alerts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Alert[]>([]);
  const [name, setName] = useState('Build Failures (Email)');
  const [type, setType] = useState<AlertType>(defaultType);
  const [recipients, setRecipients] = useState(''); // comma-separated
  const [recentMinutes, setRecentMinutes] = useState<number>(120);
  const [provider, setProvider] = useState<'auto' | 'jenkins' | 'github'>('auto');
  const [jenkinsJobs, setJenkinsJobs] = useState<{ name: string }[]>([]);
  const [githubWorkflows, setGithubWorkflows] = useState<{ id: number; name: string }[]>([]);
  const [selectedJenkinsJob, setSelectedJenkinsJob] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [event, setEvent] = useState<'FAILURE' | 'SUCCESS' | 'COMPLETED'>('FAILURE');
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Provider', 'Integration', 'Target & Settings'];
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [toast, setToast] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>(() => ({ open: false, msg: '', sev: 'success' }));

  // Integrations
  type JenkinsCfg = { id: string; name: string };
  type GithubCfg = { id: string; name: string; owner: string; repo: string };
  const [jenkinsConfigs, setJenkinsConfigs] = useState<JenkinsCfg[]>([]);
  const [githubConfigs, setGithubConfigs] = useState<GithubCfg[]>([]);
  const [selectedJenkinsId, setSelectedJenkinsId] = useState('');
  const [selectedGithubId, setSelectedGithubId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAlerts({ limit: 50 });
      setItems(res?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Load integrations on open
  useEffect(() => {
    if (!openCreate) return;
    const loadConfigs = async () => {
      try {
        const [jk, gh] = await Promise.all([
          api.get('/integrations/jenkins-configs'),
          api.get('/integrations/github-configs'),
        ]);
        if (jk.data?.success) setJenkinsConfigs(jk.data.data || []);
        if (gh.data?.success) setGithubConfigs(gh.data.data || []);
      } catch {/* ignore */}
    };
    loadConfigs();
  }, [openCreate]);

  // Load selectable targets when integration changes
  useEffect(() => {
    const run = async () => {
      try {
        if (provider === 'jenkins' && selectedJenkinsId) {
          const { data } = await api.get('/integrations/jenkins/jobs', { params: { providerId: selectedJenkinsId } });
          if (data?.success) setJenkinsJobs(data.data || []);
        }
        if (provider === 'github' && selectedGithubId) {
          const { data } = await api.get('/integrations/github/workflows', { params: { providerId: selectedGithubId } });
          if (data?.success) setGithubWorkflows((data.data?.workflows || data.data || []).map((w: any) => ({ id: w.id, name: w.name })));
        }
      } catch {/* ignore */}
    };
    run();
  }, [provider, selectedJenkinsId, selectedGithubId]);

  const canCreate = useMemo(() => !!name.trim() && !!recipients.trim(), [name, recipients]);

  const commitCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const cond: any = { recentMinutes, event };
      if (provider !== 'auto') cond.provider = provider;
      if (provider === 'jenkins') {
        if (selectedJenkinsId) cond.jenkinsProviderId = selectedJenkinsId;
        if (selectedJenkinsJob.trim()) cond.jenkinsJob = selectedJenkinsJob.trim();
      }
      if (provider === 'github') {
        if (selectedGithubId) cond.githubProviderId = selectedGithubId;
        if (selectedWorkflowId.trim()) cond.githubWorkflowId = selectedWorkflowId.trim();
      }
      if (editingAlert) {
        await updateAlert(editingAlert.id, {
          name: name.trim(),
          type,
          conditions: cond,
          channels: { email: { to: recipients.trim() } },
        });
      } else {
        await createAlert({
          name: name.trim(),
          type,
          conditions: cond,
          channels: { email: { to: recipients.trim() } },
        });
      }
      setRecipients('');
      await load();
      setOpenCreate(false);
      setActiveStep(0);
      setEditingAlert(null);
      setToast({ open: true, msg: editingAlert ? 'Alert updated' : 'Alert created', sev: 'success' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (it: Alert, next: boolean) => {
    try {
      await updateAlert(it.id, { isActive: next });
      await load();
      setToast({ open: true, msg: `Alert ${next ? 'activated' : 'deactivated'}`, sev: 'success' });
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || 'Failed to update', sev: 'error' });
    }
  };

  const handleDelete = async (it: Alert) => {
    try {
      await deleteAlert(it.id);
      await load();
      setToast({ open: true, msg: 'Alert deleted', sev: 'success' });
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || 'Delete failed (check permissions)', sev: 'error' });
      // Also log to console for debugging
      /* eslint-disable no-console */
      console.error('Delete alert failed', e?.response || e);
    }
  };

  const openForEdit = (it: Alert) => {
    // Prefill fields from existing alert
    setEditingAlert(it);
    setName(it.name || '');
    setType(it.type as AlertType);
    const cond = (it.conditions || {}) as any;
    const ch = (it.channels || {}) as any;
    const prov = (cond.provider as any) || (cond.jenkinsProviderId ? 'jenkins' : cond.githubProviderId ? 'github' : 'jenkins');
    setProvider(prov);
    setSelectedJenkinsId(cond.jenkinsProviderId || '');
    setSelectedGithubId(cond.githubProviderId || '');
    setSelectedJenkinsJob(cond.jenkinsJob || '');
    setSelectedWorkflowId(String(cond.githubWorkflowId || ''));
    setEvent((String(cond.event || 'FAILURE').toUpperCase() as any));
    setRecentMinutes(Number(cond.recentMinutes || 120));
    setRecipients(ch.email?.to || '');
    setActiveStep(0);
    setOpenCreate(true);
  };

  const handleTest = async (email?: string) => {
    const to = (email ?? recipients).trim();
    if (!to) return;
    setTesting(to);
    try {
      await testAlert({ channels: { email: { to } }, title: 'CI/CD Test Alert', text: 'Hello from CI/CD Dashboard' });
    } finally {
      setTesting(null);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4">Alerts</Typography>
        <Button variant="contained" onClick={() => { setEditingAlert(null); setName('Build Failures (Email)'); setType(defaultType); setProvider('jenkins'); setSelectedJenkinsId(''); setSelectedGithubId(''); setSelectedJenkinsJob(''); setSelectedWorkflowId(''); setEvent('FAILURE'); setRecentMinutes(120); setRecipients(''); setActiveStep(0); setOpenCreate(true); }}>Create Alert</Button>
      </Stack>

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingAlert ? 'Edit Email Alert' : 'Create Email Alert'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}><StepLabel>{label}</StepLabel></Step>
              ))}
            </Stepper>

            {activeStep === 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value as AlertType)} fullWidth>
                    <MenuItem value="BUILD_FAILURE">Build Failure</MenuItem>
                    <MenuItem value="DEPLOYMENT_FAILURE">Deployment Failure</MenuItem>
                    <MenuItem value="PERFORMANCE_DEGRADATION">Performance Degradation</MenuItem>
                    <MenuItem value="SECURITY_ISSUE">Security Issue</MenuItem>
                    <MenuItem value="CUSTOM">Custom</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select label="Provider" value={provider} onChange={(e) => { setProvider(e.target.value as any); setSelectedJenkinsId(''); setSelectedGithubId(''); setSelectedJenkinsJob(''); setSelectedWorkflowId(''); }} fullWidth>
                    <MenuItem value="jenkins">Jenkins</MenuItem>
                    <MenuItem value="github">GitHub</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            )}

            {activeStep === 1 && (
              <Grid container spacing={2}>
                {provider === 'jenkins' && (
                  <Grid item xs={12} sm={8}>
                    <TextField select label="Jenkins Integration" value={selectedJenkinsId} onChange={(e) => setSelectedJenkinsId(e.target.value)} fullWidth>
                      {jenkinsConfigs.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
                    </TextField>
                  </Grid>
                )}
                {provider === 'github' && (
                  <Grid item xs={12} sm={8}>
                    <TextField select label="GitHub Integration" value={selectedGithubId} onChange={(e) => setSelectedGithubId(e.target.value)} fullWidth>
                      {githubConfigs.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name} ({c.owner}/{c.repo})</MenuItem>))}
                    </TextField>
                  </Grid>
                )}
              </Grid>
            )}

            {activeStep === 2 && (
              <Grid container spacing={2}>
                {provider === 'jenkins' && (
                  <Grid item xs={12}>
                    <TextField select label="Jenkins Job (optional)" value={selectedJenkinsJob} onChange={(e) => setSelectedJenkinsJob(e.target.value)} fullWidth>
                      <MenuItem value="">All Jobs</MenuItem>
                      {jenkinsJobs.map((j) => (<MenuItem key={j.name} value={j.name}>{j.name}</MenuItem>))}
                    </TextField>
                  </Grid>
                )}
                {provider === 'github' && (
                  <Grid item xs={12}>
                    <TextField select label="GitHub Workflow (optional)" value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)} fullWidth>
                      <MenuItem value="">All Workflows</MenuItem>
                      {githubWorkflows.map((w) => (<MenuItem key={w.id} value={String(w.id)}>{w.name}</MenuItem>))}
                    </TextField>
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField select label="Condition" value={event} onChange={(e) => setEvent(e.target.value as any)} fullWidth>
                    <MenuItem value="FAILURE">On Failure</MenuItem>
                    <MenuItem value="SUCCESS">On Success</MenuItem>
                    <MenuItem value="COMPLETED">On Completed</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Recent Minutes" type="number" inputProps={{ min: 5, step: 5 }} value={recentMinutes} onChange={(e) => setRecentMinutes(parseInt(e.target.value || '0', 10))} fullWidth />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Recipient Emails" placeholder="a@x.com, b@y.com" value={recipients} onChange={(e) => setRecipients(e.target.value)} helperText="Comma-separated emails" fullWidth />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="outlined" startIcon={<SendIcon />} onClick={() => handleTest()} disabled={!recipients.trim() || !!testing}>
                    {testing ? 'Sending…' : 'Send Test'}
                  </Button>
                </Grid>
              </Grid>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          {activeStep > 0 && <Button onClick={() => setActiveStep((s) => s - 1)}>Back</Button>}
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep((s) => s + 1)} disabled={(activeStep === 1 && provider === 'jenkins' && !selectedJenkinsId) || (activeStep === 1 && provider === 'github' && !selectedGithubId)}>
              Next
            </Button>
          ) : (
            <Button variant="contained" onClick={commitCreate} disabled={!canCreate || creating}>
              {creating ? (editingAlert ? 'Saving…' : 'Creating…') : (editingAlert ? 'Save' : 'Create')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h6">Your Alerts</Typography>
        {loading && <Chip size="small" label="Loading…" />}
        <IconButton size="small" onClick={load} aria-label="refresh"><RefreshIcon fontSize="small" /></IconButton>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Stack spacing={2}>
        {items.map((it) => (
          <Paper key={it.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Stack spacing={0.5}>
                <Typography variant="subtitle1">{it.name}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={it.type} color="default" />
                  {it.channels?.email?.to && <Chip size="small" label={`to: ${it.channels.email.to}`} />}
                  {typeof it.conditions?.recentMinutes === 'number' && <Chip size="small" label={`last ${it.conditions.recentMinutes}m`} />}
                  {it.conditions?.event && <Chip size="small" label={`on ${it.conditions.event.toLowerCase()}`} />}
                  {it.conditions?.provider && <Chip size="small" label={`${String(it.conditions.provider).toLowerCase()}`} />}
                  {it.conditions?.jenkinsJob && <Chip size="small" label={`job: ${it.conditions.jenkinsJob}`} />}
                  {it.conditions?.githubWorkflowId && <Chip size="small" label={`wf: ${it.conditions.githubWorkflowId}`} />}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="outlined" startIcon={<SendIcon />} onClick={() => handleTest(it.channels?.email?.to)}>
                  Test
                </Button>
                <IconButton onClick={() => openForEdit(it)} aria-label="edit"><EditIcon /></IconButton>
                <FormControlLabel
                  control={<Switch checked={!!it.isActive} onChange={(e) => handleToggleActive(it, e.target.checked)} />}
                  label={it.isActive ? 'Active' : 'Inactive'}
                />
                <IconButton color="error" onClick={() => handleDelete(it)} aria-label="delete">
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Stack>
          </Paper>
        ))}
        {items.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary">No alerts yet. Create one above.</Typography>
        )}
      </Stack>
      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert onClose={() => setToast((t) => ({ ...t, open: false }))} severity={toast.sev} variant="filled" sx={{ width: '100%' }}>
          {toast.msg}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default Alerts;