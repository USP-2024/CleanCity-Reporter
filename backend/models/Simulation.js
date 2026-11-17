const mongoose = require('mongoose');

// A worker's result from the 3D cleaning SIMULATOR (training mode).
// Kept separate from real reports on purpose: a simulated photo is never proof of real work.
const simulationSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scenario: { type: String, default: 'Garbage clean-up training' },
    photo: { type: String, required: true }, // screenshot of the 3D scene, e.g. /uploads/123.jpg
    itemsCleaned: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Simulation', simulationSchema);
