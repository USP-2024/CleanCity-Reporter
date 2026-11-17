require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cleancity',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
  JWT_EXPIRES: '7d',
  // Worker's after-photo must be taken within this distance of the report (metres)
  PHOTO_RADIUS_METERS: Number(process.env.PHOTO_RADIUS_METERS) || 50,
  // Reports of the same category within this distance count as possible duplicates (metres)
  DUPLICATE_RADIUS_METERS: 100,
};
