import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connectRedis = async (): Promise<RedisClientType | null> => {
  try {
    redisClient = createClient({ url: REDIS_URL });
    
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    
    await redisClient.connect();
    console.log('Redis Connected');
    
    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error);
    return null;
  }
};

const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

export { connectRedis, getRedisClient };
