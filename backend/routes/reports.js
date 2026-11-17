const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, allow } = require('../middleware/auth');
const upload = require('../middleware/upload');
const wrap = require('../utils/wrap');

router.use(protect);

router.get('/nearby', wrap(c.nearby)); // must stay above '/:id'
router.get('/', wrap(c.list));
router.post('/', allow('citizen'), upload.single('photo'), wrap(c.create));
router.get('/:id', wrap(c.getOne));
router.put('/:id', allow('citizen', 'admin'), wrap(c.update));
router.delete('/:id', allow('citizen', 'admin'), wrap(c.remove));

router.post('/:id/upvote', allow('citizen'), wrap(c.upvote));
router.post('/:id/confirm', allow('citizen'), wrap(c.confirm));

router.patch('/:id/assign', allow('admin'), wrap(c.assign));
router.patch('/:id/review', allow('admin'), wrap(c.review));

router.patch('/:id/status', allow('worker'), wrap(c.setStatus));
router.post('/:id/after-photo', allow('worker'), upload.single('photo'), wrap(c.afterPhoto));

module.exports = router;
