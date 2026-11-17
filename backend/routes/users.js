const router = require('express').Router();
const c = require('../controllers/userController');
const { protect, allow } = require('../middleware/auth');
const wrap = require('../utils/wrap');

router.use(protect, allow('admin'));

router.get('/', wrap(c.list));
router.patch('/:id/role', wrap(c.setRole));
router.delete('/:id', wrap(c.remove));

module.exports = router;
