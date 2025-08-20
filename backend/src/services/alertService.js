const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { prisma } = require('../database/connection');
const { logger } = require('../utils/logger');
const { getJobs, getJobBuilds, getLastBuild } = require('./jenkinsService');
const { listWorkflowRuns } = require('./githubService');

// Blocked recipient domains and addresses to avoid accidental mails
const BLOCKED_DOMAINS = ['.local', '.test'];
const BLOCKED_ADDRESSES = ['dev@local.test'];

function sanitizeRecipients(input) {
  const raw = String(input || '');
  const parts = raw.split(/[;,\s]+/).map((s) => s.trim()).filter(Boolean);
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const filtered = parts.filter((addr) => {
    const a = addr.toLowerCase();
    if (!emailRegex.test(a)) return false;
    if (BLOCKED_ADDRESSES.includes(a)) return false;
    if (BLOCKED_DOMAINS.some((d) => a.endsWith(d))) return false;
    return true;
  });
  return filtered;
}

function buildMailer() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = buildMailer();
  if (!transporter) {
    logger.warn('SMTP not configured; skipping email send');
    return { ok: false, reason: 'smtp_not_configured' };
  }
  const from = process.env.SMTP_FROM || 'alerts@cicd-dashboard.local';
  await transporter.sendMail({ from, to, subject, text, html });
  return { ok: true };
}

async function sendSlack({ webhookUrl, text, blocks }) {
  if (!webhookUrl) {
    logger.warn('Slack webhook URL missing; skipping Slack send');
    return { ok: false, reason: 'slack_webhook_missing' };
  }
  await axios.post(webhookUrl, blocks ? { blocks, text } : { text });
  return { ok: true };
}

async function recordHistory({ alertId, status = 'SENT', message, pipelineId = null, buildId = null, userId = null }) {
  try {
    await prisma.alertHistory.create({
      data: { alertId, status, message, pipelineId, buildId, userId },
    });
  } catch (e) {
    logger.error('Failed to record alert history', e);
  }
}

async function alreadySentRecently(alertId, message, minutes = 60) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const count = await prisma.alertHistory.count({ where: { alertId, message, sentAt: { gte: since } } });
  return count > 0;
}

function fmtBuildLink({ provider, job, number, url }) {
  if (url) return url;
  return `${provider} ${job} #${number}`;
}

async function evaluateJenkins(alert) {
  const cond = alert.conditions || {};
  const event = String(cond.event || 'FAILURE').toUpperCase(); // FAILURE | SUCCESS | COMPLETED
  const onlyJob = cond.jenkinsJob || cond.job; // support both keys
  const recent = Number(cond.recentMinutes || 180);
  const whereJ = { active: true };
  if (cond.jenkinsProviderId) whereJ.id = cond.jenkinsProviderId;
  const jenkinsList = await prisma.jenkinsIntegration.findMany({ where: whereJ });
  for (const cfg of jenkinsList) {
    try {
      const override = { baseURL: cfg.baseUrl, username: cfg.username || undefined, password: cfg.password || undefined };
      // Limit to a single job if specified, else all
      const jobs = onlyJob ? [{ name: onlyJob }] : await getJobs(override);
      for (const j of jobs) {
        let last;
        try { last = await getLastBuild(j.name, override); } catch (_) { last = null; }
        if (!last) continue;
        // Time-window filter: only notify if last build is within recentMinutes
        const lastTs = typeof last.timestamp === 'number' ? new Date(last.timestamp) : new Date();
        const cutoff = new Date(Date.now() - recent * 60 * 1000);
        if (lastTs < cutoff) continue;

        const result = String(last.result || '').toUpperCase();
        const completed = !!result;
        const isFailure = result === 'FAILURE';
        const isSuccess = result === 'SUCCESS';
        const matches = (event === 'FAILURE' && isFailure) || (event === 'SUCCESS' && isSuccess) || (event === 'COMPLETED' && completed);
        if (!matches) continue;
        const message = `[Jenkins] ${j.name} #${last.number} ${isFailure ? 'failed' : isSuccess ? 'succeeded' : (result || 'completed')}`;
        if (await alreadySentRecently(alert.id, message, recent)) continue;
        await dispatchChannels(alert, {
          title: `Build ${isFailure ? 'Failure' : isSuccess ? 'Success' : 'Completed'} (Jenkins)`,
          text: `${message}\nDuration: ${last.duration}ms\nWhen: ${lastTs.toLocaleString()}`,
          link: last.url || undefined,
        });
        await recordHistory({ alertId: alert.id, status: 'SENT', message });
      }
    } catch (e) {
      logger.warn('Jenkins alert evaluation failed', { integration: cfg.id, err: e?.message });
    }
  }
}

async function evaluateGitHub(alert) {
  const cond = alert.conditions || {};
  const event = String(cond.event || 'FAILURE').toUpperCase(); // FAILURE | SUCCESS | COMPLETED
  const workflowId = cond.githubWorkflowId || cond.workflowId;
  const recent = Number(cond.recentMinutes || 180);
  const whereG = { active: true };
  if (cond.githubProviderId) whereG.id = cond.githubProviderId;
  const ghList = await prisma.gitHubIntegration.findMany({ where: whereG });
  for (const cfg of ghList) {
    try {
      const override = { owner: cfg.owner, repo: cfg.repo, token: cfg.token };
      const params = { per_page: 30 };
      if (workflowId) params.workflow_id = workflowId;
      const runs = await listWorkflowRuns(params, override);
      const list = Array.isArray(runs) ? runs : [];
      if (list.length === 0) continue;
      // Only consider the latest run and only if within recentMinutes
      const r = list[0];
      const runTs = new Date(r.run_started_at || r.updated_at || r.created_at);
      const cutoff = new Date(Date.now() - recent * 60 * 1000);
      if (!(runTs instanceof Date) || isNaN(runTs.getTime()) || runTs < cutoff) continue;

      const status = String(r.status || '').toLowerCase();
      const conclusion = String(r.conclusion || '').toUpperCase();
      const completed = status === 'completed';
      const isFailure = completed && conclusion === 'FAILURE';
      const isSuccess = completed && conclusion === 'SUCCESS';
      const matches = (event === 'FAILURE' && isFailure) || (event === 'SUCCESS' && isSuccess) || (event === 'COMPLETED' && completed);
      if (!matches) continue;
      const message = `[GitHub] ${cfg.owner}/${cfg.repo} run #${r.run_number} ${isFailure ? 'failed' : isSuccess ? 'succeeded' : (conclusion || status)}`;
      if (await alreadySentRecently(alert.id, message, recent)) continue;
      await dispatchChannels(alert, {
        title: `Build ${isFailure ? 'Failure' : isSuccess ? 'Success' : 'Completed'} (GitHub)`,
        text: `${message}\nBranch: ${r.head_branch}\nWhen: ${runTs.toLocaleString()}`,
        link: r.html_url || undefined,
      });
      await recordHistory({ alertId: alert.id, status: 'SENT', message });
    } catch (e) {
      logger.warn('GitHub alert evaluation failed', { integration: cfg.id, err: e?.message });
    }
  }
}

async function dispatchChannels(alert, payload) {
  const channels = alert.channels || {};
  const promises = [];
  // Email channel: { to: "a@b.com,c@d.com" }
  if (channels.email?.to) {
    const subject = `[CI/CD] ${payload.title}`;
    const recips = sanitizeRecipients(channels.email.to);
    if (recips.length === 0) {
      logger.warn('Email skipped: no valid recipients after sanitization', { alertId: alert.id });
    } else {
      const to = recips.join(',');
      const text = `${payload.text}${payload.link ? `\nLink: ${payload.link}` : ''}`;
      const html = `<p>${payload.text.replace(/\n/g, '<br/>')}</p>${payload.link ? `<p><a href="${payload.link}">Open</a></p>` : ''}`;
      promises.push(sendEmail({ to, subject, text, html }).catch((e)=>logger.error('Email send failed', e)));
    }
  }
  // Slack channel: { webhookUrl: "https://hooks.slack.com/services/..." }
  if (channels.slack?.webhookUrl) {
    const text = `*${payload.title}*\n${payload.text}${payload.link ? `\n<${payload.link}|Open>` : ''}`;
    promises.push(sendSlack({ webhookUrl: channels.slack.webhookUrl, text }).catch((e)=>logger.error('Slack send failed', e)));
  }
  await Promise.all(promises);
}

async function evaluateAndSendAlerts() {
  const activeAlerts = await prisma.alert.findMany({ where: { isActive: true } });
  for (const alert of activeAlerts) {
    try {
      const cond = alert.conditions || {};
      const provider = String(cond.provider || '').toLowerCase(); // 'jenkins' | 'github' | '' (both)
      // For now we consider build events for success/failure/completed
      if (alert.type === 'BUILD_FAILURE' || alert.type === 'CUSTOM' || alert.type === 'PERFORMANCE_DEGRADATION') {
        if (!provider || provider === 'jenkins') await evaluateJenkins(alert);
        if (!provider || provider === 'github') await evaluateGitHub(alert);
      }
      // TODO: DEPLOYMENT_FAILURE, etc. can be added similarly
    } catch (e) {
      logger.error('Alert evaluation failed', { alertId: alert.id, err: e?.message });
    }
  }
}

let scheduled = null;
function startAlertScheduler() {
  if (scheduled) return;
  const spec = process.env.ALERT_CRON || '*/2 * * * *'; // every 2 minutes by default
  try {
    scheduled = cron.schedule(spec, () => {
      logger.info(`Running alert evaluator (spec: ${spec})`);
      evaluateAndSendAlerts().catch((e)=>logger.error('Alert evaluator run failed', e));
    }, { scheduled: true });
    logger.info(`Alert scheduler started with cron: ${spec}`);
  } catch (e) {
    logger.error('Failed to start alert scheduler', e);
  }
}

module.exports = {
  startAlertScheduler,
  evaluateAndSendAlerts,
  dispatchChannels,
};
