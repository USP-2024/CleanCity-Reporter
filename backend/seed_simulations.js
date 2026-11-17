/**
 * Adds a few demo SIMULATION submissions WITHOUT touching your existing data:  npm run seed:sims
 * (needs the demo workers/admin from `npm run seed` to exist)
 */
const mongoose = require('mongoose');
const cfg = require('./config');
const User = require('./models/User');
const Simulation = require('./models/Simulation');

const HOUR = 60 * 60 * 1000;

(async () => {
  await mongoose.connect(cfg.MONGO_URI);
  const admin = await User.findOne({ role: 'admin' });
  const workers = await User.find({ role: 'worker' }).sort({ email: 1 });
  if (!admin || workers.length === 0) {
    console.error('No admin/worker found. Run "npm run seed" first.');
    process.exit(1);
  }
  await Simulation.deleteMany({});
  const w1 = workers[0];
  const w2 = workers[1] || workers[0];
  const now = Date.now();

  await Simulation.insertMany([
    { worker: w1._id, photo: '/uploads/sample/after_garbage.jpg', itemsCleaned: 14, totalItems: 14, durationSec: 74, status: 'pending', createdAt: new Date(now - 2 * HOUR) },
    { worker: w2._id, photo: '/uploads/sample/after_other.jpg', itemsCleaned: 14, totalItems: 14, durationSec: 91, status: 'pending', createdAt: new Date(now - 1 * HOUR) },
    { worker: w1._id, photo: '/uploads/sample/after_pothole.jpg', itemsCleaned: 14, totalItems: 14, durationSec: 66, status: 'approved', reviewNote: 'Fast and clean. Well done!', reviewedBy: admin._id, reviewedAt: new Date(now - 20 * HOUR), createdAt: new Date(now - 22 * HOUR) },
    { worker: w2._id, photo: '/uploads/sample/before_garbage.jpg', itemsCleaned: 9, totalItems: 14, durationSec: 58, status: 'rejected', reviewNote: 'Garbage is still visible. Clean every item before taking the photo.', reviewedBy: admin._id, reviewedAt: new Date(now - 44 * HOUR), createdAt: new Date(now - 46 * HOUR) },
  ]);
  console.log('Added 4 demo simulations (2 pending, 1 approved, 1 rejected).');
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
