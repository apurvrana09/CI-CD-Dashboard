const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  // attach statusCode so errorHandler doesn't default to 500
  error.statusCode = 404;
  next(error);
};

module.exports = { notFound };