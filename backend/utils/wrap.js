// Express 4 does not catch errors from async handlers by itself - this wrapper does.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
