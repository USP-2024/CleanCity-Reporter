const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    status: String,
    note: { type: String, default: '' },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['garbage', 'pothole', 'waterlogging', 'streetlight', 'other'],
      default: 'other',
    },
    ward: { type: String, default: 'Ward A' },
    address: { type: String, default: '' },

    // GeoJSON point: coordinates are [longitude, latitude]
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },

    beforePhoto: { type: String, default: '' }, // e.g. /uploads/123-abc.jpg
    afterPhoto: { type: String, default: '' },
    afterCheck: {
      distance: Number, // metres between worker and the report when the after photo was taken
      lat: Number,
      lng: Number,
      takenAt: Date,
    },

    status: {
      type: String,
      enum: ['reported', 'assigned', 'in_progress', 'pending_review', 'resolved'],
      default: 'reported',
    },
    statusHistory: [historySchema],
    rejectionNote: { type: String, default: '' },
    citizenConfirmed: { type: Boolean, default: false },
    resolvedAt: Date,

    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Needed for the "nearby reports" (duplicate detection) query
reportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);
