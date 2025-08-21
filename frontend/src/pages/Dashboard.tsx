import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack, Table, TableHead, TableRow, TableCell, TableBody, Divider, Link as MuiLink, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Skeleton, Grow, Button, Checkbox, FormControlLabel } from '@mui/material';
import { LineChart, BarChart } from '@mui/x-charts';
import ArticleIcon from '@mui/icons-material/Article';
import { Link as RouterLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';
import { getDashboardSettings } from '../services/settings';
import { getJenkinsBuildLog } from '../services/jenkins';
import { getGithubRunLogs } from '../services/github';

type JenkinsJob = {
  name: string;
  url: string;
  color?: string;
};

type JenkinsBuild = {
  id: string;
  number: number;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
  url: string;
  fullDisplayName?: string;
};

type GitHubWorkflow = { id: number | string; name: string; html_url?: string };
type GitHubRun = { id: number | string; run_number: number; display_title?: string | null; status?: string | null; conclusion?: string | null; run_started_at?: string | null; html_url: string };

const Dashboard: React.FC = () => {
  type JenkinsIntegrationState = Record<string, {
    name: string;
    jobs: JenkinsJob[];
    lastBuilds: { job: string; lastBuild: JenkinsBuild | null }[];
    metrics: { totals: { totalBuilds: number; successRate: number; avgDurationMs: number; medianDurationMs: number; p95DurationMs: number }; perJob?: { job: string; builds: number; successRate: number; avgDurationMs: number }[] } | null;
    trends: { days: number; points: { date: string; totalBuilds: number; successRate: number; avgDurationMs: number }[] } | null;
    deploySummary: { windowDays: number; deployments: number; successRate: number; perJob: { job: string; deployments: number; successRate: number }[] } | null;
    error: string | null;
  }>;
  type GitHubIntegrationState = Record<string, {
    name: string;
    workflows: GitHubWorkflow[];
    runs: GitHubRun[];
    trends: { days: number; points: { date: string; totalRuns: number; successRate: number; avgDurationSec: number }[] } | null;
    deploySummary: { windowDays: number; deployments: number; successRate: number; perJob: { job: string; deployments: number; successRate: number }[] } | null;
    error: string | null;
  }>;
  const [loading, setLoading] = useState<boolean>(true);
  // Active configs
  const [jenkinsConfigs, setJenkinsConfigs] = useState<any[]>([]);
  const [githubConfigs, setGithubConfigs] = useState<any[]>([]);
  // Per-integration state maps by id
  const [jenkinsState, setJenkinsState] = useState<JenkinsIntegrationState>({});
  const [githubState, setGithubState] = useState<GitHubIntegrationState>({});
  // Dashboard visibility selection (session-only on Dashboard)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultKeys, setDefaultKeys] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [tempSelection, setTempSelection] = useState<Set<string>>(new Set());
  // Graphs state
  const [graphsOpen, setGraphsOpen] = useState<boolean>(true);
  const [selectedGraphs, setSelectedGraphs] = useState<Set<'successRate' | 'avgDuration' | 'deployments'>>(new Set(['successRate','avgDuration','deployments']));
  const [graphIntegrations, setGraphIntegrations] = useState<Set<string>>(new Set());
  const [graphDays, setGraphDays] = useState<number>(14);
  // Logs modal state
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState<string>('');
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        // fetch all configs then filter active, and load per-integration
        const [jenkinsCfgRes, githubCfgRes] = await Promise.all([
          api.get('/integrations/jenkins-configs'),
          api.get('/integrations/github-configs'),
        ]);
        const jCfgs = (jenkinsCfgRes.data.data || []).filter((c: any) => c.active);
        const gCfgs = (githubCfgRes.data.data || []).filter((c: any) => c.active);
        if (!isMounted) return;
        setJenkinsConfigs(jCfgs);
        setGithubConfigs(gCfgs);

        // Load global dashboard settings (defaults). Do NOT persist changes from Dashboard.
        try {
          const s = await getDashboardSettings();
          const keys = Array.isArray(s?.selectedIntegrations) ? s.selectedIntegrations : [];
          if (keys.length) {
            setSelected(new Set(keys));
            setDefaultKeys(keys);
          } else {
            // default: all (local only)
            const allKeys = [
              ...jCfgs.map((c: any) => `jenkins:${c.id}`),
              ...gCfgs.map((c: any) => `github:${c.id}`),
            ];
            setSelected(new Set(allKeys));
            setDefaultKeys(allKeys);
          }
        } catch {}

        const perTasks: Promise<void>[] = [];
        for (const jc of jCfgs) {
          perTasks.push(
            Promise.all([
              api.get('/integrations/jenkins/overview', { params: { providerId: jc.id } }),
              api.get('/integrations/jenkins/metrics/summary', { params: { window: 30, perJob: true, providerId: jc.id } }),
              api.get('/integrations/jenkins/metrics/trends', { params: { days: graphDays, providerId: jc.id } }),
              api.get('/integrations/jenkins/deployments/summary', { params: { windowDays: graphDays, providerId: jc.id } }),
            ])
              .then(([ovRes, mRes, tRes, dRes]) => {
                if (!isMounted) return;
                const data = ovRes.data.data || ovRes.data;
                setJenkinsState((prev: JenkinsIntegrationState) => ({
                  ...prev,
                  [jc.id]: {
                    name: jc.name || jc.baseUrl || 'Jenkins',
                    jobs: data.jobs || [],
                    lastBuilds: data.lastBuilds || [],
                    metrics: mRes.data.data || mRes.data,
                    trends: tRes.data.data || tRes.data,
                    deploySummary: dRes.data.data || dRes.data,
                    error: null,
                  }
                }));
              })
              .catch((e) => {
                if (!isMounted) return;
                setJenkinsState((prev: JenkinsIntegrationState) => ({
                  ...prev,
                  [jc.id]: {
                    name: jc.name || jc.baseUrl || 'Jenkins',
                    jobs: [], lastBuilds: [], metrics: null, trends: null, deploySummary: null,
                    error: e?.response?.data?.error || e.message || 'Failed to load Jenkins data',
                  }
                }));
              })
          );
        }

        for (const gc of gCfgs) {
          perTasks.push(
            Promise.all([
              api.get('/integrations/github/workflows', { params: { providerId: gc.id } }),
              api.get('/integrations/github/runs', { params: { limit: 20, providerId: gc.id } }),
              api.get('/integrations/github/deployments/summary', { params: { windowDays: graphDays, providerId: gc.id } }),
              api.get('/integrations/github/workflows/trends', { params: { days: graphDays, providerId: gc.id } }),
            ])
              .then(([wfRes, runsRes, depRes, trendsRes]) => {
                if (!isMounted) return;
                const wfs: GitHubWorkflow[] = (wfRes.data.data || wfRes.data).workflows || (wfRes.data.data || wfRes.data);
                const rs: GitHubRun[] = (runsRes.data.data || runsRes.data) as GitHubRun[];
                setGithubState((prev: GitHubIntegrationState) => ({
                  ...prev,
                  [gc.id]: {
                    name: gc.name || (gc.owner && gc.repo ? `${gc.owner}/${gc.repo}` : 'GitHub Actions'),
                    workflows: wfs || [],
                    runs: rs || [],
                    trends: trendsRes?.data?.data || trendsRes?.data || null,
                    deploySummary: depRes.data.data || depRes.data,
                    error: null,
                  }
                }));
              })
              .catch((e) => {
                if (!isMounted) return;
                setGithubState((prev: GitHubIntegrationState) => ({
                  ...prev,
                  [gc.id]: {
                    name: gc.name || (gc.owner && gc.repo ? `${gc.owner}/${gc.repo}` : 'GitHub Actions'),
                    workflows: [], runs: [], trends: null, deploySummary: null,
                    error: e?.response?.data?.error || e.message || 'Failed to load GitHub data',
                  }
                }));
              })
          );
        }
        await Promise.allSettled(perTasks);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [graphDays]);

  const openLogs = async (providerId: string, job: string, buildNumber: number) => {
    setLogOpen(true);
    setLogText('');
    setLogLoading(true);
    try {
      const text = await getJenkinsBuildLog(job, buildNumber, providerId);
      setLogText(text || '');
    } catch (e: any) {
      setLogText(e?.response?.data?.error || e?.message || 'Failed to fetch logs');
    } finally {
      setLogLoading(false);
    }
  };

  const openGithubLogs = async (providerId: string, runId: string | number) => {
    setLogOpen(true);
    setLogText('');
    setLogLoading(true);
    try {
      const text = await getGithubRunLogs(runId, providerId);
      setLogText(text || '');
    } catch (e: any) {
      setLogText(e?.response?.data?.error || e?.message || 'Failed to fetch logs');
    } finally {
      setLogLoading(false);
    }
  };

  // selection handled via ToggleButtonGroup onChange

  const selectAll = () => {
    const allKeys = [
      ...jenkinsConfigs.map((c: any) => `jenkins:${c.id}`),
      ...githubConfigs.map((c: any) => `github:${c.id}`),
    ];
    setSelected(new Set(allKeys));
  };

  const selectNone = () => { setSelected(new Set()); };

  const jenkinsToShow = jenkinsConfigs.filter((c: any) => selected.has(`jenkins:${c.id}`));
  const githubToShow = githubConfigs.filter((c: any) => selected.has(`github:${c.id}`));

  // Initialize graph integrations to defaults once defaults are known
  useEffect(() => {
    if (defaultKeys.length && graphIntegrations.size === 0) {
      setGraphIntegrations(new Set(defaultKeys));
    }
  }, [defaultKeys]);

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


  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      {loading && <Typography>Loading data...</Typography>}

      {!loading && (
        <Stack spacing={3}>
          {/* Graphs Section */}
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Graphs</Typography>
                <Button size="small" onClick={() => setGraphsOpen((o: boolean) => !o)}>{graphsOpen ? 'Hide' : 'Show'}</Button>
              </Stack>
              {graphsOpen && (
                <Stack spacing={2}>
                  {/* Controls */}
                  <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                    <Stack>
                      <Typography variant="subtitle2">Graph types</Typography>
                      <FormControlLabel control={<Checkbox checked={selectedGraphs.has('successRate')} onChange={(_: React.ChangeEvent<HTMLInputElement>, c: boolean) => {
                        setSelectedGraphs(prev => { const n = new Set(prev); c ? n.add('successRate') : n.delete('successRate'); return n; });
                      }} />} label="Success rate (Jenkins trends)" />
                      <FormControlLabel control={<Checkbox checked={selectedGraphs.has('avgDuration')} onChange={(_: React.ChangeEvent<HTMLInputElement>, c: boolean) => {
                        setSelectedGraphs(prev => { const n = new Set(prev); c ? n.add('avgDuration') : n.delete('avgDuration'); return n; });
                      }} />} label="Avg duration (Jenkins trends)" />
                      <FormControlLabel control={<Checkbox checked={selectedGraphs.has('deployments')} onChange={(_: React.ChangeEvent<HTMLInputElement>, c: boolean) => {
                        setSelectedGraphs(prev => { const n = new Set(prev); c ? n.add('deployments') : n.delete('deployments'); return n; });
                      }} />} label="Deployments (last 7 days)" />
                    </Stack>
                    <Stack>
                      <Typography variant="subtitle2">Time range</Typography>
                      <Stack direction="row" spacing={1}>
                        {[7,14,30,90].map(d => (
                          <Button key={d} size="small" variant={graphDays===d? 'contained':'outlined'} onClick={()=>setGraphDays(d)}>{d}d</Button>
                        ))}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">Applies to trends and deployments</Typography>
                    </Stack>
                    <Stack>
                      <Typography variant="subtitle2">Integrations to plot</Typography>
                      {[...jenkinsConfigs.map((cfg: any) => ({ key: `jenkins:${cfg.id}`, label: jenkinsState[cfg.id]?.name || cfg.name || cfg.baseUrl || 'Jenkins' })),
                        ...githubConfigs.map((cfg: any) => ({ key: `github:${cfg.id}`, label: githubState[cfg.id]?.name || cfg.name || (cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : 'GitHub') }))]
                        .map(item => (
                          <FormControlLabel key={item.key}
                            control={<Checkbox checked={graphIntegrations.has(item.key)} onChange={(_: React.ChangeEvent<HTMLInputElement>, c: boolean) => {
                              setGraphIntegrations((prev: Set<string>) => { const n = new Set(prev); c ? n.add(item.key) : n.delete(item.key); return n; });
                            }} />}
                            label={item.label} />
                        ))}
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => setGraphIntegrations(new Set(defaultKeys))}>Defaults</Button>
                        <Button size="small" onClick={() => setGraphIntegrations(new Set([...jenkinsConfigs.map((c:any)=>`jenkins:${c.id}`), ...githubConfigs.map((c:any)=>`github:${c.id}`)]))}>All</Button>
                        <Button size="small" onClick={() => setGraphIntegrations(new Set())}>None</Button>
                      </Stack>
                    </Stack>
                  </Stack>

                  {/* Empty state if no graphs selected */}
                  {selectedGraphs.size === 0 && (
                    <Typography color="text.secondary">No graph types selected. Choose at least one graph above.</Typography>
                  )}

                  {/* Success rate trend (Jenkins + GitHub) */}
                  {selectedGraphs.has('successRate') && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Success rate over time</Typography>
                      {(() => {
                        const jKeys = jenkinsConfigs.filter((c:any)=>graphIntegrations.has(`jenkins:${c.id}`)).map((c:any)=>c.id);
                        const gKeys = githubConfigs.filter((c:any)=>graphIntegrations.has(`github:${c.id}`)).map((c:any)=>c.id);
                        const firstJ = jKeys.find((id:string)=> (jenkinsState[id]?.trends?.points || []).length > 0);
                        const firstG = gKeys.find((id:string)=> (githubState[id]?.trends?.points || []).length > 0);
                        const xData: string[] = firstJ
                          ? (jenkinsState[firstJ]?.trends?.points || []).map((p:any)=>p.date)
                          : (firstG ? (githubState[firstG]?.trends?.points || []).map((p:any)=>p.date) : []);
                        const series = [
                          ...jKeys.map((id:string) => ({
                            id: `jenkins:sr:${id}`,
                            label: jenkinsState[id]?.name || (jenkinsConfigs.find((c:any)=>c.id===id)?.name) || 'Jenkins',
                            data: (jenkinsState[id]?.trends?.points || []).map((p:any)=> p.successRate || 0),
                          })),
                          ...gKeys.map((id:string) => ({
                            id: `github:sr:${id}`,
                            label: githubState[id]?.name || (githubConfigs.find((c:any)=>c.id===id)?.name) || 'GitHub',
                            data: (githubState[id]?.trends?.points || []).map((p:any)=> p.successRate || 0),
                          })),
                        ].filter(s => s.data.length > 0);
                        if (!series.length || !xData.length) {
                          return <Typography color="text.secondary">No data to display. Select at least one integration with trend data.</Typography>;
                        }
                        return (
                          <LineChart height={300}
                            xAxis={[{ scaleType: 'point', data: xData }]}
                            series={series}
                            slotProps={{ legend: { hidden: false } }}
                          />
                        );
                      })()}
                    </Box>
                  )}

                  {/* Avg duration trend (Jenkins + GitHub) */}
                  {selectedGraphs.has('avgDuration') && (
                    <Box>
                      {(() => {
                        const jKeys = jenkinsConfigs.filter((c:any)=>graphIntegrations.has(`jenkins:${c.id}`)).map((c:any)=>c.id);
                        const gKeys = githubConfigs.filter((c:any)=>graphIntegrations.has(`github:${c.id}`)).map((c:any)=>c.id);
                        const firstJ = jKeys.find((id:string)=> (jenkinsState[id]?.trends?.points || []).length > 0);
                        const firstG = gKeys.find((id:string)=> (githubState[id]?.trends?.points || []).length > 0);
                        const xData: string[] = firstJ
                          ? (jenkinsState[firstJ]?.trends?.points || []).map((p:any)=>p.date)
                          : (firstG ? (githubState[firstG]?.trends?.points || []).map((p:any)=>p.date) : []);

                        // collect all durations in seconds to decide unit
                        const jDurSeriesSec = jKeys.map((id:string) => (jenkinsState[id]?.trends?.points || []).map((p:any)=> (p.avgDurationMs || 0)/1000));
                        const gDurSeriesSec = gKeys.map((id:string) => (githubState[id]?.trends?.points || []).map((p:any)=> (p.avgDurationSec || 0)));
                        const allSec = [...jDurSeriesSec, ...gDurSeriesSec].flat();
                        const maxSec = allSec.length ? Math.max(...allSec) : 0;
                        const useMinutes = maxSec >= 60;

                        const titleUnit = useMinutes ? 'min' : 'sec';
                        const series = [
                          ...jKeys.map((id:string) => ({
                            id: `jenkins:avg:${id}`,
                            label: jenkinsState[id]?.name || (jenkinsConfigs.find((c:any)=>c.id===id)?.name) || 'Jenkins',
                            data: (jenkinsState[id]?.trends?.points || []).map((p:any)=> {
                              const sec = (p.avgDurationMs || 0)/1000;
                              return useMinutes ? Math.round(sec/60) : Math.round(sec);
                            }),
                          })),
                          ...gKeys.map((id:string) => ({
                            id: `github:avg:${id}`,
                            label: githubState[id]?.name || (githubConfigs.find((c:any)=>c.id===id)?.name) || 'GitHub',
                            data: (githubState[id]?.trends?.points || []).map((p:any)=> {
                              const sec = (p.avgDurationSec || 0);
                              return useMinutes ? Math.round(sec/60) : Math.round(sec);
                            }),
                          })),
                        ].filter(s => s.data.length > 0);
                        if (!series.length || !xData.length) {
                          return (
                            <>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>Average run/build duration over time</Typography>
                              <Typography color="text.secondary">No data to display. Select at least one integration with trend data.</Typography>
                            </>
                          );
                        }
                        return (
                          <>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Average run/build duration over time ({titleUnit})</Typography>
                            <LineChart height={300}
                              xAxis={[{ scaleType: 'point', data: xData }]}
                              series={series}
                              yAxis={[{ label: useMinutes ? 'Minutes' : 'Seconds' }]}
                              slotProps={{ legend: { hidden: false } }}
                            />
                          </>
                        );
                      })()}
                    </Box>
                  )}

                  {/* Deployments bar: both providers total over last 7 days */}
                  {selectedGraphs.has('deployments') && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Deployments (last 7 days)</Typography>
                      {(() => {
                        const labels = [
                          ...jenkinsConfigs.filter((c:any)=>graphIntegrations.has(`jenkins:${c.id}`)).map((c:any)=> (jenkinsState[c.id]?.name || c.name || 'Jenkins')),
                          ...githubConfigs.filter((c:any)=>graphIntegrations.has(`github:${c.id}`)).map((c:any)=> (githubState[c.id]?.name || c.name || 'GitHub'))
                        ];
                        const values = [
                          ...jenkinsConfigs.filter((c:any)=>graphIntegrations.has(`jenkins:${c.id}`)).map((c:any)=> (jenkinsState[c.id]?.deploySummary?.deployments ?? 0)),
                          ...githubConfigs.filter((c:any)=>graphIntegrations.has(`github:${c.id}`)).map((c:any)=> (githubState[c.id]?.deploySummary?.deployments ?? 0))
                        ];
                        if (!labels.length) {
                          return <Typography color="text.secondary">No data to display. Select at least one integration.</Typography>;
                        }
                        return (
                          <BarChart height={300}
                            xAxis={[{ scaleType: 'band', data: labels }]}
                            series={[{ data: values, label: 'Deployments' }]}
                            slotProps={{ legend: { hidden: false } }}
                          />
                        );
                      })()}
                    </Box>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
          {/* Visibility selector (session-only) */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Visible integrations</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={selectAll}>All</Button>
                <Button size="small" variant="outlined" onClick={selectNone}>None</Button>
                <Button size="small" variant="contained" onClick={() => setSelected(new Set(defaultKeys))}>Reset to default</Button>
                <Button size="small" variant="outlined" onClick={() => { setTempSelection(new Set(selected)); setPickerOpen(true); }}>Choose integrations</Button>
              </Stack>
            </Stack>
            {/* Show ONLY currently selected integrations as chips */}
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {[...selected].map((key) => {
                const [type, id] = key.split(':');
                const isJ = type === 'jenkins';
                const cfg = (isJ ? jenkinsConfigs : githubConfigs).find((c: any) => c.id === id);
                const name = isJ
                  ? (jenkinsState[id]?.name || cfg?.name || cfg?.baseUrl || 'Jenkins')
                  : (githubState[id]?.name || cfg?.name || (cfg?.owner && cfg?.repo ? `${cfg.owner}/${cfg.repo}` : 'GitHub'));
                return (
                  <Chip key={key} label={`${isJ ? 'Jenkins' : 'GitHub'} — ${name}`} />
                );
              })}
              {selected.size === 0 && (
                <Typography color="text.secondary">No integrations selected</Typography>
              )}
            </Stack>

            {/* Picker dialog to choose from active integrations */}
            <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
              <DialogTitle>Select integrations to display</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">Jenkins</Typography>
                  <Stack>
                    {jenkinsConfigs.map((cfg: any) => {
                      const key = `jenkins:${cfg.id}`;
                      const checked = tempSelection.has(key);
                      const label = jenkinsState[cfg.id]?.name || cfg.name || cfg.baseUrl || 'Jenkins';
                      return (
                        <FormControlLabel key={key}
                          control={<Checkbox checked={checked} onChange={(_, c) => {
                            setTempSelection(prev => { const next = new Set(prev); if (c) next.add(key); else next.delete(key); return next; });
                          }} />}
                          label={`Jenkins — ${label}`}
                        />
                      );
                    })}
                  </Stack>
                  <Divider />
                  <Typography variant="subtitle2">GitHub</Typography>
                  <Stack>
                    {githubConfigs.map((cfg: any) => {
                      const key = `github:${cfg.id}`;
                      const checked = tempSelection.has(key);
                      const label = githubState[cfg.id]?.name || cfg.name || (cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : 'Repository');
                      return (
                        <FormControlLabel key={key}
                          control={<Checkbox checked={checked} onChange={(_, c) => {
                            setTempSelection(prev => { const next = new Set(prev); if (c) next.add(key); else next.delete(key); return next; });
                          }} />}
                          label={`GitHub — ${label}`}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setPickerOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={() => { setSelected(new Set(tempSelection)); setPickerOpen(false); }}>Apply</Button>
              </DialogActions>
            </Dialog>
          </Box>

          {/* Jenkins cards per integration */}
          {jenkinsToShow.map((cfg: any, idx: number) => {
            const st = jenkinsState[cfg.id];
            return (
              <Grow in timeout={300 + idx*50} key={cfg.id}>
                <Card>
                  <CardContent>
                  <Typography variant="h6" gutterBottom>Jenkins — {st?.name || cfg.name || cfg.baseUrl}</Typography>
                  {st?.error && <Typography color="error" sx={{ mb: 1 }}>{st.error}</Typography>}
                  {/* Jobs */}
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                    {!st?.jobs?.length && (loading ? <Skeleton width={180} /> : <Typography color="text.secondary">No jobs found</Typography>)}
                    {(st?.jobs || []).map((j: JenkinsJob) => (
                      <Chip key={j.name} label={j.name} variant="outlined" component={RouterLink} to={`/pipelines/${encodeURIComponent(j.name)}`} clickable />
                    ))}
                  </Stack>
                  {/* Latest builds */}
                  <Typography variant="subtitle1" gutterBottom>Latest Builds</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Job</TableCell>
                        <TableCell>Build</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>When</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {!st?.lastBuilds?.length && (
                        <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No recent builds</Typography></TableCell></TableRow>
                      )}
                      {(st?.lastBuilds || []).map((b: { job: string; lastBuild: JenkinsBuild | null }) => (
                        <TableRow key={b.job} hover>
                          <TableCell>{b.job}</TableCell>
                          <TableCell>
                            {b.lastBuild ? (
                              <a href={b.lastBuild.url} target="_blank" rel="noreferrer">#{b.lastBuild.number}</a>
                            ) : '—'}
                          </TableCell>
                          <TableCell>{b.lastBuild ? statusChip(b.lastBuild.result, b.lastBuild.building) : '—'}</TableCell>
                          <TableCell>{b.lastBuild ? `${Math.round(b.lastBuild.duration / 1000)}s` : '—'}</TableCell>
                          <TableCell>
                            {b.lastBuild ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <span>{new Date(b.lastBuild.timestamp).toLocaleString()}</span>
                                <IconButton size="small" aria-label="logs" onClick={() => openLogs(cfg.id, b.job, b.lastBuild!.number)}>
                                  <ArticleIcon fontSize="inherit" />
                                </IconButton>
                              </Stack>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Divider sx={{ my: 2 }} />

                  {/* Metrics */}
                  <Typography variant="subtitle1" gutterBottom>Metrics (Last 30 Builds)</Typography>
                  <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                    <Chip label={`Total: ${st?.metrics?.totals?.totalBuilds ?? 0}`} />
                    <Chip label={`Success: ${st?.metrics?.totals?.successRate ?? 0}%`} color="success" />
                    <Chip label={`Avg: ${Math.round(st?.metrics?.totals?.avgDurationMs ?? 0)} ms`} />
                    <Chip label={`P95: ${Math.round(st?.metrics?.totals?.p95DurationMs ?? 0)} ms`} />
                  </Stack>

                  {/* Deployments */}
                  <Typography variant="subtitle1" gutterBottom>Deployment Tracking (last 7 days)</Typography>
                  {!st?.deploySummary && <Typography color="text.secondary">No deployment activity</Typography>}
                  {st?.deploySummary && (
                    <>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                        <Chip label={`Deployments: ${st.deploySummary.deployments}`} />
                        <Chip label={`Success rate: ${st.deploySummary.successRate}%`} color="success" />
                      </Stack>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Job</TableCell>
                            <TableCell align="right">Deployments</TableCell>
                            <TableCell align="right">Success Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {st.deploySummary.perJob.map((row: { job: string; deployments: number; successRate: number }) => (
                            <TableRow key={row.job} hover>
                              <TableCell>{row.job}</TableCell>
                              <TableCell align="right">{row.deployments}</TableCell>
                              <TableCell align="right">{row.successRate}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grow>
            );
          })}

          {/* GitHub cards per integration */}
          {githubToShow.map((cfg: any, idx: number) => {
            const st = githubState[cfg.id];
            return (
              <Grow in timeout={300 + idx*50} key={cfg.id}>
                <Card>
                  <CardContent>
                  <Typography variant="h6" gutterBottom>GitHub Actions — {st?.name || cfg.name || (cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : 'GitHub')}</Typography>
                  {st?.error && <Typography color="error" sx={{ mb: 1 }}>{st.error}</Typography>}
                  <Divider sx={{ mb: 2 }} />
                  {/* Summary chips computed from recent runs */}
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                    {(() => {
                      const runs = st?.runs || [];
                      const total = runs.length;
                      const completed = runs.filter((r: GitHubRun) => r.status === 'completed');
                      const successes = completed.filter((r: GitHubRun) => (r.conclusion || '').toLowerCase() === 'success');
                      const failed = completed.filter((r: GitHubRun) => (r.conclusion || '').toLowerCase() === 'failure');
                      const running = runs.filter((r: GitHubRun) => r.status !== 'completed');
                      const rate = completed.length ? Math.round((successes.length / completed.length) * 100) : 0;
                      return (
                        <>
                          <Chip label={`Total: ${total}`} size="small" />
                          <Chip color="success" label={`Success: ${successes.length}`} size="small" />
                          <Chip color="error" label={`Failed: ${failed.length}`} size="small" />
                          <Chip color="info" label={`Running/Pending: ${running.length}`} size="small" />
                          <Chip variant="outlined" label={`Success Rate: ${rate}%`} size="small" />
                        </>
                      );
                    })()}
                  </Stack>
                  {/* Workflows list */}
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {!st?.workflows?.length && <Typography color="text.secondary">No workflows</Typography>}
                    {(st?.workflows || []).map((w: GitHubWorkflow) => (
                      <Chip key={String(w.id)} label={w.name} component={RouterLink} to={`/pipelines/${encodeURIComponent(String(w.id))}`} clickable size="small" />
                    ))}
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle1" gutterBottom>Latest Runs</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Run</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>When</TableCell>
                        <TableCell>Open</TableCell>
                        <TableCell>Logs</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {!(st?.runs?.length) && (
                        <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No recent runs</Typography></TableCell></TableRow>
                      )}
                      {(st?.runs || []).map((r: GitHubRun) => (
                        <TableRow key={String(r.id)} hover>
                          <TableCell>#{r.run_number} {r.display_title ? `— ${r.display_title}` : ''}</TableCell>
                          <TableCell>{(r.status === 'completed' ? (r.conclusion || 'UNKNOWN') : (r.status || 'PENDING')).toUpperCase()}</TableCell>
                          <TableCell>{r.run_started_at ? new Date(r.run_started_at).toLocaleString() : '—'}</TableCell>
                          <TableCell>{r.html_url && <MuiLink href={r.html_url} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                          <TableCell>
                            <IconButton size="small" aria-label="logs" onClick={() => openGithubLogs(cfg.id, r.id)}>
                              <ArticleIcon fontSize="inherit" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle1" gutterBottom>Deployment Tracking (last 7 days)</Typography>
                  {!st?.deploySummary && <Typography color="text.secondary">No deployment activity</Typography>}
                  {st?.deploySummary && (
                    <>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                        <Chip label={`Deployments: ${st.deploySummary.deployments}`} />
                        <Chip label={`Success rate: ${st.deploySummary.successRate}%`} color="success" />
                      </Stack>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Workflow</TableCell>
                            <TableCell align="right">Deployments</TableCell>
                            <TableCell align="right">Success Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {st.deploySummary.perJob.map((row: { job: string; deployments: number; successRate: number }) => (
                            <TableRow key={row.job} hover>
                              <TableCell>{row.job}</TableCell>
                              <TableCell align="right">{row.deployments}</TableCell>
                              <TableCell align="right">{row.successRate}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                  </CardContent>
                </Card>
              </Grow>
            );
          })}

          {/* Logs dialog */}
          <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>Build Logs</DialogTitle>
            <DialogContent>
              {logLoading ? (
                <Skeleton variant="rectangular" height={240} />
              ) : (
                <Box component="pre" sx={{ maxHeight: 480, overflow: 'auto', bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
                  {logText || 'No logs'}
                </Box>
              )}
            </DialogContent>
          </Dialog>
        </Stack>
      )}
    </Box>
  );
};

export default Dashboard;