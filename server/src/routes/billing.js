const express = require('express');
const billingController = require('../controllers/billingController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/plans', billingController.getPlans);
router.get('/subscription', authenticate, billingController.getSubscription);
router.post('/checkout', authenticate, billingController.createCheckoutSession);
router.post('/portal', authenticate, billingController.createPortalSession);

module.exports = router;
