const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cfg = require('./config');
const Report = require('./models/Report');

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir)); // photos are served from here

app.get('/', (req, res) => res.json({ app: 'CleanCity Reporter API', status: 'running' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/simulations', require('./routes/simulations'));
app.use('/api', require('./routes/extras'));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Photo is too large (max 8 MB)' });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.status !== 400 && err.status !== 401 && err.status !== 403) console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

mongoose
  .connect(cfg.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await Report.init(); // makes sure the geo index exists
    app.listen(cfg.PORT, '0.0.0.0', () => {
      console.log(`API running on http://localhost:${cfg.PORT}`);
      console.log('Android emulator reaches it at http://10.0.2.2:' + cfg.PORT);
    });
  })
  .catch((err) => {
    console.error('\nCould not connect to MongoDB:', err.message);
    console.error('Is MongoDB running? Check MONGO_URI in backend/.env\n');
    process.exit(1);
  });
