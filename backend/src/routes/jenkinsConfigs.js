const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../database/connection');

// All Jenkins config routes are protected
router.use(protect);

// List configs
router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.jenkinsIntegration.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const safe = items.map(({ password, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch (err) {
    next(err);
  }
});

// Get single config
router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.jenkinsIntegration.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    const { password, ...rest } = item;
    res.json({ success: true, data: rest });
  } catch (err) {
    next(err);
  }
});

// Create config
router.post('/', async (req, res, next) => {
  try {
    const { name, baseUrl, username, password, active } = req.body;
    if (!name || !baseUrl) return res.status(400).json({ success: false, error: 'name and baseUrl are required' });

    // Allow multiple active integrations; do not unset others

    const created = await prisma.jenkinsIntegration.create({
      data: { name, baseUrl, username: username || null, password: password || null, active: !!active },
    });
    const { password: pw, ...rest } = created;
    res.status(201).json({ success: true, data: rest });
  } catch (err) {
    next(err);
  }
});

// Update/activate config
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, baseUrl, username, password, active } = req.body;

    // Allow multiple active integrations; do not unset others

    const updated = await prisma.jenkinsIntegration.update({
      where: { id: req.params.id },
      data: {
        name,
        baseUrl,
        username,
        password,
        active,
      },
    });
    const { password: pw, ...rest } = updated;
    res.json({ success: true, data: rest });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    next(err);
  }
});

// Delete config
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.jenkinsIntegration.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    next(err);
  }
});

module.exports = router;
