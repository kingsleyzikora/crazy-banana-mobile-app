const redis = require('redis');

let redisClient = null;

async function connectRedis() {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis reconnection attempts exceeded');
            return new Error('Redis reconnection failed');
          }
          return retries * 100; // reconnect after 100ms, 200ms, 300ms, etc.
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });

    redisClient.on('ready', () => {
      console.log('Redis client ready');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
}

function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    console.log('Redis client disconnected');
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis
};
