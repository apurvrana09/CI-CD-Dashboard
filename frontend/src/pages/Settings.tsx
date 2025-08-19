import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Stack,
  Checkbox,
  FormControlLabel,
  IconButton,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  JenkinsConfig,
  listJenkinsConfigs,
  createJenkinsConfig,
  updateJenkinsConfig,
  deleteJenkinsConfig,
  fetchJenkinsOverview,
} from '../services/jenkinsConfigs';
import {
  GitHubConfig,
  listGitHubConfigs,
  createGitHubConfig,
  updateGitHubConfig,
  deleteGitHubConfig,
} from '../services/githubConfigs';
import { getDashboardSettings, updateDashboardSettings } from '../services/settings';

type JenkinsForm = { name: string; baseUrl: string; username: string; password: string; active: boolean };
type GitHubForm = { name: string; owner: string; repo: string; token: string; active: boolean };

const Settings: React.FC = () => {
  const [items, setItems] = useState<JenkinsConfig[]>([]);
  const [ghItems, setGhItems] = useState<GitHubConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<JenkinsForm>({ name: '', baseUrl: '', username: '', password: '', active: false });
  const [ghForm, setGhForm] = useState<GitHubForm>({ name: '', owner: '', repo: '', token: '', active: false });
  const [overview, setOverview] = useState<{ jobs: { name: string; url: string; color?: string }[] } | null>(null);
  const [editJenkins, setEditJenkins] = useState<JenkinsConfig | null>(null);
  const [editForm, setEditForm] = useState<JenkinsForm>({ name: '', baseUrl: '', username: '', password: '', active: false });
  const [editGitHub, setEditGitHub] = useState<GitHubConfig | null>(null);
  const [editGhForm, setEditGhForm] = useState<GitHubForm>({ name: '', owner: '', repo: '', token: '', active: false });
  // Global dashboard preferences
  const [dashSelected, setDashSelected] = useState<Set<string>>(new Set());

  // Build a job URL that uses the configured baseUrl's origin/path but preserves the job path from Jenkins.
  function buildJobLink(jobUrl: string, selectedBaseUrl?: string): string {
    try {
      if (!selectedBaseUrl) return jobUrl;
      const job = new URL(jobUrl);
      const base = new URL(selectedBaseUrl);
      // Combine base pathname with job pathname to support Jenkins under a subpath
      const combinedPath = new URL(job.pathname, base.origin + base.pathname).pathname;
      return new URL(combinedPath, base.origin + base.pathname).toString();
    } catch {
      return jobUrl;
    }
  }

  // Dashboard preferences handlers
  const dashToggle = (key: string) => setDashSelected((prev: Set<string>) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const dashSelectAll = () => setDashSelected(new Set([
    ...items.map((c: any) => `jenkins:${c.id}`),
    ...ghItems.map((c: any) => `github:${c.id}`),
  ]));
  const dashSelectNone = () => setDashSelected(new Set());
  const dashSave = async () => {
    try {
      setLoading(true);
      await updateDashboardSettings({ selectedIntegrations: Array.from(dashSelected) });
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to save dashboard settings');
    } finally {
      setLoading(false);
    }
  };
  

  const activeId = useMemo(() => items.find((i: JenkinsConfig) => i.active)?.id || null, [items]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await listJenkinsConfigs();
      setItems(list);
      if (!selectedId && list.length) setSelectedId(list.find((i: JenkinsConfig) => i.active)?.id || list[0].id);
      const ghList = await listGitHubConfigs();
      setGhItems(ghList);
      // Load global dashboard settings
      try {
        const s = await getDashboardSettings();
        const keys = Array.isArray(s?.selectedIntegrations) ? s.selectedIntegrations : [];
        if (keys.length) setDashSelected(new Set(keys));
        else {
          const allKeys = [
            ...list.map((c: any) => `jenkins:${c.id}`),
            ...ghList.map((c: any) => `github:${c.id}`),
          ];
          setDashSelected(new Set(allKeys));
        }
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Edit Jenkins
  function openEditJenkins(it: JenkinsConfig) {
    setEditJenkins(it);
    setEditForm({
      name: it.name || '',
      baseUrl: it.baseUrl || '',
      username: (it as any).username || '',
      password: '',
      active: !!it.active,
    });
  }

  function closeEditJenkins() {
    setEditJenkins(null);
  }

  async function onSaveEditJenkins() {
    if (!editJenkins) return;
    try {
      setLoading(true);
      const payload: any = {
        name: editForm.name.trim(),
        baseUrl: editForm.baseUrl.trim(),
        active: editForm.active,
      };
      if (editForm.username.trim()) payload.username = editForm.username.trim();
      if (editForm.password.trim()) payload.password = editForm.password.trim();
      await updateJenkinsConfig(editJenkins.id, payload);
      closeEditJenkins();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  // Edit GitHub
  function openEditGitHub(it: GitHubConfig) {
    setEditGitHub(it);
    setEditGhForm({
      name: it.name || '',
      owner: it.owner || '',
      repo: it.repo || '',
      token: '',
      active: !!it.active,
    });
  }

  function closeEditGitHub() {
    setEditGitHub(null);
  }

  async function onSaveEditGitHub() {
    if (!editGitHub) return;
    try {
      setLoading(true);
      const payload: any = {
        name: editGhForm.name.trim(),
        owner: editGhForm.owner.trim(),
        repo: editGhForm.repo.trim(),
        active: editGhForm.active,
      };
      if (editGhForm.token.trim()) payload.token = editGhForm.token.trim();
      await updateGitHubConfig(editGitHub.id, payload);
      closeEditGitHub();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function onCreate() {
    try {
      setLoading(true);
      await createJenkinsConfig({
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        username: form.username.trim() || undefined,
        password: form.password.trim() || undefined,
        active: form.active,
      });
      setForm({ name: '', baseUrl: '', username: '', password: '', active: false });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSetActive(id: string) {
    try {
      setLoading(true);
      await updateJenkinsConfig(id, { active: true });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function onUnsetActive(id: string) {
    try {
      setLoading(true);
      await updateJenkinsConfig(id, { active: false });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this Jenkins integration?')) return;
    try {
      setLoading(true);
      await deleteJenkinsConfig(id);
      await load();
      if (selectedId === id) setSelectedId(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  }

  // GitHub handlers
  async function onCreateGitHub() {
    try {
      setLoading(true);
      await createGitHubConfig({
        name: ghForm.name.trim(),
        owner: ghForm.owner.trim(),
        repo: ghForm.repo.trim(),
        token: ghForm.token.trim(),
        active: ghForm.active,
      });
      setGhForm({ name: '', owner: '', repo: '', token: '', active: false });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSetActiveGitHub(id: string) {
    try {
      setLoading(true);
      await updateGitHubConfig(id, { active: true });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function onUnsetActiveGitHub(id: string) {
    try {
      setLoading(true);
      await updateGitHubConfig(id, { active: false });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteGitHub(id: string) {
    if (!confirm('Delete this GitHub integration?')) return;
    try {
      setLoading(true);
      await deleteGitHubConfig(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  }

  async function onLoadOverview(id: string) {
    try {
      setLoading(true);
      const data = await fetchJenkinsOverview(id);
      setOverview({ jobs: data.jobs });
      setSelectedId(id);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Add Jenkins Integration
            </Typography>
            <Stack spacing={2}>
              <TextField label="Name" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: JenkinsForm)=>({...f, name: e.target.value}))} fullWidth />
              <TextField label="Base URL" placeholder="http://host.docker.internal:8081" value={form.baseUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: JenkinsForm)=>({...f, baseUrl: e.target.value}))} fullWidth />
              <TextField label="Username" value={form.username} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: JenkinsForm)=>({...f, username: e.target.value}))} fullWidth />
              <TextField label="Password / API Token" type="password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: JenkinsForm)=>({...f, password: e.target.value}))} fullWidth />
              <FormControlLabel control={<Checkbox checked={form.active} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm((f: JenkinsForm)=>({...f, active: e.target.checked}))} />} label="Set as active" />
              <Button variant="contained" onClick={onCreate} disabled={loading || !form.name || !form.baseUrl}>Create</Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Jenkins Integrations
            </Typography>
            <List>
              {items.map((it: JenkinsConfig) => (
                <ListItem key={it.id} secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <IconButton edge="end" aria-label="edit" title="Edit" onClick={()=>openEditJenkins(it)}>
                      <EditIcon />
                    </IconButton>
                    {it.active ? (
                      <IconButton edge="end" aria-label="deactivate" title="Unset Active" onClick={()=>onUnsetActive(it.id)}>
                        <Chip size="small" label="On" color="success" />
                      </IconButton>
                    ) : (
                      <IconButton edge="end" aria-label="activate" title="Set Active" onClick={()=>onSetActive(it.id)}>
                        <CheckCircleIcon />
                      </IconButton>
                    )}
                    <IconButton edge="end" aria-label="delete" color="error" onClick={()=>onDelete(it.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                }>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" sx={{ cursor: 'pointer' }} onClick={()=>onLoadOverview(it.id)}>
                          {it.name}
                        </Typography>
                        {it.active && <Chip size="small" color="success" label="Active" />}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography variant="caption">{it.baseUrl}</Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* GitHub Section: Create */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Add GitHub Integration (per repository)
            </Typography>
            <Stack spacing={2}>
              <TextField label="Name" value={ghForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setGhForm((f: GitHubForm)=>({...f, name: e.target.value}))} fullWidth />
              <TextField label="Owner" placeholder="org-or-user" value={ghForm.owner} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setGhForm((f: GitHubForm)=>({...f, owner: e.target.value}))} fullWidth />
              <TextField label="Repo" placeholder="repository-name" value={ghForm.repo} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setGhForm((f: GitHubForm)=>({...f, repo: e.target.value}))} fullWidth />
              <TextField label="Token (PAT)" type="password" value={ghForm.token} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setGhForm((f: GitHubForm)=>({...f, token: e.target.value}))} fullWidth />
              <FormControlLabel control={<Checkbox checked={ghForm.active} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setGhForm((f: GitHubForm)=>({...f, active: e.target.checked}))} />} label="Set as active" />
              <Button variant="contained" onClick={onCreateGitHub} disabled={loading || !ghForm.name || !ghForm.owner || !ghForm.repo || !ghForm.token}>Create</Button>
            </Stack>
          </Paper>
        </Grid>

        {/* GitHub Section: List */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              GitHub Integrations
            </Typography>
            <List>
              {ghItems.map((it: GitHubConfig) => (
                <ListItem key={it.id} secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <IconButton edge="end" aria-label="edit" title="Edit" onClick={()=>openEditGitHub(it)}>
                      <EditIcon />
                    </IconButton>
                    {it.active ? (
                      <IconButton edge="end" aria-label="deactivate" title="Unset Active" onClick={()=>onUnsetActiveGitHub(it.id)}>
                        <Chip size="small" label="On" color="success" />
                      </IconButton>
                    ) : (
                      <IconButton edge="end" aria-label="activate" title="Set Active" onClick={()=>onSetActiveGitHub(it.id)}>
                        <CheckCircleIcon />
                      </IconButton>
                    )}
                    <IconButton edge="end" aria-label="delete" color="error" onClick={()=>onDeleteGitHub(it.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                }>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1">
                          {it.name}
                        </Typography>
                        {it.active && <Chip size="small" color="success" label="Active" />}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography variant="caption">{it.owner}/{it.repo}</Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Dashboard Preferences</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Select which integrations are shown by default on the Dashboard. This setting is global.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
              {items.map((cfg: JenkinsConfig) => {
                const key = `jenkins:${cfg.id}`;
                const on = dashSelected.has(key);
                return (
                  <Chip key={key} label={`Jenkins — ${cfg.name || cfg.baseUrl}`} color={on ? 'primary' : undefined} variant={on ? 'filled' : 'outlined'} onClick={()=>dashToggle(key)} clickable />
                );
              })}
              {ghItems.map((cfg: GitHubConfig) => {
                const key = `github:${cfg.id}`;
                const on = dashSelected.has(key);
                const label = cfg.name || (cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : 'GitHub');
                return (
                  <Chip key={key} label={`GitHub — ${label}`} color={on ? 'primary' : undefined} variant={on ? 'filled' : 'outlined'} onClick={()=>dashToggle(key)} clickable />
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={dashSelectAll}>Select All</Button>
              <Button size="small" variant="outlined" onClick={dashSelectNone}>Select None</Button>
              <Box flexGrow={1} />
              <Button size="small" variant="contained" onClick={dashSave} disabled={loading}>Save</Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6">Selected Integration</Typography>
              {selectedId && selectedId === activeId && <Chip size="small" color="success" label="Active" />}
            </Stack>
            <Divider sx={{ my: 2 }} />
            {overview ? (
              <>
                <Typography variant="subtitle1" gutterBottom>Jobs</Typography>
                <Grid container spacing={1}>
                  {overview.jobs.map((j: { name: string; url: string; color?: string }) => (
                    <Grid item key={j.name}>
                      <Chip
                        label={j.name}
                        component="a"
                        href={buildJobLink(j.url, items.find((i: JenkinsConfig) => i.id === selectedId)?.baseUrl)}
                        target="_blank"
                        clickable
                      />
                    </Grid>
                  ))}
                </Grid>
              </>
            ) : (
              <Typography variant="body2">Select an integration to view details.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Edit Jenkins Dialog */}
      <Dialog open={!!editJenkins} onClose={closeEditJenkins} fullWidth maxWidth="sm">
        <DialogTitle>Edit Jenkins Integration</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={editForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditForm((f: JenkinsForm)=>({...f, name: e.target.value}))} fullWidth />
            <TextField label="Base URL" value={editForm.baseUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditForm((f: JenkinsForm)=>({...f, baseUrl: e.target.value}))} fullWidth />
            <TextField label="Username" value={editForm.username} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditForm((f: JenkinsForm)=>({...f, username: e.target.value}))} fullWidth />
            <TextField label="Password / API Token (leave blank to keep)" type="password" value={editForm.password} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditForm((f: JenkinsForm)=>({...f, password: e.target.value}))} fullWidth />
            <FormControlLabel control={<Checkbox checked={editForm.active} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditForm((f: JenkinsForm)=>({...f, active: e.target.checked}))} />} label="Set as active" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditJenkins}>Cancel</Button>
          <Button variant="contained" onClick={onSaveEditJenkins} disabled={loading || !editForm.name || !editForm.baseUrl}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit GitHub Dialog */}
      <Dialog open={!!editGitHub} onClose={closeEditGitHub} fullWidth maxWidth="sm">
        <DialogTitle>Edit GitHub Integration</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={editGhForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditGhForm((f: GitHubForm)=>({...f, name: e.target.value}))} fullWidth />
            <TextField label="Owner" value={editGhForm.owner} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditGhForm((f: GitHubForm)=>({...f, owner: e.target.value}))} fullWidth />
            <TextField label="Repo" value={editGhForm.repo} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditGhForm((f: GitHubForm)=>({...f, repo: e.target.value}))} fullWidth />
            <TextField label="Token (leave blank to keep)" type="password" value={editGhForm.token} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditGhForm((f: GitHubForm)=>({...f, token: e.target.value}))} fullWidth />
            <FormControlLabel control={<Checkbox checked={editGhForm.active} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEditGhForm((f: GitHubForm)=>({...f, active: e.target.checked}))} />} label="Set as active" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditGitHub}>Cancel</Button>
          <Button variant="contained" onClick={onSaveEditGitHub} disabled={loading || !editGhForm.name || !editGhForm.owner || !editGhForm.repo}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;