const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../database/connection');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @swagger
 * /pipelines:
 *   get:
 *     summary: Get all pipelines
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Pipelines retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      organizationId: req.user.organizationId
    };

    if (status) {
      where.status = status;
    }

    const [pipelines, total] = await Promise.all([
      prisma.pipeline.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              builds: true,
              deployments: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.pipeline.count({ where })
    ]);

    res.json({
      success: true,
      data: pipelines,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get pipelines error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /pipelines:
 *   post:
 *     summary: Create a new pipeline
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - platform
 *               - repositoryUrl
 *             properties:
 *               name:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [GITHUB_ACTIONS, GITLAB_CI, JENKINS, AZURE_DEVOPS]
 *               repositoryUrl:
 *                 type: string
 *               repositoryId:
 *                 type: string
 *               config:
 *                 type: object
 *     responses:
 *       201:
 *         description: Pipeline created successfully
 */
router.post('/', [
  body('name').notEmpty().trim(),
  body('platform').isIn(['GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS', 'AZURE_DEVOPS']),
  body('repositoryUrl').isURL(),
  body('config').optional().isObject()
], authorize('ADMIN', 'USER'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errors.array()
      });
    }

    const { name, platform, repositoryUrl, repositoryId, config = {} } = req.body;

    const pipeline = await prisma.pipeline.create({
      data: {
        name,
        platform,
        repositoryUrl,
        repositoryId,
        config,
        organizationId: req.user.organizationId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: pipeline
    });
  } catch (error) {
    logger.error('Create pipeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /pipelines/{id}:
 *   get:
 *     summary: Get pipeline by ID
 *     tags: [Pipelines]
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
 *         description: Pipeline retrieved successfully
 *       404:
 *         description: Pipeline not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            builds: true,
            deployments: true
          }
        }
      }
    });

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }

    res.json({
      success: true,
      data: pipeline
    });
  } catch (error) {
    logger.error('Get pipeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /pipelines/{id}:
 *   put:
 *     summary: Update pipeline
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               platform:
 *                 type: string
 *               repositoryUrl:
 *                 type: string
 *               config:
 *                 type: object
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pipeline updated successfully
 */
router.put('/:id', [
  body('name').optional().notEmpty().trim(),
  body('platform').optional().isIn(['GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS', 'AZURE_DEVOPS']),
  body('repositoryUrl').optional().isURL(),
  body('config').optional().isObject(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'ERROR'])
], authorize('ADMIN', 'USER'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId
      }
    });

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }

    const updatedPipeline = await prisma.pipeline.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedPipeline
    });
  } catch (error) {
    logger.error('Update pipeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /pipelines/{id}:
 *   delete:
 *     summary: Delete pipeline
 *     tags: [Pipelines]
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
 *         description: Pipeline deleted successfully
 */
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId
      }
    });

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }

    await prisma.pipeline.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Pipeline deleted successfully'
    });
  } catch (error) {
    logger.error('Delete pipeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /pipelines/{id}/builds:
 *   get:
 *     summary: Get builds for a pipeline
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Builds retrieved successfully
 */
router.get('/:id/builds', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      pipelineId: id,
      pipeline: {
        organizationId: req.user.organizationId
      }
    };

    if (status) {
      where.status = status;
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
    logger.error('Get pipeline builds error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /pipelines/{id}/metrics:
 *   get:
 *     summary: Get pipeline metrics
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
router.get('/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId
      }
    });

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const builds = await prisma.build.findMany({
      where: {
        pipelineId: id,
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

    const totalBuilds = builds.length;
    const successfulBuilds = builds.filter(build => build.status === 'SUCCESS').length;
    const failedBuilds = builds.filter(build => build.status === 'FAILURE').length;
    const successRate = totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0;
    const averageDuration = builds.length > 0 
      ? builds.reduce((sum, build) => sum + (build.duration || 0), 0) / builds.length 
      : 0;

    // Daily build counts
    const dailyBuilds = {};
    builds.forEach(build => {
      const date = build.createdAt.toISOString().split('T')[0];
      dailyBuilds[date] = (dailyBuilds[date] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalBuilds,
        successfulBuilds,
        failedBuilds,
        successRate: Math.round(successRate * 100) / 100,
        averageDuration: Math.round(averageDuration),
        dailyBuilds
      }
    });
  } catch (error) {
    logger.error('Get pipeline metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router; 