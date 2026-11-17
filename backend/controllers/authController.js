const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES } = require('../config');

const sign = (user) => jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  points: u.points,
});

// POST /api/auth/register  (public sign-up always creates a CITIZEN account)
exports.register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) return res.status(400).json({ message: 'This email is already registered' });

  const user = await User.create({ name, email, password, phone: phone || '', role: 'citizen' });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Enter your email and password' });

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Wrong email or password' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ user: publicUser(req.user) });
};
