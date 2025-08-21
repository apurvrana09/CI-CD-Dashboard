import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack, Divider, Table, TableHead, TableRow, TableCell, TableBody, Link as MuiLink, Accordion, AccordionSummary, AccordionDetails, List, ListItemButton, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab, Paper } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useParams, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';

type JobInfo = {
  name: string;
  displayName?: string;
  description?: string;
  color?: string;
  url?: string;
  lastBuild?: { number: number; url: string } | null;
  lastCompletedBuild?: { number: number; url: string } | null;
  lastSuccessfulBuild?: { number: number; url: string } | null;
  lastFailedBuild?: { number: number; url: string } | null;
};

type Build = {
  id: string;
  number: number;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
  url: string;
  fullDisplayName?: string;
};

type GitHubWorkflow = {
  id: number | string;
  name: string;
  state?: string;
  path?: string;
  html_url?: string;
};

type GitHubRun = {
  id: number | string;
  name?: string | null;
  display_title?: string | null;
  status?: string | null;
  conclusion?: string | null;
  run_number: number;
  run_started_at?: string | null;
  updated_at?: string | null;
  html_url: string;
};

const Pipelines: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const paramId = id || '';
  const decodedId = paramId ? decodeURIComponent(paramId) : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // configs
  const [jenkinsConfigs, setJenkinsConfigs] = useState<Array<{ id: string; name?: string; baseUrl: string; active?: boolean }>>([]);
  const [githubConfigs, setGithubConfigs] = useState<Array<{ id: string; name?: string; owner?: string; repo?: string; active?: boolean }>>([]);

  // UI state
  const [expandedProvider, setExpandedProvider] = useState<'jenkins' | 'github' | null>(null);
  const [expandedJenkins, setExpandedJenkins] = useState<Set<string>>(new Set());
  const [expandedGithub, setExpandedGithub] = useState<Set<string>>(new Set());
  const [activeBaseByJenkins, setActiveBaseByJenkins] = useState<Record<string, string>>({});

  // caches
  const [jenkinsJobsByProvider, setJenkinsJobsByProvider] = useState<Record<string, { name: string; url?: string }[]>>({});
  const [jenkinsInfoByKey, setJenkinsInfoByKey] = useState<Record<string, JobInfo | null>>({}); // key=`${providerId}:${job}` when details
  const [jenkinsBuildsByKey, setJenkinsBuildsByKey] = useState<Record<string, Build[]>>({}); // key=`${providerId}:${job}` when details
  const [jenkinsLoadingByKey, setJenkinsLoadingByKey] = useState<Record<string, boolean>>({});
  const [jenkinsErrorByKey, setJenkinsErrorByKey] = useState<Record<string, string | null>>({});
  const [jenkinsLastByProvider, setJenkinsLastByProvider] = useState<Record<string, Record<string, Build | null>>>({}); // providerId -> job -> lastBuild
  const [jenkinsMetricsByProvider, setJenkinsMetricsByProvider] = useState<Record<string, Record<string, { successRate: number; avgDurationMs: number }>>>({}); // providerId -> job -> metrics
  const [githubWorkflowsByProvider, setGithubWorkflowsByProvider] = useState<Record<string, GitHubWorkflow[]>>({});
  const [githubRunsByKey, setGithubRunsByKey] = useState<Record<string, GitHubRun[]>>({}); // key=`${providerId}:${workflow}` when details
  const [githubLoadingByKey, setGithubLoadingByKey] = useState<Record<string, boolean>>({});
  const [githubWorkflowStatsByProvider, setGithubWorkflowStatsByProvider] = useState<Record<string, Record<string, { lastStatus: string; lastAt?: string; successRate: number; avgDurationSec: number }>>>({});
  const [githubErrorByKey, setGithubErrorByKey] = useState<Record<string, string | null>>({});

  // Logs dialog state
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsTitle, setLogsTitle] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [logsContent, setLogsContent] = useState<string>('');

  // Details tab state
  const [detailTab, setDetailTab] = useState<number>(0);

  async function openJenkinsLogs(providerId: string, jobName: string, buildNumber: number) {
    try {
      setLogsTitle(`Jenkins • ${jobName} • #${buildNumber}`);
      setLogsOpen(true);
      setLogsLoading(true);
      setLogsContent('');
      const { data } = await api.get(`/integrations/jenkins/jobs/${encodeURIComponent(jobName)}/builds/${buildNumber}/log`, { params: { providerId }, responseType: 'text' as any });
      // Axios with responseType text returns string in data
      setLogsContent(typeof data === 'string' ? data : (data?.data || ''));
    } catch (err: any) {
      setLogsContent(err?.response?.data?.error || err?.message || 'Failed to fetch logs');
    } finally {
      setLogsLoading(false);
    }
  }

  async function openGithubLogs(providerId: string, runId: string | number, label: string) {
    try {
      setLogsTitle(`GitHub • ${label} • run ${runId}`);
      setLogsOpen(true);
      setLogsLoading(true);
      setLogsContent('');
      const { data } = await api.get(`/integrations/github/runs/${runId}/logs`, { params: { providerId }, responseType: 'text' as any });
      setLogsContent(typeof data === 'string' ? data : (data?.data || ''));
    } catch (err: any) {
      setLogsContent(err?.response?.data?.error || err?.message || 'Failed to fetch logs');
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [jenkinsCfgRes, githubCfgRes] = await Promise.all([
          api.get('/integrations/jenkins-configs'),
          api.get('/integrations/github-configs'),
        ]);
        const jcs = (jenkinsCfgRes.data.data || []) as Array<{ id: string; name?: string; baseUrl: string; active?: boolean }>;
        const gcs = (githubCfgRes.data.data || []) as Array<{ id: string; name?: string; owner?: string; repo?: string; active?: boolean }>;
        if (mounted) {
          setJenkinsConfigs(jcs);
          setGithubConfigs(gcs);
          if (jcs.length > 0) setExpandedProvider('jenkins'); else if (gcs.length > 0) setExpandedProvider('github');
          const bm: Record<string, string> = {};
          jcs.forEach((c) => { bm[c.id] = c.baseUrl; });
          setActiveBaseByJenkins(bm);
        }

        // If a pipeline id is present, try to auto-resolve the owning integration and expand it
        if (mounted && decodedId) {
          // Try GitHub first (numeric workflow ids are common)
          for (const cfg of gcs) {
            try {
              const { data } = await api.get('/integrations/github/workflows', { params: { providerId: cfg.id } });
              const wfs: GitHubWorkflow[] = ((data.data || data).workflows) || (data.data || data);
              setGithubWorkflowsByProvider((prev: Record<string, GitHubWorkflow[]>) => ({ ...prev, [cfg.id]: wfs || [] }));
              const match = (wfs || []).find((w: GitHubWorkflow) => String(w.id) === String(decodedId));
              if (match) {
                setExpandedProvider('github');
                // Exclusively expand the owning integration for this workflow
                setExpandedGithub(() => new Set([cfg.id]));
                const gKey = `${cfg.id}:${decodedId}`;
                if (!githubRunsByKey[gKey]) {
                  setGithubLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [gKey]: true }));
                  try {
                    const { data: runsData } = await api.get('/integrations/github/runs', { params: { providerId: cfg.id, workflow_id: decodedId, limit: 50 } });
                    const rs: GitHubRun[] = (runsData.data || runsData) as GitHubRun[];
                    setGithubRunsByKey((prev: Record<string, GitHubRun[]>) => ({ ...prev, [gKey]: rs || [] }));
                  } catch (_) { /* ignore */ }
                  finally { setGithubLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [gKey]: false })); }
                }
                // Stop after first match
                break;
              }
            } catch (_) { /* ignore and try next cfg */ }
          }

          // Try Jenkins if no GitHub match: find integration that contains the job name
          const anyGhRuns = (Object.values(githubRunsByKey) as GitHubRun[][]).some(arr => (arr || []).length > 0);
          if (!anyGhRuns) {
            for (const cfg of jcs) {
              try {
                const { data } = await api.get('/integrations/jenkins/overview', { params: { providerId: cfg.id } });
                const jobs = (data.data?.jobs || data.jobs || []) as { name: string; url?: string }[];
                setJenkinsJobsByProvider((prev: Record<string, { name: string; url?: string }[]>) => ({ ...prev, [cfg.id]: jobs }));
                const has = (jobs || []).some((j: { name: string; url?: string }) => j.name === decodedId);
                if (has) {
                  setExpandedProvider('jenkins');
                  // Exclusively expand the owning integration for this job
                  setExpandedJenkins(() => new Set([cfg.id]));
                  try {
                    const [infoRes, buildsRes] = await Promise.all([
                      api.get(`/integrations/jenkins/jobs/${encodeURIComponent(decodedId)}/info`, { params: { providerId: cfg.id } }),
                      api.get(`/integrations/jenkins/jobs/${encodeURIComponent(decodedId)}/builds`, { params: { providerId: cfg.id, limit: 25 } }),
                    ]);
                    const jKey = `${cfg.id}:${decodedId}`;
                    setJenkinsInfoByKey((prev: Record<string, JobInfo | null>) => ({ ...prev, [jKey]: (infoRes.data.data || infoRes.data) as JobInfo }));
                    const list: Build[] = (buildsRes.data.data?.builds || buildsRes.data.builds || []) as Build[];
                    setJenkinsBuildsByKey((prev: Record<string, Build[]>) => ({ ...prev, [jKey]: list }));
                    setJenkinsErrorByKey((prev: Record<string, string | null>) => ({ ...prev, [jKey]: null }));
                  } catch (err: any) {
                    const msg = err?.response?.data?.error || err?.message || 'Failed to fetch builds';
                    const jKey = `${cfg.id}:${decodedId}`;
                    setJenkinsErrorByKey((prev: Record<string, string | null>) => ({ ...prev, [jKey]: msg }));
                  }
                  break;
                }
              } catch (_) { /* ignore */ }
            }
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.error || e.message || 'Failed to load pipelines');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [paramId]);

  function fixUrlForBase(u?: string | null, baseUrl?: string | null): string | undefined {
    try {
      if (!u) return undefined;
      if (!baseUrl) return u;
      const base = new URL(baseUrl);
      const original = new URL(u);
      return new URL(original.pathname + original.search + original.hash, base.origin + base.pathname).toString();
    } catch {
      return u || undefined;
    }
  }

  const statusChip = (result: string | null, building: boolean) => {
    if (building) return <Chip label="RUNNING" color="info" size="small"/>;
    switch (result) {
      case 'SUCCESS': return <Chip label="SUCCESS" color="success" size="small"/>;
      case 'FAILURE': return <Chip label="FAILURE" color="error" size="small"/>;
      case 'ABORTED': return <Chip label="ABORTED" color="warning" size="small"/>;
      case 'UNSTABLE': return <Chip label="UNSTABLE" color="warning" size="small"/>;
      default: return <Chip label={result || 'UNKNOWN'} size="small"/>;
    }
  };

  const ghStatusChip = (statusOrConclusion?: string | null) => {
    const val = (statusOrConclusion || 'UNKNOWN').toUpperCase();
    switch (val) {
      case 'SUCCESS': return <Chip label="SUCCESS" color="success" size="small"/>;
      case 'FAILURE': return <Chip label="FAILURE" color="error" size="small"/>;
      case 'CANCELLED': return <Chip label="CANCELLED" color="warning" size="small"/>;
      case 'TIMED_OUT': return <Chip label="TIMED_OUT" color="warning" size="small"/>;
      case 'IN_PROGRESS': return <Chip label="RUNNING" color="info" size="small"/>;
      case 'QUEUED': return <Chip label="QUEUED" color="info" size="small"/>;
      case 'PENDING': return <Chip label="PENDING" size="small"/>;
      default: return <Chip label={val} size="small"/>;
    }
  };

  const successRateChip = (rate?: number) => {
    if (rate === undefined || rate === null) return '—';
    const r = Math.max(0, Math.min(100, Math.round(rate)));
    const label = `${r}%`;
    if (r >= 80) return <Chip label={label} color="success" size="small"/>;
    if (r >= 50) return <Chip label={label} color="warning" size="small"/>;
    return <Chip label={label} color="error" size="small"/>;
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>Pipelines</Typography>
        {paramId && (
          <MuiLink component={RouterLink} to="/pipelines">← Back to Pipelines</MuiLink>
        )}
      </Stack>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography color="error">{error}</Typography>}
      {!loading && !error && (
        <Stack spacing={2}>
          {/* Details: Single-page drill-down when an id is present */}
          {paramId && (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  {(() => {
                    // Prefer a friendly title over raw id/path
                    let title: string = decodedId;
                    // Try GitHub workflow name by id or path
                    outer: for (const pid of Object.keys(githubWorkflowsByProvider)) {
                      const list = githubWorkflowsByProvider[pid] || [];
                      for (const w of list) {
                        if (String(w.id) === String(decodedId) || (w.path && w.path === decodedId)) { title = w.name || String(decodedId); break outer; }
                      }
                    }
                    // Optionally, use Jenkins job displayName if we have it cached
                    if (title === decodedId) {
                      for (const pid of Object.keys(jenkinsInfoByKey)) {
                        const key = `${pid}:${decodedId}`;
                        const info = (jenkinsInfoByKey as any)[key];
                        if (info && (info.displayName || info.name)) { title = info.displayName || info.name; break; }
                      }
                    }
                    return <Typography variant="h5">{title}</Typography>;
                  })()}
                  <Tabs value={detailTab} onChange={(_e, v) => setDetailTab(v)} textColor="primary" indicatorColor="primary">
                    <Tab label="Overview" />
                    <Tab label="Runs" />
                  </Tabs>
                  <Divider />
                  {/* Determine selected context */}
                  {(() => {
                    let sel: { kind: 'jenkins' | 'github' | null; providerId?: string } = { kind: null };
                    // Try GitHub
                    for (const pid of Object.keys(githubWorkflowsByProvider)) {
                      const list = githubWorkflowsByProvider[pid] || [];
                      if (list.some((w) => String(w.id) === String(decodedId))) { sel = { kind: 'github', providerId: pid }; break; }
                    }
                    // Fallback Jenkins
                    if (!sel.kind) {
                      for (const pid of Object.keys(jenkinsJobsByProvider)) {
                        const list = jenkinsJobsByProvider[pid] || [];
                        if (list.some((j) => j.name === decodedId)) { sel = { kind: 'jenkins', providerId: pid }; break; }
                      }
                    }

                    if (!sel.kind) {
                      return <Typography color="text.secondary">Resolving selection…</Typography>;
                    }

                    if (detailTab === 0) {
                      // Overview
                      if (sel.kind === 'jenkins') {
                        const m = jenkinsMetricsByProvider[sel.providerId!] || {};
                        const stats = m[decodedId];
                        const last = jenkinsLastByProvider[sel.providerId!]?.[decodedId] || null;
                        return (
                          <Stack direction="row" spacing={1}>
                            <Chip label={`Last: ${last?.result || '—'}`} color={last?.result === 'SUCCESS' ? 'success' : (last?.result === 'FAILURE' ? 'error' : 'default')} />
                            <Chip label={`Avg: ${stats ? Math.round(stats.avgDurationMs/1000) : '—'}s`} />
                            <Chip label={`Success: ${stats ? Math.round(stats.successRate) : '—'}%`} color={stats ? (stats.successRate >= 80 ? 'success' : (stats.successRate >= 50 ? 'warning' : 'error')) : 'default'} />
                          </Stack>
                        );
                      } else {
                        const gStats = githubWorkflowStatsByProvider[sel.providerId!] || {};
                        const st = gStats[String(decodedId)];
                        return (
                          <Stack direction="row" spacing={1}>
                            <Chip label={`Last: ${st?.lastStatus || '—'}`} color={st?.lastStatus === 'SUCCESS' ? 'success' : (st?.lastStatus === 'FAILURE' ? 'error' : 'default')} />
                            <Chip label={`Avg: ${st ? Math.round(st.avgDurationSec) : '—'}s`} />
                            <Chip label={`Success: ${st ? Math.round(st.successRate) : '—'}%`} color={st ? (st.successRate >= 80 ? 'success' : (st.successRate >= 50 ? 'warning' : 'error')) : 'default'} />
                          </Stack>
                        );
                      }
                    }

                    if (detailTab === 1) {
                      // Runs table
                      if (sel.kind === 'jenkins') {
                        const jKey = `${sel.providerId}:${decodedId}`;
                        const list = jenkinsBuildsByKey[jKey] || [];
                        const loadingRow = jenkinsLoadingByKey[jKey];
                        const err = jenkinsErrorByKey[jKey];
                        return (
                          <Paper variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>#</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Started</TableCell>
                                  <TableCell>Duration</TableCell>
                                  <TableCell>Logs</TableCell>
                                  <TableCell>Open</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {loadingRow && <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>}
                                {err && <TableRow><TableCell colSpan={6}><Typography color="error">{err}</Typography></TableCell></TableRow>}
                                {(!list || list.length === 0) && !loadingRow && !err && (
                                  <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No runs</Typography></TableCell></TableRow>
                                )}
                                {list.map((b) => (
                                  <TableRow key={b.number} hover>
                                    <TableCell>#{b.number}</TableCell>
                                    <TableCell>{statusChip(b.result, b.building)}</TableCell>
                                    <TableCell>{new Date(b.timestamp).toLocaleString()}</TableCell>
                                    <TableCell>{Math.round((b.duration || 0)/1000)}s</TableCell>
                                    <TableCell><Button size="small" onClick={() => openJenkinsLogs(sel.providerId!, decodedId, b.number)}>Logs</Button></TableCell>
                                    <TableCell>{b.url && <MuiLink href={fixUrlForBase(b.url, activeBaseByJenkins[sel.providerId!])} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Paper>
                        );
                      } else {
                        const gKey = `${sel.providerId}:${decodedId}`;
                        const list = githubRunsByKey[gKey] || [];
                        const loadingRow = githubLoadingByKey[gKey];
                        const err = githubErrorByKey[gKey];
                        return (
                          <Paper variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>#</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Started</TableCell>
                                  <TableCell>Updated</TableCell>
                                  <TableCell>Logs</TableCell>
                                  <TableCell>Open</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {loadingRow && <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>}
                                {err && <TableRow><TableCell colSpan={6}><Typography color="error">{err}</Typography></TableCell></TableRow>}
                                {(!list || list.length === 0) && !loadingRow && !err && (
                                  <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No runs</Typography></TableCell></TableRow>
                                )}
                                {list.map((r) => (
                                  <TableRow key={String(r.id)} hover>
                                    <TableCell>#{r.run_number}</TableCell>
                                    <TableCell>{ghStatusChip(r.conclusion || r.status)}</TableCell>
                                    <TableCell>{r.run_started_at ? new Date(r.run_started_at).toLocaleString() : '—'}</TableCell>
                                    <TableCell>{r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}</TableCell>
                                    <TableCell><Button size="small" onClick={() => openGithubLogs(sel.providerId!, r.id, decodedId)}>Logs</Button></TableCell>
                                    <TableCell>{r.html_url && <MuiLink href={r.html_url} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Paper>
                        );
                      }
                    }

                    return null;
                  })()}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Jenkins */}
          {!paramId && (
          <Accordion expanded={expandedProvider === 'jenkins'} onChange={(_e: React.SyntheticEvent, exp: boolean) => setExpandedProvider(exp ? 'jenkins' : null)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
              <Typography variant="h6">Jenkins</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {jenkinsConfigs.length === 0 && <Typography color="text.secondary">No Jenkins integrations configured</Typography>}
              <List disablePadding>
                {jenkinsConfigs.map((cfg: { id: string; name?: string; baseUrl: string }) => (
                  <Box key={cfg.id} sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <ListItemButton onClick={async () => {
                      const next = new Set(expandedJenkins);
                      if (next.has(cfg.id)) { next.delete(cfg.id); setExpandedJenkins(next); return; }
                      next.add(cfg.id); setExpandedJenkins(next);
                      if (!jenkinsJobsByProvider[cfg.id]) {
                        try {
                          const { data } = await api.get('/integrations/jenkins/overview', { params: { providerId: cfg.id } });
                          const jobs = (data.data?.jobs || data.jobs || []) as { name: string; url?: string }[];
                          setJenkinsJobsByProvider((prev: Record<string, { name: string; url?: string }[]>) => ({ ...prev, [cfg.id]: jobs }));
                          const lastBuilds: Array<{ job: string; lastBuild: Build | null }> = (data.data?.lastBuilds || data.lastBuilds || []) as any;
                          if (lastBuilds && lastBuilds.length) {
                            const map: Record<string, Build | null> = {};
                            lastBuilds.forEach((lb) => { map[lb.job] = lb.lastBuild || null; });
                            setJenkinsLastByProvider((prev: Record<string, Record<string, Build | null>>) => ({ ...prev, [cfg.id]: map }));
                          } else {
                            setJenkinsLastByProvider((prev: Record<string, Record<string, Build | null>>) => ({ ...prev, [cfg.id]: {} }));
                          }
                        } catch { setJenkinsJobsByProvider((prev: Record<string, { name: string; url?: string }[]>) => ({ ...prev, [cfg.id]: [] })); }
                      }
                      // Load Jenkins metrics summary per job for this integration (window=30)
                      if (!jenkinsMetricsByProvider[cfg.id]) {
                        try {
                          const { data } = await api.get('/integrations/jenkins/metrics/summary', { params: { providerId: cfg.id, window: 30, perJob: true } });
                          const perJob = (data.data?.perJob || []) as Array<{ job: string; successRate: number; avgDurationMs: number }>;
                          const map: Record<string, { successRate: number; avgDurationMs: number }> = {};
                          perJob.forEach((p) => { map[p.job] = { successRate: p.successRate || 0, avgDurationMs: p.avgDurationMs || 0 }; });
                          setJenkinsMetricsByProvider((prev: Record<string, Record<string, { successRate: number; avgDurationMs: number }>>) => ({ ...prev, [cfg.id]: map }));
                        } catch {
                          setJenkinsMetricsByProvider((prev: Record<string, Record<string, { successRate: number; avgDurationMs: number }>>) => ({ ...prev, [cfg.id]: {} }));
                        }
                      }
                      // if details route, prefetch info/builds ONLY if this integration owns the selected job
                      if (paramId && (jenkinsJobsByProvider[cfg.id] || []).some((j: { name: string; url?: string }) => j.name === decodedId)) {
                        const jKey = `${cfg.id}:${decodedId}`;
                        if (!jenkinsInfoByKey[jKey] || !jenkinsBuildsByKey[jKey]) {
                          setJenkinsLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [jKey]: true }));
                          try {
                            const [infoRes, buildsRes] = await Promise.all([
                              api.get(`/integrations/jenkins/jobs/${encodeURIComponent(decodedId)}/info`, { params: { providerId: cfg.id } }),
                              api.get(`/integrations/jenkins/jobs/${encodeURIComponent(decodedId)}/builds`, { params: { providerId: cfg.id, limit: 25 } }),
                            ]);
                            setJenkinsInfoByKey((prev: Record<string, JobInfo | null>) => ({ ...prev, [jKey]: (infoRes.data.data || infoRes.data) as JobInfo }));
                            const list: Build[] = (buildsRes.data.data?.builds || buildsRes.data.builds || []) as Build[];
                            setJenkinsBuildsByKey((prev: Record<string, Build[]>) => ({ ...prev, [jKey]: list }));
                            setJenkinsErrorByKey((prev: Record<string, string | null>) => ({ ...prev, [jKey]: null }));
                          } catch (err: any) {
                            console.error('Jenkins job fetch failed', cfg.id, paramId, err?.response?.status, err?.response?.data || err?.message);
                            setJenkinsInfoByKey((prev: Record<string, JobInfo | null>) => ({ ...prev, [jKey]: null }));
                            setJenkinsBuildsByKey((prev: Record<string, Build[]>) => ({ ...prev, [jKey]: [] }));
                            const msg = err?.response?.data?.error || err?.message || 'Failed to fetch builds';
                            setJenkinsErrorByKey((prev: Record<string, string | null>) => ({ ...prev, [jKey]: msg }));
                          }
                          finally { setJenkinsLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [jKey]: false })); }
                        }
                      }
                    }}>
                      <ListItemText primary={cfg.name || 'Jenkins'} secondary={cfg.baseUrl} />
                      <ExpandMoreIcon sx={{ transform: expandedJenkins.has(cfg.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </ListItemButton>
                    {expandedJenkins.has(cfg.id) && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        {!paramId && (
                          <>
                            <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Jobs</Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Job</TableCell>
                                  <TableCell>Last</TableCell>
                                  <TableCell>Success</TableCell>
                                  <TableCell>Avg Duration</TableCell>
                                  <TableCell>Open</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(!jenkinsJobsByProvider[cfg.id] || jenkinsJobsByProvider[cfg.id].length === 0) && (
                                  <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No jobs</Typography></TableCell></TableRow>
                                )}
                                {(jenkinsJobsByProvider[cfg.id] || []).map((j: { name: string; url?: string }) => (
                                  <TableRow key={j.name} hover>
                                    <TableCell>
                                      <MuiLink component={RouterLink} to={`/pipelines/${encodeURIComponent(j.name)}`}>{j.name}</MuiLink>
                                    </TableCell>
                                    <TableCell>
                                      {jenkinsLastByProvider[cfg.id]?.[j.name]
                                        ? statusChip(jenkinsLastByProvider[cfg.id][j.name]!.result, jenkinsLastByProvider[cfg.id][j.name]!.building)
                                        : <Typography color="text.secondary">—</Typography>}
                                    </TableCell>
                                    <TableCell>
                                      {jenkinsMetricsByProvider[cfg.id]?.[j.name]?.successRate !== undefined
                                        ? `${jenkinsMetricsByProvider[cfg.id][j.name].successRate}%`
                                        : '—'}
                                    </TableCell>
                                    <TableCell>
                                      {jenkinsMetricsByProvider[cfg.id]?.[j.name]?.avgDurationMs !== undefined
                                        ? `${Math.round((jenkinsMetricsByProvider[cfg.id][j.name].avgDurationMs || 0)/1000)}s`
                                        : '—'}
                                    </TableCell>
                                    <TableCell>{j.url && <MuiLink href={fixUrlForBase(j.url, activeBaseByJenkins[cfg.id])} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </>
                        )}
                        {paramId && (
                          <Stack spacing={3}>
                            {/* Only show details if this integration actually has the selected job */}
                            {(jenkinsJobsByProvider[cfg.id] || []).some((j: { name: string; url?: string }) => j.name === decodedId) && (
                              <>
                                {jenkinsInfoByKey[`${cfg.id}:${decodedId}`] !== undefined && (
                                  <Card>
                                    <CardContent>
                                      {jenkinsInfoByKey[`${cfg.id}:${decodedId}`] ? (
                                        <>
                                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Box>
                                              <Typography variant="h6">{jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.displayName || jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.name}</Typography>
                                              {jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.description && (
                                                <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.description}</Typography>
                                              )}
                                            </Box>
                                            {jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.url && (
                                              <MuiLink href={fixUrlForBase(jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.url, activeBaseByJenkins[cfg.id])} target="_blank" rel="noreferrer">
                                                Open in Jenkins ↗
                                              </MuiLink>
                                            )}
                                          </Stack>
                                          <Divider sx={{ mt: 2 }} />
                                          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                                            {jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastBuild && <Chip label={`Last: #${jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastBuild?.number}`} />}
                                            {jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastCompletedBuild && <Chip label={`Completed: #${jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastCompletedBuild?.number}`} />}
                                            {jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastSuccessfulBuild && <Chip color="success" label={`Successful: #${jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastSuccessfulBuild?.number}`} />}
                                            {jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastFailedBuild && <Chip color="error" label={`Failed: #${jenkinsInfoByKey[`${cfg.id}:${decodedId}`]?.lastFailedBuild?.number}`} />}
                                          </Stack>
                                        </>
                                      ) : (
                                        <Typography color="text.secondary">No info found for this job in this integration</Typography>
                                      )}
                                    </CardContent>
                                  </Card>
                                )}
                                <Card>
                                  <CardContent>
                                    <Typography variant="h6" gutterBottom>Build History</Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    {jenkinsErrorByKey[`${cfg.id}:${decodedId}`] && (
                                      <Typography color="error" sx={{ mb: 1 }}>Error: {jenkinsErrorByKey[`${cfg.id}:${decodedId}`]}</Typography>
                                    )}
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Build</TableCell>
                                          <TableCell>Status</TableCell>
                                          <TableCell>Duration</TableCell>
                                          <TableCell>When</TableCell>
                                          <TableCell>Logs</TableCell>
                                          <TableCell>Open</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {jenkinsLoadingByKey[`${cfg.id}:${decodedId}`] && (
                                          <TableRow><TableCell colSpan={6}><Typography color="text.secondary">Loading...</Typography></TableCell></TableRow>
                                        )}
                                        {!jenkinsLoadingByKey[`${cfg.id}:${decodedId}`] && (!jenkinsBuildsByKey[`${cfg.id}:${decodedId}`] || jenkinsBuildsByKey[`${cfg.id}:${decodedId}`].length === 0) && (
                                          <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No builds</Typography></TableCell></TableRow>
                                        )}
                                        {(jenkinsBuildsByKey[`${cfg.id}:${decodedId}`] || []).map((b: Build) => (
                                          <TableRow key={`${cfg.id}#${b.number}`} hover>
                                            <TableCell>#{b.number}</TableCell>
                                            <TableCell>{statusChip(b.result, b.building)}</TableCell>
                                            <TableCell>{Math.round(b.duration/1000)}s</TableCell>
                                            <TableCell>{new Date(b.timestamp).toLocaleString()}</TableCell>
                                            <TableCell>
                                              <Button size="small" onClick={() => openJenkinsLogs(cfg.id, decodedId, b.number)}>Logs</Button>
                                            </TableCell>
                                            <TableCell>{b.url && <MuiLink href={fixUrlForBase(b.url, activeBaseByJenkins[cfg.id])} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </CardContent>
                                </Card>
                              </>
                            )}
                          </Stack>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
          )}

          {/* GitHub Actions */}
          {!paramId && (
          <Accordion expanded={expandedProvider === 'github'} onChange={(_e: React.SyntheticEvent, exp: boolean) => setExpandedProvider(exp ? 'github' : null)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
              <Typography variant="h6">GitHub Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {githubConfigs.length === 0 && <Typography color="text.secondary">No GitHub integrations configured</Typography>}
              <List disablePadding>
                {githubConfigs.map((cfg: { id: string; name?: string; owner?: string; repo?: string }) => (
                  <Box key={cfg.id} sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <ListItemButton onClick={async () => {
                      const next = new Set(expandedGithub);
                      if (next.has(cfg.id)) { next.delete(cfg.id); setExpandedGithub(next); return; }
                      next.add(cfg.id); setExpandedGithub(next);
                      let workflowsLocal: GitHubWorkflow[] | undefined = githubWorkflowsByProvider[cfg.id];
                      // Prefer backend-computed summary for reliability
                      try {
                        const { data: sum } = await api.get('/integrations/github/workflows/summary', { params: { providerId: cfg.id } });
                        const payload = (sum.data || sum);
                        const ws: Array<{ id: string | number; name: string; path?: string; html_url?: string; lastStatus?: string; lastAt?: string; successRate?: number; avgDurationSec?: number }>
                          = payload.workflows || [];
                        if (ws && ws.length) {
                          workflowsLocal = ws.map(w => ({ id: w.id, name: w.name, path: w.path, html_url: w.html_url }));
                          setGithubWorkflowsByProvider((prev: Record<string, GitHubWorkflow[]>) => ({ ...prev, [cfg.id]: workflowsLocal! }));
                          const statsMap: Record<string, { lastStatus: string; lastAt?: string; successRate: number; avgDurationSec: number }> = {};
                          ws.forEach(w => { statsMap[String(w.id)] = { lastStatus: (w.lastStatus || '—'), lastAt: w.lastAt, successRate: w.successRate ?? 0, avgDurationSec: w.avgDurationSec ?? 0 }; });
                          setGithubWorkflowStatsByProvider((prev: Record<string, Record<string, { lastStatus: string; lastAt?: string; successRate: number; avgDurationSec: number }>>) => ({ ...prev, [cfg.id]: statsMap }));
                        }
                      } catch (_) { /* ignore; fall back to client-side */ }
                      if (!workflowsLocal) {
                        try {
                          const { data } = await api.get('/integrations/github/workflows', { params: { providerId: cfg.id } });
                          const wfs: GitHubWorkflow[] = ((data.data || data).workflows) || (data.data || data);
                          workflowsLocal = wfs || [];
                          setGithubWorkflowsByProvider((prev: Record<string, GitHubWorkflow[]>) => ({ ...prev, [cfg.id]: workflowsLocal! }));
                        } catch {
                          workflowsLocal = [];
                          setGithubWorkflowsByProvider((prev: Record<string, GitHubWorkflow[]>) => ({ ...prev, [cfg.id]: [] }));
                        }
                      }
                      // if details route, prefetch runs for this integration/workflow using composite key
                      if (paramId && (githubWorkflowsByProvider[cfg.id] || []).some((w: GitHubWorkflow) => String(w.id) === String(decodedId) || w.path === decodedId)) {
                        const gKey = `${cfg.id}:${decodedId}`;
                        if (!githubRunsByKey[gKey]) {
                          setGithubLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [gKey]: true }));
                          try {
                            const { data: runsData } = await api.get('/integrations/github/runs', { params: { providerId: cfg.id, workflow_id: decodedId, limit: 50 } });
                            const rs: GitHubRun[] = (runsData.data || runsData) as GitHubRun[];
                            setGithubRunsByKey((prev: Record<string, GitHubRun[]>) => ({ ...prev, [gKey]: rs || [] }));
                            setGithubErrorByKey((prev) => ({ ...prev, [cfg.id]: null }));
                          } catch (err: any) {
                            console.error('GitHub runs fetch failed', cfg.id, decodedId, err?.response?.status, err?.response?.data || err?.message);
                            setGithubRunsByKey((prev: Record<string, GitHubRun[]>) => ({ ...prev, [gKey]: [] }));
                            const msg = err?.response?.data?.error || err?.message || 'Failed to fetch runs';
                            setGithubErrorByKey((prev) => ({ ...prev, [cfg.id]: msg }));
                          }
                          finally { setGithubLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [gKey]: false })); }
                        }
                      }
                      // Compute lightweight stats only if summary did not populate
                      if (!githubWorkflowStatsByProvider[cfg.id] || Object.keys(githubWorkflowStatsByProvider[cfg.id]).length === 0) {
                        const statsMap: Record<string, { lastStatus: string; lastAt?: string; successRate: number; avgDurationSec: number }> = {};
                        const workflows = workflowsLocal || [];
                        let firstError: string | null = null;
                        for (const w of workflows) {
                          try {
                            const { data } = await api.get('/integrations/github/runs', { params: { providerId: cfg.id, workflow_id: w.id, limit: 10 } });
                            let runs: GitHubRun[] = (data.data || data) as GitHubRun[];
                            // Fallback: some setups require filtering by name across repo-wide runs
                            if (!runs || runs.length === 0) {
                              // Try path-based identifier supported by GitHub API
                              if (w.path) {
                                try {
                                  const { data: byPath } = await api.get('/integrations/github/runs', { params: { providerId: cfg.id, workflow_id: w.path, limit: 10 } });
                                  runs = (byPath.data || byPath) as GitHubRun[];
                                } catch {
                                  // ignore and continue to fallback
                                }
                              }
                            }
                            if (!runs || runs.length === 0) {
                              const { data: allData } = await api.get('/integrations/github/runs', { params: { providerId: cfg.id, limit: 50 } });
                              const allRuns: GitHubRun[] = (allData.data || allData) as GitHubRun[];
                              const wname = (w.name || '').toLowerCase();
                              runs = (allRuns || []).filter(r => {
                                const n = (r.name || '').toLowerCase();
                                const t = (r.display_title || '').toLowerCase();
                                return n === wname || n.includes(wname) || t.includes(wname);
                              });
                            }
                            if (!runs || runs.length === 0) { statsMap[String(w.id)] = { lastStatus: '—', successRate: 0, avgDurationSec: 0 }; continue; }
                            const last = runs[0];
                            const completed = runs.filter(r => r.status === 'completed');
                            const successes = completed.filter(r => (r.conclusion || '').toLowerCase() === 'success').length;
                            const durations = completed.map(r => {
                              const s = r.run_started_at ? new Date(r.run_started_at).getTime() : 0;
                              const e = r.updated_at ? new Date(r.updated_at).getTime() : 0;
                              return s && e && e > s ? Math.round((e - s)/1000) : 0;
                            }).filter(n => n>0);
                            const avg = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length) : 0;
                            statsMap[String(w.id)] = { lastStatus: (last.status === 'completed' ? (last.conclusion || 'UNKNOWN') : (last.status || 'PENDING')).toUpperCase(), lastAt: last.run_started_at || undefined, successRate: completed.length ? Math.round((successes/completed.length)*100) : 0, avgDurationSec: avg };
                          } catch (err: any) {
                            if (!firstError) firstError = err?.response?.data?.error || err?.message || 'Failed to fetch workflow runs';
                            // Set default zeros so UI shows 0% and 0s instead of dashes
                            statsMap[String(w.id)] = { lastStatus: '—', successRate: 0, avgDurationSec: 0 };
                          }
                        }
                        setGithubWorkflowStatsByProvider((prev: Record<string, Record<string, { lastStatus: string; lastAt?: string; successRate: number; avgDurationSec: number }>>) => ({ ...prev, [cfg.id]: statsMap }));
                        setGithubErrorByKey((prev) => ({ ...prev, [cfg.id]: firstError }));
                      }
                      if (paramId && (githubWorkflowsByProvider[cfg.id] || []).some((w: GitHubWorkflow) => String(w.id) === String(paramId) || w.path === paramId)) {
                        const gKey2 = `${cfg.id}:${paramId}`;
                        if (!githubRunsByKey[gKey2]) {
                          setGithubLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [gKey2]: true }));
                          try {
                            const { data } = await api.get('/integrations/github/runs', { params: { providerId: cfg.id, workflow_id: paramId, limit: 50 } });
                            const rs: GitHubRun[] = (data.data || data) as GitHubRun[];
                            setGithubRunsByKey((prev: Record<string, GitHubRun[]>) => ({ ...prev, [gKey2]: rs || [] }));
                          } catch { setGithubRunsByKey((prev: Record<string, GitHubRun[]>) => ({ ...prev, [gKey2]: [] })); }
                          finally { setGithubLoadingByKey((prev: Record<string, boolean>) => ({ ...prev, [gKey2]: false })); }
                        }
                      }
                    }}>
                      <ListItemText primary={cfg.name || (cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : 'GitHub Actions')} />
                      <ExpandMoreIcon sx={{ transform: expandedGithub.has(cfg.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </ListItemButton>
                    {expandedGithub.has(cfg.id) && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        {!paramId && (
                          <>
                            <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Workflows</Typography>
                            {githubErrorByKey[cfg.id] && (
                              <Typography color="error" sx={{ mb: 1 }}>Error: {githubErrorByKey[cfg.id]}</Typography>
                            )}
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Workflow</TableCell>
                                  <TableCell>Last</TableCell>
                                  <TableCell>Success</TableCell>
                                  <TableCell>Avg Duration</TableCell>
                                  <TableCell>Open</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(!githubWorkflowsByProvider[cfg.id] || githubWorkflowsByProvider[cfg.id].length === 0) && (
                                  <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No workflows</Typography></TableCell></TableRow>
                                )}
                                {(githubWorkflowsByProvider[cfg.id] || []).map((w: GitHubWorkflow) => (
                                  <TableRow key={String(w.id)} hover>
                                    <TableCell>
                                      <MuiLink component={RouterLink} to={`/pipelines/${encodeURIComponent(String(w.id))}`}>{w.name}</MuiLink>
                                    </TableCell>
                                    <TableCell>
                                      {ghStatusChip(githubWorkflowStatsByProvider[cfg.id]?.[String(w.id)]?.lastStatus)}
                                    </TableCell>
                                    <TableCell>
                                      {successRateChip(githubWorkflowStatsByProvider[cfg.id]?.[String(w.id)]?.successRate)}
                                    </TableCell>
                                    <TableCell>
                                      {githubWorkflowStatsByProvider[cfg.id]?.[String(w.id)]?.avgDurationSec !== undefined
                                        ? `${githubWorkflowStatsByProvider[cfg.id][String(w.id)].avgDurationSec}s`
                                        : '—'}
                                    </TableCell>
                                    <TableCell>{w.html_url && <MuiLink href={w.html_url} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </>
                        )}
                        {paramId && (githubWorkflowsByProvider[cfg.id] || []).some(w => String(w.id) === String(decodedId) || w.path === decodedId) && (
                          <Card>
                            <CardContent>
                              <Typography variant="h6" gutterBottom>Workflow Runs</Typography>
                              <Divider sx={{ mb: 2 }} />
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Run</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>When</TableCell>
                                    <TableCell>Logs</TableCell>
                                    <TableCell>Open</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {githubLoadingByKey[`${cfg.id}:${decodedId}`] && (
                                    <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Loading...</Typography></TableCell></TableRow>
                                  )}
                                  {!githubLoadingByKey[`${cfg.id}:${decodedId}`] && (!githubRunsByKey[`${cfg.id}:${decodedId}`] || githubRunsByKey[`${cfg.id}:${decodedId}`].length === 0) && (
                                    <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No runs</Typography></TableCell></TableRow>
                                  )}
                                  {(githubRunsByKey[`${cfg.id}:${decodedId}`] || []).map((r: GitHubRun) => (
                                    <TableRow key={String(r.id)} hover>
                                      <TableCell>#{r.run_number} {r.display_title ? `— ${r.display_title}` : ''}</TableCell>
                                      <TableCell>{ghStatusChip(r.status === 'completed' ? (r.conclusion || 'UNKNOWN') : (r.status || 'PENDING'))}</TableCell>
                                      <TableCell>{r.run_started_at ? new Date(r.run_started_at).toLocaleString() : '—'}</TableCell>
                                      <TableCell>
                                        <Button size="small" onClick={() => openGithubLogs(cfg.id, r.id, r.name || r.display_title || '')}>Logs</Button>
                                      </TableCell>
                                      <TableCell>{r.html_url && <MuiLink href={r.html_url} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
          )}
          <Box sx={{ mt: 2 }}>
            <MuiLink component={RouterLink} to="/dashboard">← Back to Dashboard</MuiLink>
          </Box>

          {/* Logs Dialog */}
          <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} fullWidth maxWidth="md">
            <DialogTitle>{logsTitle}</DialogTitle>
            <DialogContent dividers>
              {logsLoading ? (
                <Typography color="text.secondary">Loading logs...</Typography>
              ) : (
                <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 500, overflow: 'auto' }}>
                  {logsContent || 'No logs available'}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setLogsOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </Stack>
      )}
    </Box>
  );
};

export default Pipelines;