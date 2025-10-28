const express = require('express');
const router = express.Router();
const {
  submitUserData,
  getAllUsers,
  getUserByEmail
} = require('../services/userService');

/**
 * POST /api/users
 * Submit user registration data
 */
router.post('/', async (req, res, next) => {
  try {
    const userData = req.body;

    if (!userData) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required'
      });
    }

    const result = await submitUserData(userData);

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        email: result.email
      }
    });
  } catch (error) {
    console.error('Error in POST /api/users:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to submit user data'
    });
  }
});

/**
 * GET /api/users
 * Get all users with pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const users = await getAllUsers(limit, offset);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error in GET /api/users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/users/:email
 * Get user by email
 */
router.get('/:email', async (req, res, next) => {
  try {
    const { email } = req.params;

    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error in GET /api/users/:email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

module.exports = router;
