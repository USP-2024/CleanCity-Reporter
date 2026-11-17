/**
 * Fills the database with demo data:  npm run seed
 *  - 1 admin, 2 workers, 4 citizens (all with password "password123")
 *  - 18 reports in every status, with before/after sample photos
 *  - 4 demo 3D-simulation submissions (2 pending review)
 * WARNING: it first deletes everything in the users / reports / notifications collections.
 */
const mongoose = require('mongoose');
const cfg = require('./config');
const User = require('./models/User');
const Report = require('./models/Report');
const Notification = require('./models/Notification');
const Simulation = require('./models/Simulation');

// Andheri East, Mumbai. Set the emulator location to this point for the demo.
const CENTER = { lat: 19.1136, lng: 72.8697 };
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// [title, category, status, citizenIndex, workerIndex, ward, address]
const SPECS = [
  ['Garbage heap near bus stop', 'garbage', 'reported', 0, 0, 'Ward A', 'Opposite Andheri East bus stop'],
  ['Overflowing public dustbin', 'garbage', 'reported', 1, 0, 'Ward B', 'Near Chakala market'],
  ['Deep pothole on main road', 'pothole', 'reported', 2, 0, 'Ward C', 'MIDC Road, near signal'],
  ['Water logged after rain', 'waterlogging', 'reported', 3, 0, 'Ward A', 'Subway entrance'],
  ['Streetlight not working', 'streetlight', 'reported', 0, 0, 'Ward D', 'Lane 4, Marol'],
  ['Dumped construction waste', 'other', 'reported', 1, 0, 'Ward E', 'Behind the old warehouse'],

  ['Plastic waste near park gate', 'garbage', 'assigned', 2, 0, 'Ward B', 'Sahar Road park'],
  ['Big pothole near school', 'pothole', 'assigned', 3, 1, 'Ward C', 'Outside Sunrise School'],
  ['Blocked drain, water on road', 'waterlogging', 'assigned', 0, 1, 'Ward F', 'Kondivita Road'],

  ['Garbage pile at market corner', 'garbage', 'in_progress', 1, 0, 'Ward A', 'Fish market corner'],
  ['Dark street, lights broken', 'streetlight', 'in_progress', 2, 1, 'Ward E', 'Station road'],
  ['Road cave-in near bridge', 'pothole', 'in_progress', 3, 1, 'Ward D', 'Under the flyover'],

  ['Rubbish dumped on footpath', 'garbage', 'pending_review', 0, 0, 'Ward B', 'Near metro pillar 12'],
  ['Standing water, mosquito risk', 'waterlogging', 'pending_review', 1, 1, 'Ward C', 'Back lane of mall'],

  ['Overflowing bin cleared', 'garbage', 'resolved', 2, 0, 'Ward A', 'Temple street'],
  ['Pothole filled and levelled', 'pothole', 'resolved', 3, 1, 'Ward A', 'Cross road 7'],
  ['Streetlight repaired', 'streetlight', 'resolved', 0, 1, 'Ward B', 'Garden lane'],
  ['Waste near river cleaned', 'garbage', 'resolved', 1, 0, 'Ward C', 'Mithi river bank'],
];

const STATUS_STEPS = ['reported', 'assigned', 'in_progress', 'pending_review', 'resolved'];

(async () => {
  await mongoose.connect(cfg.MONGO_URI);
  console.log('Connected. Clearing old demo data...');
  await Promise.all([User.deleteMany({}), Report.deleteMany({}), Notification.deleteMany({}), Simulation.deleteMany({})]);
  await Report.init();

  const mk = (name, email, role, phone) => User.create({ name, email, password: 'password123', role, phone });
  const admin = await mk('Admin Officer', 'admin@cleancity.com', 'admin', '9000000001');
  const workers = [
    await mk('Ramesh Patil', 'worker1@cleancity.com', 'worker', '9000000011'),
    await mk('Sunita Jadhav', 'worker2@cleancity.com', 'worker', '9000000012'),
  ];
  const citizens = [
    await mk('Aarav Sharma', 'citizen@cleancity.com', 'citizen', '9000000021'),
    await mk('Priya Nair', 'citizen2@cleancity.com', 'citizen', '9000000022'),
    await mk('Rohan Mehta', 'citizen3@cleancity.com', 'citizen', '9000000023'),
    await mk('Fatima Shaikh', 'citizen4@cleancity.com', 'citizen', '9000000024'),
  ];

  const points = new Map();
  const addPoints = (user, n) => points.set(String(user._id), (points.get(String(user._id)) || 0) + n);

  for (let i = 0; i < SPECS.length; i++) {
    const [title, category, status, ci, wi, ward, address] = SPECS[i];
    const citizen = citizens[ci];
    const worker = workers[wi];
    const stepIdx = STATUS_STEPS.indexOf(status);
    const created = new Date(Date.now() - (SPECS.length - i) * 0.9 * DAY);

    // The very first report sits exactly on CENTER so duplicate detection can be demonstrated.
    const dLat = i === 0 ? 0 : (((i * 53) % 97) - 48) / 9000;
    const dLng = i === 0 ? 0 : (((i * 71) % 89) - 44) / 9000;
    const lat = CENTER.lat + dLat;
    const lng = CENTER.lng + dLng;

    const notes = {
      reported: 'Report submitted',
      assigned: `Assigned to ${worker.name}`,
      in_progress: 'Work started',
      pending_review: 'After photo uploaded',
      resolved: 'After photo approved',
    };
    const by = { reported: citizen.name, assigned: admin.name, in_progress: worker.name, pending_review: worker.name, resolved: admin.name };
    const history = STATUS_STEPS.slice(0, stepIdx + 1).map((s, k) => ({
      status: s,
      note: notes[s],
      byName: by[s],
      at: new Date(created.getTime() + k * 5 * HOUR),
    }));

    const hasWorker = stepIdx >= 1;
    const hasAfter = stepIdx >= 3;
    const confirmed = status === 'resolved' && i % 2 === 0;

    const supporters = citizens.filter((c, k) => k !== ci && (i + k) % 3 === 0).map((c) => c._id);

    await Report.create({
      title,
      description: `${title}. Needs attention at the earliest, it is affecting people in the area.`,
      category,
      ward,
      address,
      location: { type: 'Point', coordinates: [lng, lat] },
      beforePhoto: `/uploads/sample/before_${category}.jpg`,
      afterPhoto: hasAfter ? `/uploads/sample/after_${category}.jpg` : '',
      afterCheck: hasAfter
        ? { distance: 8 + ((i * 7) % 33), lat, lng, takenAt: new Date(created.getTime() + 15 * HOUR) }
        : undefined,
      status,
      statusHistory: history,
      citizenConfirmed: confirmed,
      resolvedAt: status === 'resolved' ? history[history.length - 1].at : undefined,
      reportedBy: citizen._id,
      assignedTo: hasWorker ? worker._id : null,
      upvotes: supporters,
      createdAt: created,
      updatedAt: history[history.length - 1].at,
    });

    if (status === 'resolved') {
      addPoints(citizen, 10 + (confirmed ? 5 : 0));
      addPoints(worker, 10);
    }
  }

  for (const [id, pts] of points) await User.updateOne({ _id: id }, { $inc: { points: pts } });
  // a little extra so the leaderboard has more than 2-3 non-zero rows
  await User.updateOne({ _id: citizens[1]._id }, { $inc: { points: 15 } });
  await User.updateOne({ _id: citizens[3]._id }, { $inc: { points: 5 } });

  const pending = await Report.find({ status: 'pending_review' });
  for (const r of pending) {
    await Notification.create({ user: admin._id, message: `After photo ready for review: ${r.title}`, report: r._id });
  }
  const first = await Report.findOne({ reportedBy: citizens[0]._id }).sort({ createdAt: 1 });
  await Notification.create({ user: citizens[0]._id, message: 'Welcome to CleanCity Reporter!', report: null });
  if (first) await Notification.create({ user: citizens[0]._id, message: `Your report "${first.title}" was received`, report: first._id });

  await Simulation.insertMany([
    { worker: workers[0]._id, photo: '/uploads/sample/after_garbage.jpg', itemsCleaned: 14, totalItems: 14, durationSec: 74, status: 'pending', createdAt: new Date(Date.now() - 2 * HOUR) },
    { worker: workers[1]._id, photo: '/uploads/sample/after_other.jpg', itemsCleaned: 14, totalItems: 14, durationSec: 91, status: 'pending', createdAt: new Date(Date.now() - 1 * HOUR) },
    { worker: workers[0]._id, photo: '/uploads/sample/after_pothole.jpg', itemsCleaned: 14, totalItems: 14, durationSec: 66, status: 'approved', reviewNote: 'Fast and clean. Well done!', reviewedBy: admin._id, reviewedAt: new Date(Date.now() - 20 * HOUR), createdAt: new Date(Date.now() - 22 * HOUR) },
    { worker: workers[1]._id, photo: '/uploads/sample/before_garbage.jpg', itemsCleaned: 9, totalItems: 14, durationSec: 58, status: 'rejected', reviewNote: 'Garbage is still visible. Clean every item before taking the photo.', reviewedBy: admin._id, reviewedAt: new Date(Date.now() - 44 * HOUR), createdAt: new Date(Date.now() - 46 * HOUR) },
  ]);

  console.log('\nDemo data created.\n');
  console.log('  Admin    admin@cleancity.com     / password123');
  console.log('  Worker   worker1@cleancity.com   / password123   (also worker2@...)');
  console.log('  Citizen  citizen@cleancity.com   / password123   (also citizen2..4@...)\n');
  console.log(`  Demo GPS point: ${CENTER.lat}, ${CENTER.lng}\n`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('\nSeed failed:', err.message);
  console.error('Is MongoDB running? Check MONGO_URI in backend/.env\n');
  process.exit(1);
});
