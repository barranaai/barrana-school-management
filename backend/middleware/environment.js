const developmentOnly = (req, res, next) =>
  process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_ROUTES === 'true'
    ? next()
    : res.status(404).json({ success: false, message: 'Route not found' });

const publicRegistrationDisabled = (req, res) => res.status(403).json({
  success: false,
  message: 'Public registration is disabled. Contact an authorized administrator.'
});

module.exports = { developmentOnly, publicRegistrationDisabled };
