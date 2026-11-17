const fs = require('fs');
const path = require('path');
const Report = require('../models/Report');
const User = require('../models/User');
const { distanceMeters } = require('../utils/geo');
const { notify, notifyAdmins } = require('../utils/notify');
const cfg = require('../config');

const POPULATE = [
  { path: 'reportedBy', select: 'name' },
  { path: 'assignedTo', select: 'name' },
];

const photoUrl = (file) => `/uploads/${file.filename}`;
const removeUploaded = (file) => {
  if (file) fs.unlink(file.path, () => {});
};
const removeByUrl = (url) => {
  // Only delete files uploaded through the app (not the bundled sample images)
  if (url && url.startsWith('/uploads/') && !url.startsWith('/uploads/sample/')) {
    fs.unlink(path.join(__dirname, '..', url), () => {});
  }
};
const addHistory = (report, status, note, user) =>
  report.statusHistory.push({ status, note: note || '', byName: user.name, at: new Date() });
const sameId = (a, b) => String(a && a._id ? a._id : a) === String(b && b._id ? b._id : b);
const load = (id) => Report.findById(id).populate(POPULATE);

// ---------------------------------------------------------------- CITIZEN

// POST /api/reports   (multipart: photo + fields)
exports.create = async (req, res) => {
  try {
    const { title, description, category, ward, address, lat, lng } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Please add a photo of the problem' });

    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (!title || !title.trim() || Number.isNaN(la) || Number.isNaN(ln)) {
      removeUploaded(req.file);
      return res.status(400).json({ message: 'A title and a GPS location are required' });
    }

    const report = await Report.create({
      title,
      description: description || '',
      category: category || 'other',
      ward: ward || 'Ward A',
      address: address || '',
      location: { type: 'Point', coordinates: [ln, la] },
      beforePhoto: photoUrl(req.file),
      reportedBy: req.user._id,
      statusHistory: [{ status: 'reported', note: 'Report submitted', byName: req.user.name }],
    });

    await notifyAdmins(`New ${report.category} report: ${report.title}`, report._id);
    res.status(201).json({ report: await load(report._id) });
  } catch (err) {
    removeUploaded(req.file);
    throw err;
  }
};

// GET /api/reports/nearby?lat=&lng=&category=   (duplicate detection)
exports.nearby = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }
  const query = {
    status: { $ne: 'resolved' },
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: cfg.DUPLICATE_RADIUS_METERS,
      },
    },
  };
  if (req.query.category) query.category = req.query.category;
  const reports = await Report.find(query).limit(5).populate(POPULATE);
  res.json({ reports });
};

// GET /api/reports?status=&category=&ward=&mine=true&assigned=true
exports.list = async (req, res) => {
  const { status, category, ward, mine, assigned } = req.query;
  const q = {};
  if (status) q.status = status;
  if (category) q.category = category;
  if (ward) q.ward = ward;
  if (mine === 'true') q.reportedBy = req.user._id;
  if (assigned === 'true') q.assignedTo = req.user._id;
  // Workers can only ever see the jobs assigned to them
  if (req.user.role === 'worker') q.assignedTo = req.user._id;

  const reports = await Report.find(q).sort({ createdAt: -1 }).limit(300).populate(POPULATE);
  res.json({ reports });
};

// GET /api/reports/:id
exports.getOne = async (req, res) => {
  const report = await load(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  res.json({ report });
};

// PUT /api/reports/:id   (owner while still "reported", or admin)
exports.update = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });

  const isOwner = sameId(report.reportedBy, req.user._id);
  if (req.user.role !== 'admin' && !(isOwner && report.status === 'reported')) {
    return res.status(403).json({ message: 'You can only edit your own report before it is assigned' });
  }
  ['title', 'description', 'category', 'ward', 'address'].forEach((f) => {
    if (req.body[f] !== undefined) report[f] = req.body[f];
  });
  await report.save();
  res.json({ report: await load(report._id) });
};

// DELETE /api/reports/:id   (owner while still "reported", or admin)
exports.remove = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });

  const isOwner = sameId(report.reportedBy, req.user._id);
  if (req.user.role !== 'admin' && !(isOwner && report.status === 'reported')) {
    return res.status(403).json({ message: 'You can only delete your own report before it is assigned' });
  }
  removeByUrl(report.beforePhoto);
  removeByUrl(report.afterPhoto);
  await report.deleteOne();
  res.json({ message: 'Report deleted' });
};

// POST /api/reports/:id/upvote   ("Me too")
exports.upvote = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  if (sameId(report.reportedBy, req.user._id)) {
    return res.status(400).json({ message: 'You reported this issue yourself' });
  }
  if (report.status === 'resolved') {
    return res.status(400).json({ message: 'This issue is already resolved' });
  }
  if (report.upvotes.some((id) => sameId(id, req.user._id))) {
    return res.status(400).json({ message: 'You already supported this report' });
  }
  report.upvotes.push(req.user._id);
  await report.save();
  await notify(report.reportedBy, `${req.user.name} also reported: ${report.title}`, report._id);
  res.json({ report: await load(report._id) });
};

// POST /api/reports/:id/confirm   (reporter says "Yes, it's cleaned")
exports.confirm = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  if (!sameId(report.reportedBy, req.user._id)) {
    return res.status(403).json({ message: 'Only the person who reported it can confirm' });
  }
  if (report.status !== 'resolved') {
    return res.status(400).json({ message: 'This report is not resolved yet' });
  }
  if (report.citizenConfirmed) return res.status(400).json({ message: 'Already confirmed' });

  report.citizenConfirmed = true;
  await report.save();
  await User.updateOne({ _id: req.user._id }, { $inc: { points: 5 } });
  await notify(req.user._id, 'Thanks for confirming! You earned 5 points.', report._id);
  res.json({ report: await load(report._id) });
};

// ------------------------------------------------------------------ ADMIN

// PATCH /api/reports/:id/assign   { workerId }
exports.assign = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  if (!['reported', 'assigned'].includes(report.status)) {
    return res.status(400).json({ message: 'Work has already started on this report' });
  }
  const worker = await User.findOne({ _id: req.body.workerId, role: 'worker' });
  if (!worker) return res.status(400).json({ message: 'Please choose a valid worker' });

  report.assignedTo = worker._id;
  report.status = 'assigned';
  addHistory(report, 'assigned', `Assigned to ${worker.name}`, req.user);
  await report.save();

  await notify(worker._id, `New task assigned: ${report.title}`, report._id);
  await notify(report.reportedBy, `Your report "${report.title}" was assigned to ${worker.name}`, report._id);
  res.json({ report: await load(report._id) });
};

// PATCH /api/reports/:id/review   { approve: true|false, note }
exports.review = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  if (report.status !== 'pending_review') {
    return res.status(400).json({ message: 'This report is not waiting for review' });
  }
  const approve = req.body.approve === true || req.body.approve === 'true';

  if (approve) {
    report.status = 'resolved';
    report.resolvedAt = new Date();
    report.rejectionNote = '';
    addHistory(report, 'resolved', 'After photo approved', req.user);
    await report.save();

    await User.updateOne({ _id: report.reportedBy }, { $inc: { points: 10 } });
    if (report.assignedTo) await User.updateOne({ _id: report.assignedTo }, { $inc: { points: 10 } });
    await notify(report.reportedBy, `Your report "${report.title}" is resolved! You earned 10 points.`, report._id);
    if (report.assignedTo) await notify(report.assignedTo, `Great work! "${report.title}" was approved.`, report._id);
  } else {
    const note = (req.body.note || '').trim() || 'The after photo was not accepted';
    report.status = 'in_progress';
    report.rejectionNote = note;
    addHistory(report, 'in_progress', `After photo rejected: ${note}`, req.user);
    await report.save();
    if (report.assignedTo) {
      await notify(report.assignedTo, `After photo rejected for "${report.title}": ${note}`, report._id);
    }
  }
  res.json({ report: await load(report._id) });
};

// ----------------------------------------------------------------- WORKER

// PATCH /api/reports/:id/status   { status: 'in_progress' }
exports.setStatus = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  if (!sameId(report.assignedTo, req.user._id)) {
    return res.status(403).json({ message: 'This task is not assigned to you' });
  }
  if (req.body.status !== 'in_progress' || report.status !== 'assigned') {
    return res.status(400).json({ message: 'You can only start a task that is assigned to you' });
  }
  report.status = 'in_progress';
  addHistory(report, 'in_progress', 'Work started', req.user);
  await report.save();
  await notify(report.reportedBy, `Work has started on "${report.title}"`, report._id);
  res.json({ report: await load(report._id) });
};

// POST /api/reports/:id/after-photo   (multipart: photo, lat, lng)
// The photo is accepted ONLY if the worker is within PHOTO_RADIUS_METERS of the report.
exports.afterPhoto = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) {
    removeUploaded(req.file);
    return res.status(404).json({ message: 'Report not found' });
  }
  if (!sameId(report.assignedTo, req.user._id)) {
    removeUploaded(req.file);
    return res.status(403).json({ message: 'This task is not assigned to you' });
  }
  if (!['assigned', 'in_progress'].includes(report.status)) {
    removeUploaded(req.file);
    return res.status(400).json({ message: 'An after photo cannot be uploaded at this stage' });
  }
  if (!req.file) return res.status(400).json({ message: 'Please take the after photo' });

  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    removeUploaded(req.file);
    return res.status(400).json({ message: 'Your GPS location is required' });
  }

  const [rLng, rLat] = report.location.coordinates;
  const distance = distanceMeters(lat, lng, rLat, rLng);
  if (distance > cfg.PHOTO_RADIUS_METERS) {
    removeUploaded(req.file);
    return res.status(400).json({
      message: `You are ${Math.round(distance)} m away from the reported spot. Go within ${cfg.PHOTO_RADIUS_METERS} m and try again.`,
      distance: Math.round(distance),
    });
  }

  removeByUrl(report.afterPhoto); // replace an older rejected photo
  report.afterPhoto = photoUrl(req.file);
  report.afterCheck = { distance: Math.round(distance * 10) / 10, lat, lng, takenAt: new Date() };
  report.status = 'pending_review';
  report.rejectionNote = '';
  addHistory(report, 'pending_review', 'After photo uploaded', req.user);
  await report.save();

  await notifyAdmins(`After photo ready for review: ${report.title}`, report._id);
  res.json({ report: await load(report._id) });
};
