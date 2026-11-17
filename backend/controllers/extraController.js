const Notification = require('../models/Notification');
const Report = require('../models/Report');
const User = require('../models/User');

// GET /api/notifications
exports.listNotifications = async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const unread = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({
    unread,
    notifications: items.map((n) => ({
      id: n._id,
      message: n.message,
      reportId: n.report,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
  });
};

// PATCH /api/notifications/read-all
exports.readAll = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: 'Marked as read' });
};

const toMap = (rows) => rows.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});

// GET /api/stats   (admin dashboard)
exports.stats = async (req, res) => {
  const group = (field) => Report.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  const [total, byStatus, byCategory, byWard, citizens, workers] = await Promise.all([
    Report.countDocuments(),
    group('status'),
    group('category'),
    group('ward'),
    User.countDocuments({ role: 'citizen' }),
    User.countDocuments({ role: 'worker' }),
  ]);
  res.json({
    total,
    byStatus: toMap(byStatus),
    byCategory: toMap(byCategory),
    byWard: toMap(byWard),
    users: { citizens, workers },
  });
};

// GET /api/leaderboard
exports.leaderboard = async (req, res) => {
  const wards = await Report.aggregate([
    { $match: { status: 'resolved' } },
    { $group: { _id: '$ward', resolved: { $sum: 1 } } },
    { $sort: { resolved: -1 } },
  ]);
  const citizens = await User.find({ role: 'citizen' }).sort({ points: -1 }).limit(10).select('name points');
  res.json({
    wards: wards.map((w) => ({ ward: w._id, resolved: w.resolved })),
    citizens: citizens.map((c) => ({ id: c._id, name: c.name, points: c.points })),
  });
};
