const express = require('express');
const { body, validationResult } = require('express-validator');
const { prisma } = require('../database/connection');
const { dispatchChannels, evaluateAndSendAlerts } = require('../services/alertService');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Resolve an organization ID for the current user. If the user has no organization,
// fallback to a single-tenant default organization (create it if needed).
async function resolveOrgId(req) {
  if (req.user && req.user.organizationId) return req.user.organizationId;
  // Try default slug first
  let org = await prisma.organization.findFirst({ where: { slug: 'default' } });
  if (!org) {
    // Try any existing org
    org = await prisma.organization.findFirst();
  }
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Default Org', slug: 'default', settings: {} } });
  }
  return org.id;
}

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: Get all alerts
 *     tags: [Alerts]
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
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, isActive } = req.query;
    const skip = (page - 1) * limit;

    const orgId = await resolveOrgId(req);
    const where = { organizationId: orgId };

    if (type) {
      where.type = type;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
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
              alertHistory: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.alert.count({ where })
    ]);

    res.json({
      success: true,
      data: alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /alerts:
 *   post:
 *     summary: Create a new alert
 *     tags: [Alerts]
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
 *               - type
 *               - conditions
 *               - channels
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [BUILD_FAILURE, DEPLOYMENT_FAILURE, PERFORMANCE_DEGRADATION, SECURITY_ISSUE, CUSTOM]
 *               conditions:
 *                 type: object
 *               channels:
 *                 type: object
 *     responses:
 *       201:
 *         description: Alert created successfully
 */
router.post('/', [
  body('name').notEmpty().trim(),
  body('type').isIn(['BUILD_FAILURE', 'DEPLOYMENT_FAILURE', 'PERFORMANCE_DEGRADATION', 'SECURITY_ISSUE', 'CUSTOM']),
  body('conditions').isObject(),
  body('channels').isObject()
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

    const { name, type, conditions, channels } = req.body;
    const orgId = await resolveOrgId(req);

    const alert = await prisma.alert.create({
      data: {
        name,
        type,
        conditions,
        channels,
        organizationId: orgId
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
      data: alert
    });
  } catch (error) {
    logger.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /alerts/{id}:
 *   get:
 *     summary: Get alert by ID
 *     tags: [Alerts]
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
 *         description: Alert retrieved successfully
 *       404:
 *         description: Alert not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = await resolveOrgId(req);

    const alert = await prisma.alert.findFirst({
      where: {
        id,
        organizationId: orgId
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

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Get alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /alerts/{id}:
 *   put:
 *     summary: Update alert
 *     tags: [Alerts]
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
 *               type:
 *                 type: string
 *               conditions:
 *                 type: object
 *               channels:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Alert updated successfully
 */
router.put('/:id', [
  body('name').optional().notEmpty().trim(),
  body('type').optional().isIn(['BUILD_FAILURE', 'DEPLOYMENT_FAILURE', 'PERFORMANCE_DEGRADATION', 'SECURITY_ISSUE', 'CUSTOM']),
  body('conditions').optional().isObject(),
  body('channels').optional().isObject(),
  body('isActive').optional().isBoolean()
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

    const orgId = await resolveOrgId(req);
    const alert = await prisma.alert.findFirst({
      where: {
        id,
        organizationId: orgId
      }
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    const updatedAlert = await prisma.alert.update({
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
      data: updatedAlert
    });
  } catch (error) {
    logger.error('Update alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /alerts/{id}:
 *   delete:
 *     summary: Delete alert
 *     tags: [Alerts]
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
 *         description: Alert deleted successfully
 */
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = await resolveOrgId(req);

    const alert = await prisma.alert.findFirst({
      where: {
        id,
        organizationId: orgId
      }
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    await prisma.alert.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    logger.error('Delete alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /alerts/history:
 *   get:
 *     summary: Get alert history
 *     tags: [Alerts]
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
 *         name: alertId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert history retrieved successfully
 */
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 10, alertId, status } = req.query;
    const skip = (page - 1) * limit;

    const orgId = await resolveOrgId(req);
    const where = {
      alert: {
        organizationId: orgId
      }
    };

    if (alertId) {
      where.alertId = alertId;
    }

    if (status) {
      where.status = status;
    }

    const [alertHistory, total] = await Promise.all([
      prisma.alertHistory.findMany({
        where,
        include: {
          alert: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
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
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { sentAt: 'desc' }
      }),
      prisma.alertHistory.count({ where })
    ]);

    res.json({
      success: true,
      data: alertHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get alert history error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @swagger
 * /alerts/test:
 *   post:
 *     summary: Send a test alert via provided channels
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channels:
 *                 type: object
 *                 description: Channels payload, e.g. { email: { to: "a@b.com" }, slack: { webhookUrl: "..." } }
 *               title:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test alert sent
 */
router.post('/test', authorize('ADMIN', 'USER'), async (req, res) => {
  try {
    const { channels = {}, title = 'Test Alert', text = 'This is a test alert from CI/CD Dashboard' } = req.body || {};
    const fakeAlert = { id: 'test', channels };
    await dispatchChannels(fakeAlert, { title, text });
    res.json({ success: true });
  } catch (error) {
    logger.error('Test alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to send test alert' });
  }
});

/**
 * @swagger
 * /alerts/trigger:
 *   post:
 *     summary: Manually trigger alert evaluation
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Evaluation triggered
 */
router.post('/trigger', authorize('ADMIN'), async (req, res) => {
  try {
    await evaluateAndSendAlerts();
    res.json({ success: true });
  } catch (error) {
    logger.error('Trigger alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger alerts' });
  }
});

module.exports = router;