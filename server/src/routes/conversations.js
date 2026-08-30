const express = require('express');
const authenticate = require('../middleware/auth');

const {
  getConversations,
  openConversation,
  deleteConversation,
} = require('../controllers/conversationController');

const router =
  express.Router();

router.use(authenticate);

router.get(
  '/',
  async (req, res) => {
    try {
      const conversations =
        await getConversations(
          req.user.tenantId
        );

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      console.error(
        'Error fetching conversations:',
        error
      );

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  '/open',
  async (req, res) => {
    await openConversation(
      req,
      res
    );
  }
);

router.delete('/:id', deleteConversation);

module.exports = router;