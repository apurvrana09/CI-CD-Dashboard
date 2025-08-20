#!/usr/bin/env node
/*
Usage:
  node scripts/send_test_email.js recipient@example.com "Subject" "Body text"
Reads SMTP_* envs and sends an email via Nodemailer.
*/
const nodemailer = require('nodemailer');

async function main() {
  const [,, to, subjectArg, textArg] = process.argv;
  if (!to) {
    console.error('Usage: node scripts/send_test_email.js recipient@example.com "Subject" "Body"');
    process.exit(1);
  }
  const subject = subjectArg || 'CI/CD Test Alert';
  const text = textArg || 'Hello from CI/CD Dashboard';

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || (user ? user : 'alerts@cicd-dashboard.local');

  if (!host) {
    console.error('SMTP_HOST is not set');
    process.exit(2);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: (user && pass) ? { user, pass } : undefined,
  });

  try {
    const info = await transporter.sendMail({ from, to, subject, text });
    console.log('OK sent:', info.messageId || info);
    process.exit(0);
  } catch (e) {
    console.error('Send failed:', e && e.message ? e.message : e);
    process.exit(3);
  }
}

main();
