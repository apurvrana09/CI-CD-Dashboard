const axios = require('axios');

function ensureConfigured(override) {
  if (!override?.owner || !override?.repo || !override?.token) {
    throw new Error('GitHub not configured');
  }
}

function ghClient(override) {
  ensureConfigured(override);
  const baseURL = `https://api.github.com/repos/${override.owner}/${override.repo}`;
  const client = axios.create({ baseURL, headers: { 'Accept': 'application/vnd.github+json' } });
  client.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${override.token}`;
    config.headers['X-GitHub-Api-Version'] = '2022-11-28';
    return config;
  });
  return client;
}

async function listWorkflows(override) {
  const client = ghClient(override);
  const { data } = await client.get('/actions/workflows');
  const items = data.workflows || [];
  return items.map(w => ({
    id: w.id,
    name: w.name,
    state: w.state,
    path: w.path,
    html_url: w.html_url,
    badge_url: w.badge_url,
  }));
}

async function listWorkflowRuns(params = {}, override) {
  const client = ghClient(override);
  const { status, per_page = 25, workflow_id } = params;
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  query.set('per_page', String(per_page));
  let url = '/actions/runs';
  if (workflow_id) url = `/actions/workflows/${encodeURIComponent(workflow_id)}/runs`;
  const { data } = await client.get(`${url}?${query.toString()}`);
  const items = data.workflow_runs || [];
  return items.map(r => ({
    id: r.id,
    name: r.name,
    display_title: r.display_title,
    event: r.event,
    status: r.status,
    conclusion: r.conclusion,
    run_number: r.run_number,
    created_at: r.created_at,
    updated_at: r.updated_at,
    run_started_at: r.run_started_at,
    html_url: r.html_url,
    actor: r.actor?.login,
    head_branch: r.head_branch,
    head_sha: r.head_sha,
    durationMs: r.run_started_at && r.updated_at ? (new Date(r.updated_at) - new Date(r.run_started_at)) : null,
  }));
}

async function deploymentsSummary({ windowDays = 7 }, override) {
  const since = new Date(Date.now() - windowDays*24*60*60*1000);
  const runs = await listWorkflowRuns({ per_page: 100 }, override);
  const recent = runs.filter(r => new Date(r.created_at) >= since);
  const isDeploy = (r) => /deploy/i.test(r.name || '') || /deploy/i.test(r.display_title || '') || /deploy/i.test(r.head_branch || '');
  const deploys = recent.filter(isDeploy);
  const success = deploys.filter(r => r.conclusion === 'success').length;
  const perJobMap = new Map();
  for (const r of deploys) {
    const key = r.name || r.display_title || 'workflow';
    const entry = perJobMap.get(key) || { job: key, deployments: 0, successRate: 0, success: 0 };
    entry.deployments += 1;
    if (r.conclusion === 'success') entry.success += 1;
    perJobMap.set(key, entry);
  }
  const perJob = Array.from(perJobMap.values()).map(e => ({ job: e.job, deployments: e.deployments, successRate: e.deployments ? Math.round((e.success/e.deployments)*100) : 0 }));
  return { windowDays, deployments: deploys.length, successRate: deploys.length ? Math.round((success/deploys.length)*100) : 0, perJob };
}

async function listRunJobs(run_id, override) {
  const client = ghClient(override);
  const { data } = await client.get(`/actions/runs/${encodeURIComponent(run_id)}/jobs?per_page=100`);
  return (data.jobs || []).map(j => ({
    id: j.id,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    started_at: j.started_at,
    completed_at: j.completed_at,
  }));
}

async function getJobLogText(job_id, override) {
  const client = ghClient(override);
  // GitHub returns 302 redirect to a temporary URL for the plain text logs
  const res = await client.get(`/actions/jobs/${encodeURIComponent(job_id)}/logs`, {
    maxRedirects: 0,
    validateStatus: (s) => s === 302,
  });
  const loc = res.headers.location;
  if (!loc) return '';
  const { data } = await axios.get(loc, { responseType: 'text' });
  return typeof data === 'string' ? data : '';
}

async function getRunLogs(run_id, override) {
  const jobs = await listRunJobs(run_id, override);
  const parts = [];
  for (const j of jobs) {
    try {
      const text = await getJobLogText(j.id, override);
      parts.push(`# Job: ${j.name} (id: ${j.id})`);
      parts.push(text || '[no logs]');
      parts.push('\n');
    } catch (e) {
      parts.push(`# Job: ${j.name} (id: ${j.id})`);
      parts.push(`[failed to fetch logs] ${e?.message || e}`);
      parts.push('\n');
    }
  }
  return parts.join('\n');
}

async function workflowsSummary(override) {
  // Fetch workflows, then compute stats per workflow using robust fetching strategies
  const workflows = await listWorkflows(override);
  const result = [];
  for (const w of workflows) {
    let runs = [];
    try {
      runs = await listWorkflowRuns({ per_page: 10, workflow_id: w.id }, override);
      if (!runs || runs.length === 0) {
        // Try using the workflow path if available
        if (w.path) {
          try {
            runs = await listWorkflowRuns({ per_page: 10, workflow_id: w.path }, override);
          } catch (_) { /* ignore */ }
        }
      }
      if (!runs || runs.length === 0) {
        // Fallback to repo-wide runs and filter by workflow name/display title
        const all = await listWorkflowRuns({ per_page: 50 }, override);
        const wname = (w.name || '').toLowerCase();
        runs = (all || []).filter(r => {
          const n = (r.name || '').toLowerCase();
          const t = (r.display_title || '').toLowerCase();
          return n === wname || n.includes(wname) || t.includes(wname);
        });
      }
    } catch (_) {
      runs = [];
    }

    let lastStatus = '—';
    let lastAt = undefined;
    let successRate = 0;
    let avgDurationSec = 0;
    if (runs && runs.length > 0) {
      const last = runs[0];
      lastStatus = (last.status === 'completed' ? (last.conclusion || 'UNKNOWN') : (last.status || 'PENDING')).toUpperCase();
      lastAt = last.run_started_at || undefined;
      const completed = runs.filter(r => r.status === 'completed');
      if (completed.length > 0) {
        const successes = completed.filter(r => (r.conclusion || '').toLowerCase() === 'success').length;
        successRate = Math.round((successes / completed.length) * 100);
        const durations = completed.map(r => {
          const s = r.run_started_at ? new Date(r.run_started_at).getTime() : 0;
          const e = r.updated_at ? new Date(r.updated_at).getTime() : 0;
          return s && e && e > s ? Math.round((e - s) / 1000) : 0;
        }).filter(n => n > 0);
        avgDurationSec = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      }
    }

    result.push({
      id: w.id,
      name: w.name,
      path: w.path,
      html_url: w.html_url,
      lastStatus,
      lastAt,
      successRate,
      avgDurationSec,
    });
  }
  return { workflows: result };
}

async function workflowsTrends({ days = 14 } = {}, override) {
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d.toISOString().slice(0, 10) });
  }

  // Fetch up to 100 recent runs for the repo and bucket them by day
  let runs = [];
  try {
    runs = await listWorkflowRuns({ per_page: 100 }, override);
  } catch (_) {
    runs = [];
  }

  const series = buckets.map((b) => ({ date: b.date, runs: 0, successes: 0, durationsSec: [] }));
  for (const r of runs) {
    const started = r.run_started_at ? new Date(r.run_started_at) : (r.created_at ? new Date(r.created_at) : null);
    if (!started) continue;
    started.setHours(0, 0, 0, 0);
    const key = started.toISOString().slice(0, 10);
    const idx = series.findIndex((s) => s.date === key);
    if (idx === -1) continue;
    series[idx].runs += 1;
    if ((r.conclusion || '').toLowerCase() === 'success') series[idx].successes += 1;
    const durMs = r.durationMs || 0;
    if (durMs > 0) series[idx].durationsSec.push(Math.round(durMs / 1000));
  }

  const points = series.map((s) => ({
    date: s.date,
    totalRuns: s.runs,
    successRate: s.runs ? Math.round((s.successes / s.runs) * 100) : 0,
    avgDurationSec: s.durationsSec.length ? Math.round(s.durationsSec.reduce((a, b) => a + b, 0) / s.durationsSec.length) : 0,
  }));

  return { days, points };
}

module.exports = {
  listWorkflows,
  listWorkflowRuns,
  deploymentsSummary,
  listRunJobs,
  getRunLogs,
  workflowsSummary,
  workflowsTrends,
};
