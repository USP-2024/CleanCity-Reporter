const Notification = require('../models/Notification');
const User = require('../models/User');

exports.notify = (userId, message, reportId = null) =>
  Notification.create({ user: userId, message, report: reportId });

exports.notifyAdmins = async (message, reportId = null) => {
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(admins.map((a) => Notification.create({ user: a._id, message, report: reportId })));
};
