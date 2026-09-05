import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';

import { config } from './config';
import { connectDB } from './infrastructure/database';
import { connectRedis } from './infrastructure/cache';
import { initSocket } from './infrastructure/socket';
import { setGlobalMessageHandler, setGlobalQRHandler, setGlobalLidMappingHandler } from './infrastructure/external';
import { authRoutes, healthRoutes } from './application/routes';
import { logger, errorHandler } from './application/middleware';
import { Channel } from './domain/models';
import { startSession } from './infrastructure/external';
import { emitToTenant } from './infrastructure/socket';
import { BaileysEventHandlerPayload, QREventPayload, LidMappingPayload } from './shared/types';

const app: Express = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: config.server.allowedOrigins,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger middleware
app.use(logger);

// Initialize Socket.IO
const io = initSocket(server);

// Set up Baileys event handlers
setGlobalMessageHandler(async (payload: BaileysEventHandlerPayload) => {
  // Handle incoming messages - to be implemented in message controller
  console.log('Message received:', payload);
  emitToTenant(payload.tenantId, 'message:received', payload);
});

setGlobalQRHandler((payload: QREventPayload) => {
  console.log('QR code received for channel:', payload.channelId);
  emitToTenant(payload.tenantId, 'channel:qr', payload);
});

setGlobalLidMappingHandler(async (payload: LidMappingPayload) => {
  console.log('LID mapping received:', payload);
  emitToTenant(payload.tenantId, 'contact:lid_mapping', payload);
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
// Additional routes will be added here

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../public')));
app.use('/data', express.static(path.join(__dirname, '../public')));

// Error handling
app.use(errorHandler);

const PORT = config.server.port;

const startServer = async () => {
  await connectDB();
  await connectRedis();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Reconnect active WhatsApp channels on startup
  try {
    const activeChannels = await Channel.find({ status: { $in: ['connected', 'connecting'] } });
    console.log(`[Startup] Reconnecting ${activeChannels.length} active channel(s)...`);

    for (const channel of activeChannels) {
      if (!channel.sessionId) {
        console.log(`[Startup] Channel ${channel.channelId} has no sessionId, marking disconnected`);
        channel.status = 'disconnected';
        await channel.save();
        continue;
      }
      startSession(channel.channelId, channel.sessionId, channel.tenantId)
        .catch(err => console.error(`[Startup] Failed to reconnect channel ${channel.channelId}:`, err.message));
    }
  } catch (err) {
    console.error('[Startup] Channel reconnection error:', err.message);
  }
};

startServer();

export { app, server, io };
