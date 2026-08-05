// Express 4 doesn't automatically catch rejected promises from async route
// handlers — an unhandled rejection there crashes the entire Node process
// (killing every active connection, not just the failing request), rather
// than just failing that one response. Wrapping every handler with this
// forwards the error to next(err) -> the global error handler in server.js.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
