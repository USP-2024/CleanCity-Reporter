const fs = require('fs');
const Simulation = require('../models/Simulation');
const { notify, notifyAdmins } = require('../utils/notify');

const POPULATE = [{ path: 'worker', select: 'name' }, { path: 'reviewedBy', select: 'name' }];
const removeUploaded = (file) => {
  if (file) fs.unlink(file.path, () => {});
};
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

// POST /api/simulations   (worker; multipart: photo + itemsCleaned, totalItems, durationSec, scenario)
exports.create = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'The simulation photo is missing' });
  try {
    const totalItems = Math.round(num(req.body.totalItems));
    const itemsCleaned = Math.min(Math.round(num(req.body.itemsCleaned)), totalItems);
    const sim = await Simulation.create({
      worker: req.user._id,
      scenario: (req.body.scenario || '').trim() || undefined,
      photo: `/uploads/${req.file.filename}`,
      itemsCleaned,
      totalItems,
      durationSec: Math.round(num(req.body.durationSec)),
    });
    await notifyAdmins(
      `Simulation submitted by ${req.user.name}: ${itemsCleaned}/${totalItems} items cleaned`,
      null
    );
    res.status(201).json({ simulation: await Simulation.findById(sim._id).populate(POPULATE) });
  } catch (err) {
    removeUploaded(req.file);
    throw err;
  }
};

// GET /api/simulations?status=pending   (admin sees all, a worker sees only their own)
exports.list = async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.user.role === 'worker') q.worker = req.user._id;
  else if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not allowed' });

  const simulations = await Simulation.find(q).sort({ createdAt: -1 }).limit(200).populate(POPULATE);
  res.json({ simulations });
};

// GET /api/simulations/:id
exports.getOne = async (req, res) => {
  const sim = await Simulation.findById(req.params.id).populate(POPULATE);
  if (!sim) return res.status(404).json({ message: 'Simulation not found' });
  const isOwner = String(sim.worker._id) === String(req.user._id);
  if (req.user.role !== 'admin' && !isOwner) return res.status(403).json({ message: 'Not allowed' });
  res.json({ simulation: sim });
};

// PATCH /api/simulations/:id/review   { approve: true|false, note }   (admin)
exports.review = async (req, res) => {
  const sim = await Simulation.findById(req.params.id);
  if (!sim) return res.status(404).json({ message: 'Simulation not found' });
  if (sim.status !== 'pending') {
    return res.status(400).json({ message: 'This simulation was already reviewed' });
  }
  const approve = req.body.approve === true || req.body.approve === 'true';
  const note = (req.body.note || '').trim();

  sim.status = approve ? 'approved' : 'rejected';
  sim.reviewNote = note || (approve ? 'Well done!' : 'Please try again');
  sim.reviewedBy = req.user._id;
  sim.reviewedAt = new Date();
  await sim.save();

  await notify(
    sim.worker,
    approve
      ? `Your simulation was approved. ${sim.reviewNote}`
      : `Your simulation was rejected: ${sim.reviewNote}`,
    null
  );
  res.json({ simulation: await Simulation.findById(sim._id).populate(POPULATE) });
};
