const express = require('express');
const router = express.Router();
const { prisma } = require('../database/connection');
const { logger } = require('../utils/logger');

// Helpers to resolve a single-tenant organization row
async function getOrCreateDefaultOrg() {
  // Try default slug
  let org = await prisma.organization.findFirst({ where: { slug: 'default' } });
  if (org) return org;
  // Try first existing org
  org = await prisma.organization.findFirst();
  if (org) return org;
  // Create default org if none exists
  return prisma.organization.create({ data: { name: 'Default Org', slug: 'default', settings: {} } });
}

// GET global dashboard settings
router.get('/dashboard', async (req, res) => {
  try {
    const org = await getOrCreateDefaultOrg();
    const settings = org.settings || {};
    const payload = {
      selectedIntegrations: settings.selectedIntegrations || [], // e.g. ["jenkins:<id>", "github:<id>"]
      updatedAt: org.updatedAt,
    };
    res.json({ success: true, data: payload });
  } catch (error) {
    logger.error('Get dashboard settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard settings' });
  }
});

// PUT global dashboard settings
router.put('/dashboard', async (req, res) => {
  try {
    const { selectedIntegrations } = req.body || {};
    if (!Array.isArray(selectedIntegrations)) {
      return res.status(400).json({ success: false, error: 'selectedIntegrations must be an array of strings' });
    }
    const org = await getOrCreateDefaultOrg();
    const newSettings = { ...(org.settings || {}), selectedIntegrations };
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { settings: newSettings },
    });
    res.json({ success: true, data: { selectedIntegrations: newSettings.selectedIntegrations, updatedAt: updated.updatedAt } });
  } catch (error) {
    logger.error('Update dashboard settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update dashboard settings' });
  }
});

module.exports = router;
