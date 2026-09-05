// Infrastructure layer barrel export
export { default as connectDB } from './database';
export { connectRedis, getRedisClient } from './cache';
export { initSocket, getIO, emitToTenant } from './socket';
export * from './external';
