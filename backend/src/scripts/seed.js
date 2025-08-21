const bcrypt = require('bcryptjs');
const { prisma } = require('../database/connection');
const { logger } = require('../utils/logger');

(async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      logger.info('Seed: ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping user seeding.');
      console.log('Seed: Missing ADMIN_EMAIL or ADMIN_PASSWORD; skipping.');
      process.exit(0);
    }

    // Ensure default org exists
    console.log('Seed: Ensuring default organization...');
    let org = await prisma.organization.findFirst({ where: { slug: 'default' } });
    if (!org) {
      org = await prisma.organization.create({ data: { name: 'Default Org', slug: 'default', settings: {} } });
      logger.info(`Seed: Created default organization with id=${org.id}`);
      console.log(`Seed: Created default organization id=${org.id}`);
    }

    // Ensure admin exists via upsert to be fully idempotent
    console.log(`Seed: Ensuring admin user ${adminEmail} via upsert...`);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);
    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
        isActive: true,
        role: 'ADMIN',
        organizationId: org.id,
      },
      create: {
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        organizationId: org.id,
      },
      select: { id: true, email: true }
    });

    logger.info(`Seed: Ensured admin user ${user.email} (id=${user.id}).`);
    console.log(`Seed: Ensured admin user ${user.email} (id=${user.id}).`);

    // Optionally seed sample integrations
    if ((process.env.SEED_SAMPLES || 'true') !== 'false') {
      console.log('Seed: Seeding sample JenkinsIntegration (inactive)...');
      await prisma.jenkinsIntegration.upsert({
        where: { id: 'seed-sample-jenkins' },
        update: {},
        create: {
          id: 'seed-sample-jenkins',
          name: 'Sample Jenkins',
          baseUrl: 'http://jenkins.local:8080',
          active: false,
          organizationId: org.id,
        },
      });

      console.log('Seed: Seeding sample GitHubIntegration (inactive)...');
      await prisma.gitHubIntegration.upsert({
        where: { owner_repo: { owner: 'sample', repo: 'demo-repo' } },
        update: {},
        create: {
          name: 'Sample GitHub',
          owner: 'sample',
          repo: 'demo-repo',
          token: 'ghp_xxx',
          active: false,
          organizationId: org.id,
        },
      });

      console.log('Seed: Seeding sample Pipeline...');
      const pipeline = await prisma.pipeline.upsert({
        where: { id: 'seed-sample-pipeline' },
        update: {},
        create: {
          id: 'seed-sample-pipeline',
          organizationId: org.id,
          name: 'Sample Pipeline',
          platform: 'GITHUB_ACTIONS',
          repositoryUrl: 'https://github.com/sample/demo-repo',
          repositoryId: '123456',
          status: 'ACTIVE',
          config: { workflow: 'ci.yml' },
        },
      });

      console.log('Seed: Seeding sample Build...');
      const build = await prisma.build.upsert({
        where: { pipelineId_externalId: { pipelineId: pipeline.id, externalId: 'build-1' } },
        update: {},
        create: {
          pipelineId: pipeline.id,
          externalId: 'build-1',
          status: 'SUCCESS',
          triggeredBy: user.email,
          branch: 'main',
          commitHash: 'abcdef1234567890',
          commitMessage: 'Initial build',
          startedAt: new Date(Date.now() - 10 * 60 * 1000),
          completedAt: new Date(Date.now() - 8 * 60 * 1000),
          duration: 120,
          logsUrl: 'http://ci.local/logs/build-1',
          artifacts: [],
        },
      });

      console.log('Seed: Seeding sample Deployment...');
      await prisma.deployment.upsert({
        where: { id: 'seed-sample-deploy' },
        update: {},
        create: {
          id: 'seed-sample-deploy',
          pipelineId: pipeline.id,
          buildId: build.id,
          environment: 'staging',
          status: 'SUCCESS',
          deployedBy: user.id,
          deployedAt: new Date(Date.now() - 7 * 60 * 1000),
          completedAt: new Date(Date.now() - 6 * 60 * 1000),
          duration: 60,
          metadata: { version: '1.0.0' },
        },
      });

      console.log('Seed: Seeding sample Alert & AlertHistory...');
      const alert = await prisma.alert.upsert({
        where: { id: 'seed-build-failure-alert' },
        update: {},
        create: {
          id: 'seed-build-failure-alert',
          organizationId: org.id,
          name: 'Build Failure Alert',
          type: 'BUILD_FAILURE',
          conditions: { status: 'FAILURE' },
          channels: { email: [user.email] },
          isActive: true,
        },
      });

      await prisma.alertHistory.upsert({
        where: { id: 'seed-alert-history-1' },
        update: {},
        create: {
          id: 'seed-alert-history-1',
          alertId: alert.id,
          pipelineId: pipeline.id,
          buildId: build.id,
          userId: user.id,
          status: 'SENT',
          message: 'Sample alert: build succeeded previously',
          sentAt: new Date(Date.now() - 5 * 60 * 1000),
        },
      });
    }
    process.exit(0);
  } catch (err) {
    logger.error('Seed error:', err);
    console.error('Seed error:', err);
    process.exit(1);
  }
})();
