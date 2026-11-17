const User = require('../models/User');

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone, points: u.points });

// GET /api/users?role=worker   (admin)
exports.list = async (req, res) => {
  const q = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(q).sort({ role: 1, name: 1 });
  res.json({ users: users.map(publicUser) });
};

// PATCH /api/users/:id/role   { role }   (admin)
exports.setRole = async (req, res) => {
  const { role } = req.body;
  if (!['citizen', 'worker', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot change your own role' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: publicUser(user) });
};

// DELETE /api/users/:id   (admin)
exports.remove = async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot delete your own account' });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'User deleted' });
};
