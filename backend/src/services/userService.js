const { getRedisClient } = require('../config/redis');
const { query } = require('../config/database');
const { sendMessage } = require('../config/kafka');
const Joi = require('joi');

// Validation schema
const userSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  gender: Joi.string().valid('male', 'female', 'non-binary', 'prefer-not-to-say').required(),
  sex: Joi.string().valid('male', 'female', 'intersex').required(),
  occupation: Joi.string().min(2).max(255).required()
});

/**
 * Validate user data
 */
function validateUserData(userData) {
  const { error, value } = userSchema.validate(userData);
  if (error) {
    throw new Error(`Validation error: ${error.details[0].message}`);
  }
  return value;
}

/**
 * Submit user data through Redis to Kafka
 * This is the entry point when user submits the form
 */
async function submitUserData(userData) {
  try {
    // Validate user data
    const validatedData = validateUserData(userData);

    const redisClient = getRedisClient();

    // Store in Redis temporarily
    const userKey = `user:pending:${validatedData.email}`;
    await redisClient.setEx(
      userKey,
      3600, // expire after 1 hour
      JSON.stringify(validatedData)
    );

    console.log('User data stored in Redis:', validatedData.email);

    // Send to Kafka for processing
    await sendMessage('user-registration', validatedData);

    return {
      success: true,
      message: 'User registration submitted successfully',
      email: validatedData.email
    };
  } catch (error) {
    console.error('Error submitting user data:', error);
    throw error;
  }
}

/**
 * Save user to PostgreSQL database
 * This is called by Kafka consumer
 */
async function saveUserToDatabase(userData) {
  try {
    const insertQuery = `
      INSERT INTO users (first_name, last_name, email, gender, sex, occupation)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        gender = EXCLUDED.gender,
        sex = EXCLUDED.sex,
        occupation = EXCLUDED.occupation,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      userData.firstName,
      userData.lastName,
      userData.email,
      userData.gender,
      userData.sex,
      userData.occupation
    ];

    const result = await query(insertQuery, values);

    // Update Redis to mark as completed
    const redisClient = getRedisClient();
    const userKey = `user:completed:${userData.email}`;
    await redisClient.setEx(
      userKey,
      86400, // expire after 24 hours
      JSON.stringify({ savedAt: new Date().toISOString(), ...result.rows[0] })
    );

    // Remove pending key
    await redisClient.del(`user:pending:${userData.email}`);

    console.log('User saved to database:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving user to database:', error);
    throw error;
  }
}

/**
 * Get all users from database
 */
async function getAllUsers(limit = 100, offset = 0) {
  try {
    const selectQuery = `
      SELECT id, first_name, last_name, email, gender, sex, occupation, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await query(selectQuery, [limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
  try {
    // Check Redis cache first
    const redisClient = getRedisClient();
    const cachedUser = await redisClient.get(`user:completed:${email}`);

    if (cachedUser) {
      console.log('User found in cache:', email);
      return JSON.parse(cachedUser);
    }

    // If not in cache, query database
    const selectQuery = `
      SELECT id, first_name, last_name, email, gender, sex, occupation, created_at, updated_at
      FROM users
      WHERE email = $1;
    `;

    const result = await query(selectQuery, [email]);

    if (result.rows.length > 0) {
      // Cache the result
      await redisClient.setEx(
        `user:completed:${email}`,
        3600,
        JSON.stringify(result.rows[0])
      );
      return result.rows[0];
    }

    return null;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
}

module.exports = {
  submitUserData,
  saveUserToDatabase,
  getAllUsers,
  getUserByEmail,
  validateUserData
};
