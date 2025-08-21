const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../database/connection');
const github = require('../services/githubService');

router.use(protect);

async function getActiveConfig(req) {
  // Allow override via ?providerId
  const providerId = req.query.providerId || req.headers['x-provider-id'];
  let cfg;
  if (providerId) {
    cfg = await prisma.gitHubIntegration.findUnique({ where: { id: providerId } });
  } else {
    cfg = await prisma.gitHubIntegration.findFirst({ where: { active: true } });
  }
  if (!cfg) {
    const err = new Error('GitHub not configured');
    err.status = 400;
    throw err;
  }
  return { owner: cfg.owner, repo: cfg.repo, token: cfg.token };
}

router.get('/workflows', async (req, res, next) => {
  try {
    const override = await getActiveConfig(req);
    const data = await github.listWorkflows(override);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/runs', async (req, res, next) => {
  try {
    const override = await getActiveConfig(req);
    const { limit, status, workflow_id } = req.query;
    const data = await github.listWorkflowRuns({ per_page: limit ? Number(limit) : 25, status, workflow_id }, override);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/runs/:run_id/logs', async (req, res, next) => {
  try {
    const override = await getActiveConfig(req);
    const text = await github.getRunLogs(req.params.run_id, override);
    res.type('text/plain').send(text || '');
  } catch (err) { next(err); }
});

router.get('/deployments/summary', async (req, res, next) => {
  try {
    const override = await getActiveConfig(req);
    const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 7;
    const data = await github.deploymentsSummary({ windowDays }, override);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/workflows/summary', async (req, res, next) => {
  try {
    const override = await getActiveConfig(req);
    const data = await github.workflowsSummary(override);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/workflows/trends', async (req, res, next) => {
  try {
    const override = await getActiveConfig(req);
    const days = req.query.days ? Number(req.query.days) : 14;
    const data = await github.workflowsTrends({ days }, override);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
