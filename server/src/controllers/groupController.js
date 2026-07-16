const mongoose = require('mongoose');

const Group = require('../models/Group');
const Post = require('../models/Post');
const User = require('../models/User');
const { escapeRegex, PUBLIC_USER_FIELDS } = require('../utils/security');
const runWithTransactionFallback = require('../utils/transactions');
const { removeLocalMediaByUrl } = require('../utils/mediaFiles');

const ensureValidObjectId = (id, res, label = 'ObjectId') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`Invalid ${label}`);
  }
};

const includesObjectId = (ids, id) =>
  ids.some((existingId) =>
    (existingId?._id || existingId).toString() === id.toString()
  );

const sanitizeGroupForUser = (group, userId) => {
  const groupObject = typeof group.toObject === 'function' ? group.toObject() : group;
  const adminId = groupObject.admin?._id || groupObject.admin;
  const isAdmin = adminId?.toString() === userId.toString();
  const isMember = includesObjectId(groupObject.members || [], userId);
  const isPending = includesObjectId(groupObject.pendingRequests || [], userId);

  if (groupObject.isPrivate && !isAdmin && !isMember) {
    return {
      _id: groupObject._id,
      name: groupObject.name,
      category: groupObject.category,
      isPrivate: true,
      createdAt: groupObject.createdAt,
      members: [],
      pendingRequests: isPending ? [userId] : [],
      membershipStatus: isPending ? 'pending' : 'none'
    };
  }

  if (!isAdmin) {
    return {
      ...groupObject,
      pendingRequests: [],
      membershipStatus: 'member'
    };
  }

  return { ...groupObject, membershipStatus: 'admin' };
};

const ensureGroupAdmin = (group, userId, res) => {
  if (group.admin.toString() !== userId.toString()) {
    res.status(403);
    throw new Error('Only the group admin can perform this action');
  }
};

const findGroupById = async (id, res) => {
  ensureValidObjectId(id, res, 'group id');

  const group = await Group.findById(id);
  if (!group) {
    res.status(404);
    throw new Error('Group not found');
  }

  return group;
};

const createGroup = async (req, res, next) => {
  try {
    const group = await Group.create({
      ...req.body,
      admin: req.user._id,
      members: [req.user._id],
      pendingRequests: []
    });

    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
};

const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find()
      .populate('admin', PUBLIC_USER_FIELDS)
      .populate('members', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 });

    res.status(200).json({
      groups: groups.map((group) => sanitizeGroupForUser(group, req.user._id))
    });
  } catch (error) {
    next(error);
  }
};

const getMyGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({
      $or: [{ admin: req.user._id }, { members: req.user._id }]
    })
      .populate('admin', PUBLIC_USER_FIELDS)
      .populate('members', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 });

    res.status(200).json({
      groups: groups.map((group) => sanitizeGroupForUser(group, req.user._id))
    });
  } catch (error) {
    next(error);
  }
};

const getGroupById = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.id, res, 'group id');

    const group = await Group.findById(req.params.id)
      .populate('admin', PUBLIC_USER_FIELDS)
      .populate('members', PUBLIC_USER_FIELDS)
      .populate('pendingRequests', PUBLIC_USER_FIELDS);

    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    res.status(200).json({ group: sanitizeGroupForUser(group, req.user._id) });
  } catch (error) {
    next(error);
  }
};

const updateGroup = async (req, res, next) => {
  try {
    const group = await findGroupById(req.params.id, res);
    ensureGroupAdmin(group, req.user._id, res);
    const groupMedia = await Post.find({ group: group._id }).select('imageUrl videoUrl').lean();

    const allowedUpdates = ['name', 'description', 'category', 'isPrivate'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        group[field] = req.body[field];
      }
    });
    groupMedia.forEach((post) => {
      removeLocalMediaByUrl(post.imageUrl).catch(() => {});
      removeLocalMediaByUrl(post.videoUrl).catch(() => {});
    });

    const updatedGroup = await group.save();

    res.status(200).json({ group: updatedGroup });
  } catch (error) {
    next(error);
  }
};

const deleteGroup = async (req, res, next) => {
  try {
    const group = await findGroupById(req.params.id, res);
    ensureGroupAdmin(group, req.user._id, res);

    await runWithTransactionFallback(mongoose, async (session) => {
      const options = session ? { session } : undefined;
      await Post.deleteMany({ group: group._id }, options);
      await Group.deleteOne({ _id: group._id }, options);
    });

    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const joinGroup = async (req, res, next) => {
  try {
    const group = await findGroupById(req.params.id, res);
    const userId = req.user._id;

    if (includesObjectId(group.members, userId)) {
      res.status(409);
      throw new Error('User is already a member of this group');
    }

    if (includesObjectId(group.pendingRequests, userId)) {
      res.status(409);
      throw new Error('Join request is already pending');
    }

    if (group.isPrivate) {
      group.pendingRequests.push(userId);
      await group.save();

      return res.status(200).json({
        message: 'Join request sent',
        group: sanitizeGroupForUser(group, req.user._id)
      });
    }

    group.members.push(userId);
    await group.save();

    return res.status(200).json({
      message: 'Joined group successfully',
      group: sanitizeGroupForUser(group, req.user._id)
    });
  } catch (error) {
    return next(error);
  }
};

const approveMember = async (req, res, next) => {
  try {
    const group = await findGroupById(req.params.id, res);
    ensureValidObjectId(req.params.userId, res, 'user id');
    ensureGroupAdmin(group, req.user._id, res);

    const user = await User.findById(req.params.userId);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (!includesObjectId(group.pendingRequests, req.params.userId)) {
      res.status(404);
      throw new Error('Pending request not found');
    }

    group.pendingRequests = group.pendingRequests.filter(
      (pendingUserId) => pendingUserId.toString() !== req.params.userId
    );

    if (!includesObjectId(group.members, req.params.userId)) {
      group.members.push(req.params.userId);
    }

    await group.save();

    res.status(200).json({
      message: 'Member approved successfully',
      group
    });
  } catch (error) {
    next(error);
  }
};

const rejectMember = async (req, res, next) => {
  try {
    const group = await findGroupById(req.params.id, res);
    ensureValidObjectId(req.params.userId, res, 'user id');
    ensureGroupAdmin(group, req.user._id, res);

    if (!includesObjectId(group.pendingRequests, req.params.userId)) {
      res.status(404);
      throw new Error('Pending request not found');
    }

    group.pendingRequests = group.pendingRequests.filter(
      (pendingUserId) => pendingUserId.toString() !== req.params.userId
    );

    await group.save();

    res.status(200).json({
      message: 'Join request rejected successfully',
      group
    });
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const group = await findGroupById(req.params.id, res);
    ensureValidObjectId(req.params.userId, res, 'user id');
    ensureGroupAdmin(group, req.user._id, res);

    if (group.admin.toString() === req.params.userId) {
      res.status(400);
      throw new Error('Group admin cannot be removed from members');
    }

    if (!includesObjectId(group.members, req.params.userId)) {
      res.status(404);
      throw new Error('Member not found in this group');
    }

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== req.params.userId
    );

    await group.save();

    res.status(200).json({
      message: 'Member removed successfully',
      group
    });
  } catch (error) {
    next(error);
  }
};

const searchGroupMembers = async (req, res, next) => {
  try {
    const group = await findGroupById(req.params.id, res);
    ensureGroupAdmin(group, req.user._id, res);

    const { username, status, minPosts, maxPosts, startDate, endDate } = req.query;
    const candidateStatuses = new Map();

    if (!status || status === 'member') {
      group.members.forEach((memberId) => {
        candidateStatuses.set(memberId.toString(), 'member');
      });
    }

    if (!status || status === 'pending') {
      group.pendingRequests.forEach((userId) => {
        if (!candidateStatuses.has(userId.toString())) {
          candidateStatuses.set(userId.toString(), 'pending');
        }
      });
    }

    const candidateIds = [...candidateStatuses.keys()].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const userFilters = { _id: { $in: candidateIds } };

    if (username) {
      userFilters.username = { $regex: escapeRegex(username), $options: 'i' };
    }

    const users = await User.find(userFilters).select('username').sort({ username: 1 }).lean();
    const userIds = users.map((user) => user._id);
    const postMatch = {
      group: group._id,
      author: { $in: userIds }
    };

    if (startDate || endDate) {
      postMatch.createdAt = {};

      if (startDate) {
        postMatch.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          const nextDay = new Date(`${endDate}T00:00:00.000Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          postMatch.createdAt.$lt = nextDay;
        } else {
          postMatch.createdAt.$lte = new Date(endDate);
        }
      }
    }

    const postCounts = userIds.length
      ? await Post.aggregate([
        { $match: postMatch },
        { $group: { _id: '$author', postCount: { $sum: 1 } } }
      ])
      : [];
    const countByUserId = new Map(
      postCounts.map((item) => [item._id.toString(), item.postCount])
    );
    const minimum = minPosts === undefined ? null : Number(minPosts);
    const maximum = maxPosts === undefined ? null : Number(maxPosts);
    const members = users
      .map((user) => ({
        _id: user._id,
        username: user.username,
        status: candidateStatuses.get(user._id.toString()),
        postCount: countByUserId.get(user._id.toString()) || 0
      }))
      .filter((user) => minimum === null || user.postCount >= minimum)
      .filter((user) => maximum === null || user.postCount <= maximum);

    res.status(200).json({ members });
  } catch (error) {
    next(error);
  }
};

const searchGroups = async (req, res, next) => {
  try {
    const { name, category, isPrivate } = req.query;
    const filters = {};

    if (name) {
      filters.name = { $regex: escapeRegex(name), $options: 'i' };
    }

    if (category) {
      filters.category = category;
    }

    if (isPrivate !== undefined) {
      filters.isPrivate = isPrivate === 'true';
    }

    const groups = await Group.find(filters)
      .populate('admin', PUBLIC_USER_FIELDS)
      .populate('members', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 });

    res.status(200).json({
      groups: groups.map((group) => sanitizeGroupForUser(group, req.user._id))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getMyGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroup,
  approveMember,
  rejectMember,
  removeMember,
  searchGroupMembers,
  searchGroups
};
