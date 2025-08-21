import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Divider, Stack, Alert, Accordion, AccordionSummary, AccordionDetails, List, ListItemButton, ListItemText } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import api from '../services/api';

type DeploymentSummary = {
  windowDays: number;
  deployments: number;
  successRate: number;
  perJob: { job: string; deployments: number; successRate: number }[];
};

const Deployments: React.FC = () => {
  // provider configs
  const [jenkinsConfigs, setJenkinsConfigs] = useState<Array<{ id: string; name?: string; baseUrl: string; active?: boolean }>>([]);
  const [githubConfigs, setGithubConfigs] = useState<Array<{ id: string; name?: string; owner?: string; repo?: string; active?: boolean }>>([]);

  // UI expanded state
  const [expandedProvider, setExpandedProvider] = useState<'jenkins' | 'github' | null>(null);
  const [expandedJenkins, setExpandedJenkins] = useState<Set<string>>(new Set());
  const [expandedGithub, setExpandedGithub] = useState<Set<string>>(new Set());

  // per-integration data caches
  const [jenkinsSummaryById, setJenkinsSummaryById] = useState<Record<string, DeploymentSummary | null>>({});
  const [githubSummaryById, setGithubSummaryById] = useState<Record<string, DeploymentSummary | null>>({});
  const [jenkinsErrorById, setJenkinsErrorById] = useState<Record<string, string | null>>({});
  const [githubErrorById, setGithubErrorById] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

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
        }
      } catch (e: any) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Deployments</Typography>
      {loading && <Typography>Loading deployments...</Typography>}
      {!loading && (
        <Stack spacing={2}>
          {/* Jenkins Provider */}
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
                      if (jenkinsSummaryById[cfg.id] === undefined) {
                        try {
                          const res = await api.get('/integrations/jenkins/deployments/summary', { params: { providerId: cfg.id, windowDays: 7 } });
                          const payload: DeploymentSummary = (res.data.data || res.data) as DeploymentSummary;
                          setJenkinsSummaryById((prev: Record<string, DeploymentSummary | null>) => ({ ...prev, [cfg.id]: payload }));
                          setJenkinsErrorById((prev: Record<string, string | null>) => ({ ...prev, [cfg.id]: null }));
                        } catch (e: any) {
                          setJenkinsSummaryById((prev: Record<string, DeploymentSummary | null>) => ({ ...prev, [cfg.id]: null }));
                          setJenkinsErrorById((prev: Record<string, string | null>) => ({ ...prev, [cfg.id]: e?.response?.data?.error || e.message || 'Failed to load Jenkins deployments' }));
                        }
                      }
                    }}>
                      <ListItemText primary={cfg.name || 'Jenkins'} secondary={cfg.baseUrl} />
                      <ExpandMoreIcon sx={{ transform: expandedJenkins.has(cfg.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </ListItemButton>
                    {expandedJenkins.has(cfg.id) && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        {jenkinsErrorById[cfg.id] && <Alert severity="error" sx={{ mb: 1 }}>{jenkinsErrorById[cfg.id]}</Alert>}
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {jenkinsSummaryById[cfg.id] ? (
                            <>Window: last {jenkinsSummaryById[cfg.id]?.windowDays} day(s) • Total deployments: {jenkinsSummaryById[cfg.id]?.deployments} • Success rate: {jenkinsSummaryById[cfg.id]?.successRate}%</>
                          ) : (
                            <>No data available</>
                          )}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Job</TableCell>
                              <TableCell align="right">Deployments</TableCell>
                              <TableCell align="right">Success Rate</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(!jenkinsSummaryById[cfg.id] || !jenkinsSummaryById[cfg.id]?.perJob || jenkinsSummaryById[cfg.id]?.perJob.length === 0) && (
                              <TableRow><TableCell colSpan={3}><Typography color="text.secondary">No deployment jobs detected</Typography></TableCell></TableRow>
                            )}
                            {jenkinsSummaryById[cfg.id]?.perJob?.map((r: { job: string; deployments: number; successRate: number }) => (
                              <TableRow key={`jk-${cfg.id}-${r.job}`} hover>
                                <TableCell>{r.job}</TableCell>
                                <TableCell align="right">{r.deployments}</TableCell>
                                <TableCell align="right">{r.successRate}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )}
                  </Box>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* GitHub Provider */}
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
                      if (githubSummaryById[cfg.id] === undefined) {
                        try {
                          const res = await api.get('/integrations/github/deployments/summary', { params: { providerId: cfg.id, windowDays: 7 } });
                          const payload: DeploymentSummary = (res.data.data || res.data) as DeploymentSummary;
                          setGithubSummaryById((prev: Record<string, DeploymentSummary | null>) => ({ ...prev, [cfg.id]: payload }));
                          setGithubErrorById((prev: Record<string, string | null>) => ({ ...prev, [cfg.id]: null }));
                        } catch (e: any) {
                          setGithubSummaryById((prev: Record<string, DeploymentSummary | null>) => ({ ...prev, [cfg.id]: null }));
                          setGithubErrorById((prev: Record<string, string | null>) => ({ ...prev, [cfg.id]: e?.response?.data?.error || e.message || 'Failed to load GitHub deployments' }));
                        }
                      }
                    }}>
                      <ListItemText primary={cfg.name || (cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : 'GitHub Actions')} />
                      <ExpandMoreIcon sx={{ transform: expandedGithub.has(cfg.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </ListItemButton>
                    {expandedGithub.has(cfg.id) && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        {githubErrorById[cfg.id] && <Alert severity="error" sx={{ mb: 1 }}>{githubErrorById[cfg.id]}</Alert>}
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {githubSummaryById[cfg.id] ? (
                            <>Window: last {githubSummaryById[cfg.id]?.windowDays} day(s) • Total deployments: {githubSummaryById[cfg.id]?.deployments} • Success rate: {githubSummaryById[cfg.id]?.successRate}%</>
                          ) : (
                            <>No data available</>
                          )}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Workflow/Env</TableCell>
                              <TableCell align="right">Deployments</TableCell>
                              <TableCell align="right">Success Rate</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(!githubSummaryById[cfg.id] || !githubSummaryById[cfg.id]?.perJob || githubSummaryById[cfg.id]?.perJob.length === 0) && (
                              <TableRow><TableCell colSpan={3}><Typography color="text.secondary">No deployment jobs detected</Typography></TableCell></TableRow>
                            )}
                            {githubSummaryById[cfg.id]?.perJob?.map((r: { job: string; deployments: number; successRate: number }) => (
                              <TableRow key={`gh-${cfg.id}-${r.job}`} hover>
                                <TableCell>{r.job}</TableCell>
                                <TableCell align="right">{r.deployments}</TableCell>
                                <TableCell align="right">{r.successRate}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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

export default Deployments;