const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const wrap = require('../utils/wrap');

router.post('/register', wrap(c.register));
router.post('/login', wrap(c.login));
router.get('/me', protect, wrap(c.me));

module.exports = router;
