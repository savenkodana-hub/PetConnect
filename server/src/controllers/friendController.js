const mongoose = require('mongoose');

const User = require('../models/User');
const { escapeRegex } = require('../utils/security');

const USER_PUBLIC_FIELDS = 'username';
const USER_SEARCH_LIMIT = 20;

const ensureValidObjectId = (id, res, label = 'user id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid ${label}`);
  }
};

const idsInclude = (ids = [], id) =>
  ids.some((existingId) => existingId.toString() === id.toString());

const formatPublicUser = (user, currentUser) => {
  const userId = user._id.toString();

  return {
    _id: userId,
    username: user.username,
    friendshipStatus: idsInclude(currentUser.friends, user._id)
      ? 'friends'
      : idsInclude(currentUser.friendRequestsSent, user._id)
        ? 'requestSent'
        : idsInclude(currentUser.friendRequestsReceived, user._id)
          ? 'requestReceived'
          : 'none'
  };
};

const getFriends = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id)
      .populate('friends', USER_PUBLIC_FIELDS)
      .populate('friendRequestsSent', USER_PUBLIC_FIELDS)
      .populate('friendRequestsReceived', USER_PUBLIC_FIELDS);

    res.status(200).json({
      friends: currentUser.friends,
      friendRequestsSent: currentUser.friendRequestsSent,
      friendRequestsReceived: currentUser.friendRequestsReceived
    });
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const keyword = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const currentUser = req.user;
    const filters = {
      _id: { $ne: currentUser._id }
    };

    if (keyword) {
      const safeKeyword = escapeRegex(keyword);
      filters.$or = [
        { username: { $regex: safeKeyword, $options: 'i' } }
      ];
    }

    const users = await User.find(filters)
      .select(USER_PUBLIC_FIELDS)
      .sort({ username: 1 })
      .limit(USER_SEARCH_LIMIT);

    res.status(200).json({
      users: users.map((user) => formatPublicUser(user, currentUser))
    });
  } catch (error) {
    next(error);
  }
};

const sendFriendRequest = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.userId, res);

    const targetUserId = req.params.userId;
    if (targetUserId === req.user._id.toString()) {
      res.status(400);
      throw new Error('You cannot send a friend request to yourself');
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findById(targetUserId)
    ]);

    if (!targetUser) {
      res.status(404);
      throw new Error('User not found');
    }

    if (idsInclude(currentUser.friends, targetUser._id)) {
      res.status(409);
      throw new Error('You are already friends with this user');
    }

    if (
      idsInclude(currentUser.friendRequestsSent, targetUser._id) ||
      idsInclude(targetUser.friendRequestsReceived, currentUser._id)
    ) {
      res.status(409);
      throw new Error('Friend request already sent');
    }

    if (
      idsInclude(currentUser.friendRequestsReceived, targetUser._id) ||
      idsInclude(targetUser.friendRequestsSent, currentUser._id)
    ) {
      res.status(409);
      throw new Error('This user already sent you a friend request. Accept or reject it first.');
    }

    await Promise.all([
      User.findByIdAndUpdate(currentUser._id, {
        $addToSet: { friendRequestsSent: targetUser._id }
      }),
      User.findByIdAndUpdate(targetUser._id, {
        $addToSet: { friendRequestsReceived: currentUser._id }
      })
    ]);

    res.status(201).json({
      message: 'Friend request sent successfully',
      request: {
        from: currentUser._id,
        to: targetUser._id,
        status: 'pending'
      }
    });
  } catch (error) {
    next(error);
  }
};

const acceptFriendRequest = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.userId, res);

    const requesterId = req.params.userId;
    const [currentUser, requester] = await Promise.all([
      User.findById(req.user._id),
      User.findById(requesterId)
    ]);

    if (!requester) {
      res.status(404);
      throw new Error('User not found');
    }

    if (!idsInclude(currentUser.friendRequestsReceived, requester._id)) {
      res.status(404);
      throw new Error('Friend request not found');
    }

    await Promise.all([
      User.findByIdAndUpdate(currentUser._id, {
        $addToSet: { friends: requester._id },
        $pull: {
          friendRequestsReceived: requester._id,
          friendRequestsSent: requester._id
        }
      }),
      User.findByIdAndUpdate(requester._id, {
        $addToSet: { friends: currentUser._id },
        $pull: {
          friendRequestsSent: currentUser._id,
          friendRequestsReceived: currentUser._id
        }
      })
    ]);

    res.status(200).json({
      message: 'Friend request accepted',
      friend: {
        _id: requester._id,
        username: requester.username
      }
    });
  } catch (error) {
    next(error);
  }
};

const rejectFriendRequest = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.userId, res);

    const requesterId = req.params.userId;
    const [currentUser, requester] = await Promise.all([
      User.findById(req.user._id),
      User.findById(requesterId)
    ]);

    if (!requester) {
      res.status(404);
      throw new Error('User not found');
    }

    if (!idsInclude(currentUser.friendRequestsReceived, requester._id)) {
      res.status(404);
      throw new Error('Friend request not found');
    }

    await Promise.all([
      User.findByIdAndUpdate(currentUser._id, {
        $pull: { friendRequestsReceived: requester._id }
      }),
      User.findByIdAndUpdate(requester._id, {
        $pull: { friendRequestsSent: currentUser._id }
      })
    ]);

    res.status(200).json({ message: 'Friend request rejected' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFriends,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest
};
