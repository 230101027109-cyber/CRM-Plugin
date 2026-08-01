const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Earlier releases created a global unique `messageId_1` index. Baileys
    // history IDs must instead be unique per tenant/channel; otherwise a
    // reconnect can reject valid history and make sending return HTTP 500.
    const ChatMessage = require('../models/ChatMessage');
    try {
      await ChatMessage.collection.dropIndex('messageId_1');
      console.log('Migrated ChatMessage messageId index to tenant/channel scope');
    } catch (error) {
      // Index already removed / collection not created yet.
      if (error.codeName !== 'IndexNotFound' && error.code !== 27 && error.code !== 26) throw error;
    }
    await ChatMessage.createIndexes();
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
