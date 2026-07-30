// Runs a zod schema against req.body, replacing it with the parsed/typed
// result on success or responding 400 with the first error message on failure.
module.exports = function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Invalid request body';
      return res.status(400).json({ error: message });
    }
    req.body = result.data;
    next();
  };
};
