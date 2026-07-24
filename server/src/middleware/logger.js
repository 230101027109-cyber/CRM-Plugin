const loggerMiddleware = (req, res, next) => {
  const start = Date.now();
  console.log(`[REQUEST] ${req.method} ${req.originalUrl} - Body:`, JSON.stringify(req.body));
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[RESPONSE] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);
  });
  
  next();
};

module.exports = loggerMiddleware;
