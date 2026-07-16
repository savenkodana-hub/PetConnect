const mongoose = require('mongoose');

const Message = require('../models/Message');
const User = require('../models/User');
const { PUBLIC_USER_FIELDS } = require('../utils/security');

const ensureValidObjectId = (id, res, label = 'ObjectId') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid ${label}`);
  }
};

const ensureValidReceiver = async (receiverId, senderId, res) => {
  ensureValidObjectId(receiverId, res, 'receiver id');

  if (receiverId.toString() === senderId.toString()) {
    res.status(400);
    throw new Error('User cannot send message to himself');
  }

  const [receiver, sender] = await Promise.all([
    User.findById(receiverId),
    User.findById(senderId).select('friends')
  ]);
  if (!receiver) {
    res.status(404);
    throw new Error('Receiver not found');
  }

  const isFriend = sender?.friends.some(
    (friendId) => friendId.toString() === receiverId.toString()
  );
  if (!isFriend) {
    res.status(403);
    throw new Error('Messages are only allowed between accepted friends');
  }
};

const populateMessage = (query) =>
  query
    .populate('sender', PUBLIC_USER_FIELDS)
    .populate('receiver', PUBLIC_USER_FIELDS);

const createMessage = async ({ senderId, receiverId, text }) => {
  const message = await Message.create({
    sender: senderId,
    receiver: receiverId,
    text
  });

  return populateMessage(Message.findById(message._id));
};

const getConversation = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.userId, res, 'user id');

    await ensureValidReceiver(req.params.userId, req.user._id, res);

    const messages = await populateMessage(
      Message.find({
        $or: [
          { sender: req.user._id, receiver: req.params.userId },
          { sender: req.params.userId, receiver: req.user._id }
        ]
      })
    ).sort({ createdAt: 1 });

    res.status(200).json({ messages });
  } catch (error) {
    next(error);
  }
};

const getMyConversations = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id).select('friends');
    const friendIds = currentUser?.friends || [];
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: { $in: friendIds } },
        { receiver: req.user._id, sender: { $in: friendIds } }
      ]
    })
      .populate('sender', PUBLIC_USER_FIELDS)
      .populate('receiver', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 });

    const conversationMap = new Map();

    messages.forEach((message) => {
      const otherUser =
        message.sender._id.toString() === req.user._id.toString()
          ? message.receiver
          : message.sender;

      const otherUserId = otherUser._id.toString();

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          user: otherUser,
          lastMessage: message
        });
      }
    });

    res.status(200).json({
      conversations: Array.from(conversationMap.values())
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversation,
  getMyConversations,
  createMessage,
  ensureValidReceiver
};
