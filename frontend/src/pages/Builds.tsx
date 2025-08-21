import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip, Link as MuiLink, Accordion, AccordionSummary, AccordionDetails, List, ListItemButton, ListItemText, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import api from '../services/api';

type JenkinsBuild = {
  id?: string;
  number: number;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
  url?: string;
  fullDisplayName?: string;
};

type GitHubRun = {
  id: number | string;
  name?: string | null;
  display_title?: string | null;
  event?: string;
  status?: string | null; // queued, in_progress, completed
  conclusion?: string | null; // success, failure, cancelled, etc.
  run_number: number;
  run_started_at?: string | null;
  updated_at?: string | null;
  html_url: string;
  durationMs?: number | null;
};

const Builds: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // legacy states removed in favor of per-integration lazy loads

  // Provider/integration lists
  const [jenkinsConfigs, setJenkinsConfigs] = useState<Array<{ id: string; name?: string; baseUrl: string; active?: boolean }>>([]);
  const [githubConfigs, setGithubConfigs] = useState<Array<{ id: string; name?: string; owner?: string; repo?: string; active?: boolean }>>([]);

  // UI session state
  const [expandedProvider, setExpandedProvider] = useState<'jenkins' | 'github' | null>(null);
  const [expandedJenkins, setExpandedJenkins] = useState<Set<string>>(new Set());
  const [expandedGithub, setExpandedGithub] = useState<Set<string>>(new Set());
  const [activeBaseByJenkins, setActiveBaseByJenkins] = useState<Record<string, string>>({});

  // Data caches keyed per integration
  const [jenkinsJobsByProvider, setJenkinsJobsByProvider] = useState<Record<string, { name: string; url?: string }[]>>({});
  const [jenkinsBuildsByKey, setJenkinsBuildsByKey] = useState<Record<string, JenkinsBuild[]>>({}); // key=`${providerId}::${jobName}`
  const [githubWorkflowsByProvider, setGithubWorkflowsByProvider] = useState<Record<string, { id: string | number; name: string; html_url?: string }[]>>({});
  const [githubRunsByKey, setGithubRunsByKey] = useState<Record<string, GitHubRun[]>>({}); // key=`${providerId}::${workflowId}`

  function statusChip(result: string | null, building: boolean) {
    if (building) return <Chip label="RUNNING" color="info" size="small"/>;
    switch (result) {
      case 'SUCCESS': return <Chip label="SUCCESS" color="success" size="small"/>;
      case 'FAILURE': return <Chip label="FAILURE" color="error" size="small"/>;
      case 'ABORTED': return <Chip label="ABORTED" color="warning" size="small"/>;
      case 'UNSTABLE': return <Chip label="UNSTABLE" color="warning" size="small"/>;
      default: return <Chip label={result || 'UNKNOWN'} size="small"/>;
    }
  }

  // fix URL for a given Jenkins base

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // detect active provider
        const [jenkinsCfgRes, githubCfgRes] = await Promise.all([
          api.get('/integrations/jenkins-configs'),
          api.get('/integrations/github-configs'),
        ]);
        const jcs = (jenkinsCfgRes.data.data || []) as Array<{ id: string; name?: string; baseUrl: string; active?: boolean }>;
        const gcs = (githubCfgRes.data.data || []) as Array<{ id: string; name?: string; owner?: string; repo?: string; active?: boolean }>;
        // store full lists and default expand
        setJenkinsConfigs(jcs);
        setGithubConfigs(gcs);
        if (jcs.length > 0) setExpandedProvider('jenkins'); else if (gcs.length > 0) setExpandedProvider('github');
        // base map per jenkins integration
        const bm: Record<string, string> = {};
        jcs.forEach((c) => { bm[c.id] = c.baseUrl; });
        setActiveBaseByJenkins(bm);

        // do not prefetch global lists; load lazily per integration selection
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.error || e.message || 'Failed to load builds');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Builds</Typography>
      {loading && <Typography>Loading...</Typography>}
      {error && <Typography color="error">{error}</Typography>}
      {!loading && !error && (
        <Stack spacing={2}>
          {/* Jenkins */}
          <Accordion expanded={expandedProvider === 'jenkins'} onChange={(_e: React.SyntheticEvent, exp: boolean) => setExpandedProvider(exp ? 'jenkins' : null)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
              <Typography variant="h6">Jenkins</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {jenkinsConfigs.length === 0 && <Typography color="text.secondary">No Jenkins integrations configured</Typography>}
              <List disablePadding>
                {jenkinsConfigs.map((cfg: { id: string; name?: string; baseUrl: string; active?: boolean }) => (
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
                        } catch { setJenkinsJobsByProvider((prev: Record<string, { name: string; url?: string }[]>) => ({ ...prev, [cfg.id]: [] })); }
                      }
                    }}>
                      <ListItemText primary={cfg.name || 'Jenkins'} secondary={cfg.baseUrl} />
                      <ExpandMoreIcon sx={{ transform: expandedJenkins.has(cfg.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </ListItemButton>
                    {expandedJenkins.has(cfg.id) && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Jobs</Typography>
                        <List dense disablePadding>
                          {(jenkinsJobsByProvider[cfg.id] || []).map((j: { name: string; url?: string }) => (
                            <Box key={j.name} sx={{ mb: 1 }}>
                              <ListItemButton onClick={async () => {
                                const key = `${cfg.id}::${j.name}`;
                                if (!jenkinsBuildsByKey[key]) {
                                  try {
                                    const { data } = await api.get(`/integrations/jenkins/jobs/${encodeURIComponent(j.name)}/builds`, { params: { providerId: cfg.id, limit: 25 } });
                                    const list: JenkinsBuild[] = (data.data?.builds || data.builds || []) as JenkinsBuild[];
                                    setJenkinsBuildsByKey((prev: Record<string, JenkinsBuild[]>) => ({ ...prev, [key]: list }));
                                  } catch { setJenkinsBuildsByKey((prev: Record<string, JenkinsBuild[]>) => ({ ...prev, [key]: [] })); }
                                }
                              }}>
                                <ListItemText primary={j.name} />
                              </ListItemButton>
                              {jenkinsBuildsByKey[`${cfg.id}::${j.name}`] && (
                                <Box sx={{ p: 1 }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Build</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Duration</TableCell>
                                        <TableCell>When</TableCell>
                                        <TableCell>Open</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {jenkinsBuildsByKey[`${cfg.id}::${j.name}`].length === 0 && (
                                        <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No builds</Typography></TableCell></TableRow>
                                      )}
                                      {jenkinsBuildsByKey[`${cfg.id}::${j.name}`].map((b: JenkinsBuild) => (
                                        <TableRow key={`${j.name}#${b.number}`} hover>
                                          <TableCell>#{b.number}</TableCell>
                                          <TableCell>{statusChip(b.result, b.building)}</TableCell>
                                          <TableCell>{`${Math.round((b.duration||0)/1000)}s`}</TableCell>
                                          <TableCell>{b.timestamp ? new Date(b.timestamp).toLocaleString() : '—'}</TableCell>
                                          <TableCell>{b.url && <MuiLink href={fixUrlForBase(b.url, activeBaseByJenkins[cfg.id])} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </Box>
                              )}
                            </Box>
                          ))}
                          {(!jenkinsJobsByProvider[cfg.id] || jenkinsJobsByProvider[cfg.id].length === 0) && (
                            <Typography color="text.secondary" sx={{ px: 2, py: 1 }}>No jobs</Typography>
                          )}
                        </List>
                      </Box>
                    )}
                  </Box>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* GitHub Actions */}
          <Accordion expanded={expandedProvider === 'github'} onChange={(_e: React.SyntheticEvent, exp: boolean) => setExpandedProvider(exp ? 'github' : null)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
              <Typography variant="h6">GitHub Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {githubConfigs.length === 0 && <Typography color="text.secondary">No GitHub integrations configured</Typography>}
              <List disablePadding>
                {githubConfigs.map((cfg: { id: string; name?: string; owner?: string; repo?: string; active?: boolean }) => (
                  <Box key={cfg.id} sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <ListItemButton onClick={async () => {
                      const next = new Set(expandedGithub);
                      if (next.has(cfg.id)) { next.delete(cfg.id); setExpandedGithub(next); return; }
                      next.add(cfg.id); setExpandedGithub(next);
                      if (!githubWorkflowsByProvider[cfg.id]) {
                        try {
                          const { data } = await api.get('/integrations/github/workflows', { params: { providerId: cfg.id } });
                          const wfs = (((data.data || data).workflows) || (data.data || data)) as { id: string | number; name: string; html_url?: string }[];
                          setGithubWorkflowsByProvider((prev: Record<string, { id: string | number; name: string; html_url?: string }[]>) => ({ ...prev, [cfg.id]: wfs || [] }));
                        } catch { setGithubWorkflowsByProvider((prev: Record<string, { id: string | number; name: string; html_url?: string }[]>) => ({ ...prev, [cfg.id]: [] })); }
                      }
                    }}>
                      <ListItemText primary={cfg.name || (cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : 'GitHub Actions')} />
                      <ExpandMoreIcon sx={{ transform: expandedGithub.has(cfg.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </ListItemButton>
                    {expandedGithub.has(cfg.id) && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Workflows</Typography>
                        <List dense disablePadding>
                          {(githubWorkflowsByProvider[cfg.id] || []).map((w: { id: string | number; name: string; html_url?: string }) => (
                            <Box key={String(w.id)} sx={{ mb: 1 }}>
                              <ListItemButton onClick={async () => {
                                const key = `${cfg.id}::${w.id}`;
                                if (!githubRunsByKey[key]) {
                                  try {
                                    const { data } = await api.get('/integrations/github/runs', { params: { providerId: cfg.id, workflow_id: w.id, limit: 25 } });
                                    const runs: GitHubRun[] = (data.data || data) as GitHubRun[];
                                    setGithubRunsByKey((prev: Record<string, GitHubRun[]>) => ({ ...prev, [key]: runs || [] }));
                                  } catch { setGithubRunsByKey((prev: Record<string, GitHubRun[]>) => ({ ...prev, [key]: [] })); }
                                }
                              }}>
                                <ListItemText primary={w.name} />
                              </ListItemButton>
                              {githubRunsByKey[`${cfg.id}::${w.id}`] && (
                                <Box sx={{ p: 1 }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Run</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>When</TableCell>
                                        <TableCell>Open</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {githubRunsByKey[`${cfg.id}::${w.id}`].length === 0 && (
                                        <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No runs</Typography></TableCell></TableRow>
                                      )}
                                      {githubRunsByKey[`${cfg.id}::${w.id}`].map((r: GitHubRun) => (
                                        <TableRow key={String(r.id)} hover>
                                          <TableCell>#{r.run_number} {r.display_title ? `— ${r.display_title}` : ''}</TableCell>
                                          <TableCell>{(r.status === 'completed' ? (r.conclusion || 'UNKNOWN') : (r.status || 'PENDING')).toUpperCase()}</TableCell>
                                          <TableCell>{r.run_started_at ? new Date(r.run_started_at).toLocaleString() : '—'}</TableCell>
                                          <TableCell>{r.html_url && <MuiLink href={r.html_url} target="_blank" rel="noreferrer">Open ↗</MuiLink>}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </Box>
                              )}
                            </Box>
                          ))}
                          {(!githubWorkflowsByProvider[cfg.id] || githubWorkflowsByProvider[cfg.id].length === 0) && (
                            <Typography color="text.secondary" sx={{ px: 2, py: 1 }}>No workflows</Typography>
                          )}
                        </List>
                      </Box>
                    )}
                  </Box>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Stack>
      )}
    </Box>
  );
};

export default Builds;