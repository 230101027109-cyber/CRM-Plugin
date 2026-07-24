const express = require('express');
const ticketController = require('../controllers/ticketController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', ticketController.getTickets);
router.post('/', ticketController.createTicket);
router.get('/:id', ticketController.getTicketById);
router.put('/:id', ticketController.updateTicket);
router.delete('/:id', ticketController.deleteTicket);

module.exports = router;
