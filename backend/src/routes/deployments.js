const express = require('express');
const { prisma } = require('../database/connection');
const { protect } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @swagger
 * /deployments:
 *   get:
 *     summary: Get all deployments
 *     tags: [Deployments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: environment
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deployments retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, environment } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      pipeline: {
        organizationId: req.user.organizationId
      }
    };

    if (status) {
      where.status = status;
    }

    if (environment) {
      where.environment = environment;
    }

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        include: {
          pipeline: {
            select: {
              id: true,
              name: true,
              platform: true
            }
          },
          build: {
            select: {
              id: true,
              externalId: true,
              status: true
            }
          },
          deployedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.deployment.count({ where })
    ]);

    res.json({
      success: true,
      data: deployments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get deployments error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /deployments/{id}:
 *   get:
 *     summary: Get deployment by ID
 *     tags: [Deployments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deployment retrieved successfully
 *       404:
 *         description: Deployment not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await prisma.deployment.findFirst({
      where: {
        id,
        pipeline: {
          organizationId: req.user.organizationId
        }
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
            platform: true
          }
        },
        build: {
          select: {
            id: true,
            externalId: true,
            status: true,
            commitHash: true,
            commitMessage: true
          }
        },
        deployedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    res.json({
      success: true,
      data: deployment
    });
  } catch (error) {
    logger.error('Get deployment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /deployments/metrics:
 *   get:
 *     summary: Get deployment metrics
 *     tags: [Deployments]
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
 *         description: Metrics retrieved successfully
 */
router.get('/metrics', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

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
        environment: true,
        duration: true,
        createdAt: true,
        pipeline: {
          select: {
            name: true
          }
        }
      }
    });

    const totalDeployments = deployments.length;
    const successfulDeployments = deployments.filter(dep => dep.status === 'SUCCESS').length;
    const failedDeployments = deployments.filter(dep => dep.status === 'FAILURE').length;
    const successRate = totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;
    const averageDuration = deployments.length > 0 
      ? deployments.reduce((sum, dep) => sum + (dep.duration || 0), 0) / deployments.length 
      : 0;

    // Status distribution
    const statusDistribution = deployments.reduce((acc, dep) => {
      acc[dep.status] = (acc[dep.status] || 0) + 1;
      return acc;
    }, {});

    // Environment distribution
    const environmentDistribution = deployments.reduce((acc, dep) => {
      acc[dep.environment] = (acc[dep.environment] || 0) + 1;
      return acc;
    }, {});

    // Daily deployment counts
    const dailyDeployments = {};
    deployments.forEach(dep => {
      const date = dep.createdAt.toISOString().split('T')[0];
      dailyDeployments[date] = (dailyDeployments[date] || 0) + 1;
    });

    // Pipeline deployment performance
    const pipelineStats = deployments.reduce((acc, dep) => {
      const pipelineName = dep.pipeline.name;
      if (!acc[pipelineName]) {
        acc[pipelineName] = { total: 0, success: 0, failed: 0 };
      }
      acc[pipelineName].total++;
      if (dep.status === 'SUCCESS') acc[pipelineName].success++;
      if (dep.status === 'FAILURE') acc[pipelineName].failed++;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        successRate: Math.round(successRate * 100) / 100,
        averageDuration: Math.round(averageDuration),
        statusDistribution,
        environmentDistribution,
        dailyDeployments,
        pipelineStats
      }
    });
  } catch (error) {
    logger.error('Get deployment metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router; 