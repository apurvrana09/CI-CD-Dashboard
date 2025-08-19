const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../database/connection');

// All GitHub config routes are protected
router.use(protect);

// List configs
router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.gitHubIntegration.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const safe = items.map(({ token, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
});

// Get single config
router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.gitHubIntegration.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    const { token, ...rest } = item;
    res.json({ success: true, data: rest });
  } catch (err) { next(err); }
});

// Create config
router.post('/', async (req, res, next) => {
  try {
    const { name, owner, repo, token, active } = req.body;
    if (!name || !owner || !repo || !token) {
      return res.status(400).json({ success: false, error: 'name, owner, repo, token are required' });
    }
    // Allow multiple active integrations; do not unset others
    const created = await prisma.gitHubIntegration.create({ data: { name, owner, repo, token, active: !!active } });
    const { token: t, ...rest } = created;
    res.status(201).json({ success: true, data: rest });
  } catch (err) { next(err); }
});

// Update
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, owner, repo, token, active } = req.body;
    // Allow multiple active integrations; do not unset others
    const updated = await prisma.gitHubIntegration.update({
      where: { id: req.params.id },
      data: { name, owner, repo, token, active },
    });
    const { token: t, ...rest } = updated;
    res.json({ success: true, data: rest });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    next(err);
  }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.gitHubIntegration.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    next(err);
  }
});

module.exports = router;
