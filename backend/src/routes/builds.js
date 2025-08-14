const express = require('express');
const { prisma } = require('../database/connection');
const { protect } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @swagger
 * /builds:
 *   get:
 *     summary: Get all builds
 *     tags: [Builds]
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
 *         name: pipelineId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Builds retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, pipelineId } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      pipeline: {
        organizationId: req.user.organizationId
      }
    };

    if (status) {
      where.status = status;
    }

    if (pipelineId) {
      where.pipelineId = pipelineId;
    }

    const [builds, total] = await Promise.all([
      prisma.build.findMany({
        where,
        include: {
          pipeline: {
            select: {
              id: true,
              name: true,
              platform: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.build.count({ where })
    ]);

    res.json({
      success: true,
      data: builds,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get builds error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /builds/{id}:
 *   get:
 *     summary: Get build by ID
 *     tags: [Builds]
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
 *         description: Build retrieved successfully
 *       404:
 *         description: Build not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const build = await prisma.build.findFirst({
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
        deployments: {
          select: {
            id: true,
            environment: true,
            status: true,
            deployedAt: true
          }
        }
      }
    });

    if (!build) {
      return res.status(404).json({
        success: false,
        error: 'Build not found'
      });
    }

    res.json({
      success: true,
      data: build
    });
  } catch (error) {
    logger.error('Get build error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /builds/metrics:
 *   get:
 *     summary: Get build metrics
 *     tags: [Builds]
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
        createdAt: true,
        pipeline: {
          select: {
            name: true
          }
        }
      }
    });

    const totalBuilds = builds.length;
    const successfulBuilds = builds.filter(build => build.status === 'SUCCESS').length;
    const failedBuilds = builds.filter(build => build.status === 'FAILURE').length;
    const runningBuilds = builds.filter(build => build.status === 'RUNNING').length;
    const successRate = totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0;
    const averageDuration = builds.length > 0 
      ? builds.reduce((sum, build) => sum + (build.duration || 0), 0) / builds.length 
      : 0;

    // Status distribution
    const statusDistribution = builds.reduce((acc, build) => {
      acc[build.status] = (acc[build.status] || 0) + 1;
      return acc;
    }, {});

    // Daily build counts
    const dailyBuilds = {};
    builds.forEach(build => {
      const date = build.createdAt.toISOString().split('T')[0];
      dailyBuilds[date] = (dailyBuilds[date] || 0) + 1;
    });

    // Pipeline performance
    const pipelineStats = builds.reduce((acc, build) => {
      const pipelineName = build.pipeline.name;
      if (!acc[pipelineName]) {
        acc[pipelineName] = { total: 0, success: 0, failed: 0 };
      }
      acc[pipelineName].total++;
      if (build.status === 'SUCCESS') acc[pipelineName].success++;
      if (build.status === 'FAILURE') acc[pipelineName].failed++;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalBuilds,
        successfulBuilds,
        failedBuilds,
        runningBuilds,
        successRate: Math.round(successRate * 100) / 100,
        averageDuration: Math.round(averageDuration),
        statusDistribution,
        dailyBuilds,
        pipelineStats
      }
    });
  } catch (error) {
    logger.error('Get build metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router; 