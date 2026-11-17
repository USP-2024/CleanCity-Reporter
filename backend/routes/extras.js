const router = require('express').Router();
const c = require('../controllers/extraController');
const { protect, allow } = require('../middleware/auth');
const wrap = require('../utils/wrap');

router.get('/notifications', protect, wrap(c.listNotifications));
router.patch('/notifications/read-all', protect, wrap(c.readAll));
router.get('/stats', protect, allow('admin'), wrap(c.stats));
router.get('/leaderboard', protect, wrap(c.leaderboard));

module.exports = router;
