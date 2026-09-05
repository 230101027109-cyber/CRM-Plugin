import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { BaileysService } from '../external/baileys.service';
import { getRedisClient } from '../cache';

let io: SocketIOServer | null = null;

export const initSocket = (server: HttpServer): SocketIOServer => {
  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  };

  io = new SocketIOServer(server, {
    cors: corsOptions,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_tenant', (tenantId: string) => {
      socket.join(`tenant:${tenantId}`);
      console.log(`Socket ${socket.id} joined tenant room: ${tenantId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const emitToTenant = (tenantId: string, event: string, data: any): void => {
  if (io) {
    io.to(`tenant:${tenantId}`).emit(event, data);
  }
};
