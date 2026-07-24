const express = require('express');
const channelController = require('../controllers/channelController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', channelController.getChannels);
router.post('/', channelController.createChannel);
router.delete('/:id', channelController.deleteChannel);
router.post('/:id/connect', channelController.connectChannel);
router.post('/:id/disconnect', channelController.disconnectChannel);

module.exports = router;
