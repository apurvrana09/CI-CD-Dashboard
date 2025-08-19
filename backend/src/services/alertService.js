const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { prisma } = require('../database/connection');
const { logger } = require('../utils/logger');
const { getJobs, getJobBuilds, getLastBuild } = require('./jenkinsService');
const { listWorkflowRuns } = require('./githubService');

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

async function evaluateBuildFailuresForJenkins(alert) {
  // For each active Jenkins integration, find latest failed builds and send
  const jenkinsList = await prisma.jenkinsIntegration.findMany({ where: { active: true } });
  for (const cfg of jenkinsList) {
    try {
      const override = { baseURL: cfg.baseUrl, username: cfg.username || undefined, password: cfg.password || undefined };
      const jobs = await getJobs(override);
      for (const j of jobs) {
        let last;
        try { last = await getLastBuild(j.name, override); } catch (_) { last = null; }
        if (!last) continue;
        if (String(last.result).toUpperCase() !== 'FAILURE') continue;
        const message = `[Jenkins] ${j.name} #${last.number} failed`;
        if (await alreadySentRecently(alert.id, message, 180)) continue;
        await dispatchChannels(alert, {
          title: 'Build Failure (Jenkins)',
          text: `${message}\nDuration: ${last.duration}ms\nWhen: ${new Date(last.timestamp).toLocaleString()}`,
          link: last.url || undefined,
        });
        await recordHistory({ alertId: alert.id, status: 'SENT', message });
      }
    } catch (e) {
      logger.warn('Jenkins alert evaluation failed', { integration: cfg.id, err: e?.message });
    }
  }
}

async function evaluateBuildFailuresForGitHub(alert) {
  const ghList = await prisma.githubIntegration.findMany({ where: { active: true } });
  for (const cfg of ghList) {
    try {
      const override = { owner: cfg.owner, repo: cfg.repo, token: cfg.token };
      const runs = await listWorkflowRuns({ per_page: 30 }, override);
      const failed = (runs || []).filter((r) => (r.status === 'completed') && (String(r.conclusion).toLowerCase() === 'failure'));
      for (const r of failed.slice(0, 3)) {
        const message = `[GitHub] ${cfg.owner}/${cfg.repo} run #${r.run_number} failed`;
        if (await alreadySentRecently(alert.id, message, 180)) continue;
        await dispatchChannels(alert, {
          title: 'Build Failure (GitHub)',
          text: `${message}\nBranch: ${r.head_branch}\nWhen: ${new Date(r.run_started_at || r.created_at).toLocaleString()}`,
          link: r.html_url || undefined,
        });
        await recordHistory({ alertId: alert.id, status: 'SENT', message });
      }
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
    const to = channels.email.to;
    const text = `${payload.text}${payload.link ? `\nLink: ${payload.link}` : ''}`;
    const html = `<p>${payload.text.replace(/\n/g, '<br/>')}</p>${payload.link ? `<p><a href="${payload.link}">Open</a></p>` : ''}`;
    promises.push(sendEmail({ to, subject, text, html }).catch((e)=>logger.error('Email send failed', e)));
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
      switch (alert.type) {
        case 'BUILD_FAILURE':
          await evaluateBuildFailuresForJenkins(alert);
          await evaluateBuildFailuresForGitHub(alert);
          break;
        // Future: add DEPLOYMENT_FAILURE, PERFORMANCE_DEGRADATION, etc.
        default:
          break;
      }
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
