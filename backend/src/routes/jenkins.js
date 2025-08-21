async function resolveOverride(req) {
  const providerId = req.query.providerId;
  if (providerId) {
    const cfg = await prisma.jenkinsIntegration.findUnique({ where: { id: providerId } });
    if (cfg) return { baseURL: cfg.baseUrl, username: cfg.username || undefined, password: cfg.password || undefined };
  }
  // fallback: active config
  const active = await prisma.jenkinsIntegration.findFirst({ where: { active: true } });
  if (active) return { baseURL: active.baseUrl, username: active.username || undefined, password: active.password || undefined };
  return undefined;
}
const express = require('express');
const router = express.Router();
const { getJobs, getJobBuilds, getLastBuild, getJobInfo, getBuildLog } = require('../services/jenkinsService');
const { prisma } = require('../database/connection');
const { protect } = require('../middleware/auth');

// All Jenkins integration routes are protected
router.use(protect);

// GET /api/v1/integrations/jenkins/jobs
router.get('/jobs', async (req, res, next) => {
  try {
    const override = await resolveOverride(req);
    const jobs = await getJobs(override);
    res.json({ success: true, data: { jobs } });
  } catch (err) {
    if (err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

// GET /api/v1/integrations/jenkins/jobs/:job/builds?limit=20
router.get('/jobs/:job(*)/builds', async (req, res, next) => {
  try {
    const { job } = req.params;
    const limit = parseInt(req.query.limit, 10) || 20;
    const override = await resolveOverride(req);
    const builds = await getJobBuilds(job, limit, override);
    res.json({ success: true, data: { job, builds } });
  } catch (err) {
    if (err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

// GET /api/v1/integrations/jenkins/jobs/:job/info
router.get('/jobs/:job(*)/info', async (req, res, next) => {
  try {
    const { job } = req.params;
    const override = await resolveOverride(req);
    const info = await getJobInfo(job, override);
    res.json({ success: true, data: info });
  } catch (err) {
    if (err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

// GET /api/v1/integrations/jenkins/overview -> jobs + last build
router.get('/overview', async (req, res, next) => {
  try {
    const override = await resolveOverride(req);
    const jobs = await getJobs(override);
    const lastBuilds = await Promise.all(
      jobs.map(async (j) => {
        try {
          const b = await getLastBuild(j.name, override);
          return { job: j.name, lastBuild: b };
        } catch (_) {
          return { job: j.name, lastBuild: null };
        }
      })
    );
    res.json({ success: true, data: { jobs, lastBuilds } });
  } catch (err) {
    if (err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

// GET /api/v1/integrations/jenkins/metrics/trends?days=14
router.get('/metrics/trends', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 14;
    const override = await resolveOverride(req);
    const now = new Date();
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.push({ date: d, key: d.toISOString().slice(0, 10) });
    }

    const jobs = await getJobs(override);
    const series = buckets.map(b => ({ date: b.key, builds: 0, successes: 0, durations: [] }));

    for (const j of jobs) {
      const builds = await getJobBuilds(j.name, days * 20, override);
      for (const b of builds) {
        const bd = new Date(b.timestamp);
        bd.setHours(0,0,0,0);
        const key = bd.toISOString().slice(0,10);
        const idx = series.findIndex(s => s.date === key);
        if (idx !== -1) {
          series[idx].builds += 1;
          if (b.result === 'SUCCESS') series[idx].successes += 1;
          if (b.duration) series[idx].durations.push(b.duration);
        }
      }
    }

    const points = series.map(s => ({
      date: s.date,
      totalBuilds: s.builds,
      successRate: s.builds ? Math.round((s.successes / s.builds) * 100) : 0,
      avgDurationMs: s.durations.length ? Math.round(s.durations.reduce((a,b)=>a+b,0)/s.durations.length) : 0,
    }));

    res.json({ success: true, data: { days, points } });
  } catch (err) {
    if (err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

// Metrics & Trends
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a,b)=>a-b);
  const idx = Math.ceil((p/100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length-1, idx))];
}

// GET /api/v1/integrations/jenkins/metrics/summary?window=30&perJob=true
router.get('/metrics/summary', async (req, res, next) => {
  try {
    const window = parseInt(req.query.window, 10) || 30; // last N builds per job
    const includePerJob = String(req.query.perJob || 'true') === 'true';
    const override = await resolveOverride(req);
    const jobs = await getJobs(override);
    let totalBuilds = 0;
    let success = 0;
    const durations = [];
    const perJob = [];

    for (const j of jobs) {
      const builds = await getJobBuilds(j.name, window, override);
      const results = builds.filter(b=>b.result);
      const succ = results.filter(b=>b.result === 'SUCCESS').length;
      const durs = results.map(b=>b.duration).filter(Boolean);
      totalBuilds += results.length;
      success += succ;
      durations.push(...durs);
      if (includePerJob) {
        perJob.push({
          job: j.name,
          builds: results.length,
          successRate: results.length ? Math.round((succ/results.length)*100) : 0,
          avgDurationMs: durs.length ? Math.round(durs.reduce((a,b)=>a+b,0)/durs.length) : 0,
        });
      }
    }

    const avg = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length) : 0;
    const med = durations.length ? percentile(durations, 50) : 0;
    const p95 = durations.length ? percentile(durations, 95) : 0;
    const successRate = totalBuilds ? Math.round((success/totalBuilds)*100) : 0;

    res.json({
      success: true,
      data: {
        window,
        totals: {
          totalBuilds,
          successRate,
          avgDurationMs: avg,
          medianDurationMs: med,
          p95DurationMs: p95,
        },
        perJob: includePerJob ? perJob : undefined,
      }
    });
  } catch (err) {
    if (err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

// GET /api/v1/integrations/jenkins/deployments/summary?windowDays=1&regex=deploy
router.get('/deployments/summary', async (req, res, next) => {
  try {
    const windowDays = parseInt(req.query.windowDays, 10) || 1; // last N days
    const regex = new RegExp(req.query.regex || process.env.JENKINS_DEPLOY_JOB_REGEX || 'deploy', 'i');
    const now = Date.now();
    const cutoff = now - windowDays*24*60*60*1000;
    const override = await resolveOverride(req);
    const jobs = (await getJobs(override)).filter(j=>regex.test(j.name));
    let deployments = 0;
    let successes = 0;
    const perJob = [];
    for (const j of jobs) {
      const builds = await getJobBuilds(j.name, 100, override);
      const recent = builds.filter(b=>b.timestamp >= cutoff);
      const succ = recent.filter(b=>b.result === 'SUCCESS').length;
      deployments += recent.length;
      successes += succ;
      perJob.push({ job: j.name, deployments: recent.length, successRate: recent.length ? Math.round((succ/recent.length)*100) : 0 });
    }
    res.json({ success: true, data: { windowDays, deployments, successRate: deployments? Math.round((successes/deployments)*100):0, perJob }});
  } catch (err) {
    if (err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

// GET /api/v1/integrations/jenkins/jobs/:job/builds/:number/log
router.get('/jobs/:job(*)/builds/:number/log', async (req, res, next) => {
  try {
    const { job, number } = req.params;
    const override = await resolveOverride(req);
    const text = await getBuildLog(job, number, override);
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    if (err.message && err.message.includes('Jenkins not configured')) {
      return res.status(503).json({ success: false, error: 'Jenkins is not configured on the server' });
    }
    next(err);
  }
});

module.exports = router;
