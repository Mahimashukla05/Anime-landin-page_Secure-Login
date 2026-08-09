const jwt = require('jsonwebtoken');

/**
 * Middleware to verify short-lived Access Tokens sent in the Authorization header.
 * Expected Header Format: Authorization: Bearer <access_token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token after "Bearer"

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token required. Please provide a valid Authorization header.'
    });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: err.name === 'TokenExpiredError' 
          ? 'Access token expired. Please refresh your session.' 
          : 'Invalid access token.'
      });
    }

    // Attach decoded user payload (userId, username, email) to req.user
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
