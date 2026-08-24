const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Connected');
});

redisClient.on('ready', () => {
  console.log('Redis Ready');
});

const connectRedis = async () => {
  if (redisClient.isOpen) return;
  await redisClient.connect();
};

const ensureRedisConnection = async () => {
  if (!redisClient.isOpen) {
    await connectRedis();
  }
  if (!redisClient.isReady) {
    throw new Error('Redis is not ready');
  }
};

const releaseLock = async (key, token) => {
  await ensureRedisConnection();

  const script = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;

  await redisClient.eval(script, {
    keys: [key],
    arguments: [token],
  });
};

module.exports = {
  redisClient,
  connectRedis,
  ensureRedisConnection,
  releaseLock,
};
