const express = require('express');
const router = express.Router();
const { getRedisClient } = require('../config/redis');
const { getPool } = require('../config/database');
const { getProducer } = require('../config/kafka');

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    services: {
      redis: 'unknown',
      postgres: 'unknown',
      kafka: 'unknown'
    }
  };

  try {
    // Check Redis
    try {
      const redisClient = getRedisClient();
      await redisClient.ping();
      health.services.redis = 'healthy';
    } catch (error) {
      health.services.redis = 'unhealthy';
    }

    // Check PostgreSQL
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      health.services.postgres = 'healthy';
    } catch (error) {
      health.services.postgres = 'unhealthy';
    }

    // Check Kafka
    try {
      const producer = getProducer();
      if (producer) {
        health.services.kafka = 'healthy';
      }
    } catch (error) {
      health.services.kafka = 'unhealthy';
    }

    const allHealthy = Object.values(health.services).every(
      status => status === 'healthy'
    );

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    health.message = 'Error checking health';
    res.status(503).json(health);
  }
});

/**
 * GET /api/health/ready
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (req, res) => {
  try {
    const redisClient = getRedisClient();
    const pool = getPool();
    const producer = getProducer();

    await redisClient.ping();
    await pool.query('SELECT 1');

    if (producer) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

/**
 * GET /api/health/live
 * Liveness probe for Kubernetes
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

module.exports = router;
