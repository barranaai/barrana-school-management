const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('super_admin'));

// Placeholder route
router.get('/', (req, res) => {
  res.json({ message: 'Super Admin route working' });
});

module.exports = router;
