const express = require('express');
const router = express.Router();
const { prisma } = require('../database/connection');
const { logger } = require('../utils/logger');

// Helper to resolve a single-tenant organization row without auto-creating
async function getDefaultOrg() {
  // Prefer default slug if it exists
  let org = await prisma.organization.findFirst({ where: { slug: 'default' } });
  if (org) return org;
  // Fallback to any existing org
  return prisma.organization.findFirst();
}

// GET global dashboard settings
router.get('/dashboard', async (req, res) => {
  try {
    const org = await getDefaultOrg();
    // Do not auto-create org on GET; return empty defaults if none exists
    const settings = org?.settings || {};
    const payload = {
      selectedIntegrations: settings.selectedIntegrations || [], // e.g. ["jenkins:<id>", "github:<id>"]
      updatedAt: org?.updatedAt || null,
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
    let org = await getDefaultOrg();
    // Create org only on explicit update (user action), not on reads
    if (!org) {
      org = await prisma.organization.create({ data: { name: 'Default Org', slug: 'default', settings: {} } });
    }
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
