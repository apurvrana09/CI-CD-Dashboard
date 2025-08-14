const express = require('express');
const { prisma } = require('../database/connection');
const { protect } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @swagger
 * /dashboard/data:
 *   get:
 *     summary: Get dashboard overview data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/data', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get pipelines
    const pipelines = await prisma.pipeline.findMany({
      where: {
        organizationId: req.user.organizationId
      },
      include: {
        _count: {
          select: {
            builds: true,
            deployments: true
          }
        }
      }
    });

    // Get recent builds
    const recentBuilds = await prisma.build.findMany({
      where: {
        pipeline: {
          organizationId: req.user.organizationId
        },
        createdAt: {
          gte: startDate
        }
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
            platform: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get recent deployments
    const recentDeployments = await prisma.deployment.findMany({
      where: {
        pipeline: {
          organizationId: req.user.organizationId
        },
        createdAt: {
          gte: startDate
        }
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true
          }
        },
        build: {
          select: {
            id: true,
            externalId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get build metrics
    const builds = await prisma.build.findMany({
      where: {
        pipeline: {
          organizationId: req.user.organizationId
        },
        createdAt: {
          gte: startDate
        }
      },
      select: {
        status: true,
        duration: true,
        createdAt: true
      }
    });

    // Get deployment metrics
    const deployments = await prisma.deployment.findMany({
      where: {
        pipeline: {
          organizationId: req.user.organizationId
        },
        createdAt: {
          gte: startDate
        }
      },
      select: {
        status: true,
        duration: true,
        createdAt: true
      }
    });

    // Calculate metrics
    const totalBuilds = builds.length;
    const successfulBuilds = builds.filter(build => build.status === 'SUCCESS').length;
    const failedBuilds = builds.filter(build => build.status === 'FAILURE').length;
    const runningBuilds = builds.filter(build => build.status === 'RUNNING').length;
    const buildSuccessRate = totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0;
    const averageBuildDuration = builds.length > 0 
      ? builds.reduce((sum, build) => sum + (build.duration || 0), 0) / builds.length 
      : 0;

    const totalDeployments = deployments.length;
    const successfulDeployments = deployments.filter(dep => dep.status === 'SUCCESS').length;
    const failedDeployments = deployments.filter(dep => dep.status === 'FAILURE').length;
    const deploymentSuccessRate = totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;
    const averageDeploymentDuration = deployments.length > 0 
      ? deployments.reduce((sum, dep) => sum + (dep.duration || 0), 0) / deployments.length 
      : 0;

    // Daily trends
    const dailyBuilds = {};
    const dailyDeployments = {};
    
    builds.forEach(build => {
      const date = build.createdAt.toISOString().split('T')[0];
      if (!dailyBuilds[date]) {
        dailyBuilds[date] = { total: 0, success: 0, failure: 0 };
      }
      dailyBuilds[date].total++;
      if (build.status === 'SUCCESS') dailyBuilds[date].success++;
      if (build.status === 'FAILURE') dailyBuilds[date].failure++;
    });

    deployments.forEach(dep => {
      const date = dep.createdAt.toISOString().split('T')[0];
      if (!dailyDeployments[date]) {
        dailyDeployments[date] = { total: 0, success: 0, failure: 0 };
      }
      dailyDeployments[date].total++;
      if (dep.status === 'SUCCESS') dailyDeployments[date].success++;
      if (dep.status === 'FAILURE') dailyDeployments[date].failure++;
    });

    // Pipeline status summary
    const pipelineStatus = pipelines.reduce((acc, pipeline) => {
      acc.total++;
      if (pipeline.status === 'ACTIVE') acc.active++;
      if (pipeline.status === 'INACTIVE') acc.inactive++;
      if (pipeline.status === 'ERROR') acc.error++;
      return acc;
    }, { total: 0, active: 0, inactive: 0, error: 0 });

    res.json({
      success: true,
      data: {
        overview: {
          totalPipelines: pipelines.length,
          totalBuilds,
          totalDeployments,
          runningBuilds,
          buildSuccessRate: Math.round(buildSuccessRate * 100) / 100,
          deploymentSuccessRate: Math.round(deploymentSuccessRate * 100) / 100,
          averageBuildDuration: Math.round(averageBuildDuration),
          averageDeploymentDuration: Math.round(averageDeploymentDuration)
        },
        pipelineStatus,
        recentBuilds,
        recentDeployments,
        trends: {
          dailyBuilds,
          dailyDeployments
        }
      }
    });
  } catch (error) {
    logger.error('Get dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /dashboard/widgets:
 *   get:
 *     summary: Get dashboard widgets
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Widgets retrieved successfully
 */
router.get('/widgets', async (req, res) => {
  try {
    // This would typically fetch user-specific widget configurations
    // For now, return default widgets
    const widgets = [
      {
        id: 'pipeline-status',
        type: 'pipeline-status',
        title: 'Pipeline Status',
        position: { x: 0, y: 0, w: 4, h: 2 },
        config: {}
      },
      {
        id: 'build-metrics',
        type: 'build-metrics',
        title: 'Build Metrics',
        position: { x: 4, y: 0, w: 4, h: 2 },
        config: {}
      },
      {
        id: 'deployment-frequency',
        type: 'deployment-frequency',
        title: 'Deployment Frequency',
        position: { x: 8, y: 0, w: 4, h: 2 },
        config: {}
      },
      {
        id: 'recent-builds',
        type: 'recent-builds',
        title: 'Recent Builds',
        position: { x: 0, y: 2, w: 6, h: 3 },
        config: {}
      },
      {
        id: 'performance-trends',
        type: 'performance-trends',
        title: 'Performance Trends',
        position: { x: 6, y: 2, w: 6, h: 3 },
        config: {}
      }
    ];

    res.json({
      success: true,
      data: widgets
    });
  } catch (error) {
    logger.error('Get widgets error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router; 