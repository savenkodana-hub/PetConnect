const jwt = require('jsonwebtoken');

const User = require('../models/User');

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

const buildAuthResponse = (user) => ({
  token: generateToken(user._id),
  user: {
    _id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  }
});

const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409);
      throw new Error('Email is already registered');
    }

    const user = await User.create({
      username,
      email,
      password,
      role: 'user'
    });

    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    res.status(200).json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res) => {
  res.status(200).json({
    user: {
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt
    }
  });
};

module.exports = {
  register,
  login,
  getCurrentUser
};
