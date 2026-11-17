const router = require('express').Router();
const c = require('../controllers/simulationController');
const { protect, allow } = require('../middleware/auth');
const upload = require('../middleware/upload');
const wrap = require('../utils/wrap');

router.use(protect);

router.post('/', allow('worker'), upload.single('photo'), wrap(c.create));
router.get('/', allow('worker', 'admin'), wrap(c.list));
router.get('/:id', allow('worker', 'admin'), wrap(c.getOne));
router.patch('/:id/review', allow('admin'), wrap(c.review));

module.exports = router;
