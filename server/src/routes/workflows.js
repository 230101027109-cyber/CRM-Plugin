const express = require('express');
const workflowController = require('../controllers/workflowController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', workflowController.getWorkflows);
router.post('/', workflowController.createWorkflow);
router.put('/:id', workflowController.updateWorkflow);
router.delete('/:id', workflowController.deleteWorkflow);

module.exports = router;
