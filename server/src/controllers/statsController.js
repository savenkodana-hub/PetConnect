const Pet = require('../models/Pet');
const Post = require('../models/Post');
const User = require('../models/User');
const Group = require('../models/Group');
const { escapeRegex } = require('../utils/security');

const getVisiblePostMatch = async (userId) => {
  const accessibleGroups = await Group.find({
    $or: [{ isPrivate: false }, { admin: userId }, { members: userId }]
  }).select('_id');
  const accessibleGroupIds = accessibleGroups.map((group) => group._id);

  return {
    $or: [
      { group: { $exists: false } },
      { group: null },
      { group: { $in: accessibleGroupIds } }
    ]
  };
};

const getRecentActivitySummary = ({ petsCount, postsCount, groupsCount, recentPosts }) => {
  const summary = [];

  if (postsCount > 0) {
    summary.push(`You have shared ${postsCount} post${postsCount === 1 ? '' : 's'} with PetConnect.`);
  } else {
    summary.push('You have not shared a post yet.');
  }

  if (petsCount > 0) {
    summary.push(`You have ${petsCount} pet profile${petsCount === 1 ? '' : 's'} in your account.`);
  } else {
    summary.push('Add your first pet profile to personalize your feed.');
  }

  if (groupsCount > 0) {
    summary.push(`You are active in ${groupsCount} group${groupsCount === 1 ? '' : 's'}.`);
  } else {
    summary.push('Join a group to see more community posts in your feed.');
  }

  if (recentPosts.length > 0) {
    summary.push(`Latest post: ${recentPosts[0].content.slice(0, 80)}${recentPosts[0].content.length > 80 ? '...' : ''}`);
  }

  return summary;
};

const findMostActivePet = (pets, posts) => {
  if (!pets.length || !posts.length) {
    return null;
  }

  const petCounts = pets.map((pet) => {
    const pattern = new RegExp(`\\b${escapeRegex(pet.name)}\\b`, 'i');
    const count = posts.filter((post) => pattern.test(post.content)).length;

    return {
      petId: pet._id,
      name: pet.name,
      type: pet.type,
      count
    };
  });

  const mostActivePet = petCounts.sort((first, second) => second.count - first.count)[0];

  return mostActivePet?.count > 0 ? mostActivePet : null;
};

const getMyActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [petsCount, postsCount, groupsCount, likesResult, postsPerMonth, pets, posts, recentPosts] =
      await Promise.all([
        Pet.countDocuments({ owner: userId }),
        Post.countDocuments({ author: userId }),
        Group.countDocuments({ members: userId }),
        Post.aggregate([
          { $match: { author: userId } },
          {
            $project: {
              likesCount: { $size: { $ifNull: ['$likes', []] } }
            }
          },
          {
            $group: {
              _id: null,
              totalLikes: { $sum: '$likesCount' }
            }
          }
        ]),
        Post.aggregate([
          { $match: { author: userId } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              year: '$_id.year',
              month: '$_id.month',
              count: 1
            }
          },
          { $sort: { year: 1, month: 1 } }
        ]),
        Pet.find({ owner: userId }).select('name type').lean(),
        Post.find({ author: userId }).select('content createdAt').lean(),
        Post.find({ author: userId })
          .select('content createdAt likes comments group')
          .populate('group', 'name')
          .sort({ createdAt: -1 })
          .limit(3)
          .lean()
      ]);

    const totalLikesReceived = likesResult[0]?.totalLikes || 0;
    const mostActivePet = findMostActivePet(pets, posts);
    const recentActivitySummary = getRecentActivitySummary({
      petsCount,
      postsCount,
      groupsCount,
      recentPosts
    });

    res.status(200).json({
      stats: {
        petsCount,
        postsCount,
        groupsCount,
        totalLikesReceived,
        postsPerMonth,
        mostActivePet,
        recentActivitySummary,
        recentPosts
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPostsPerMonth = async (req, res, next) => {
  try {
    const visiblePostMatch = await getVisiblePostMatch(req.user._id);
    const stats = await Post.aggregate([
      { $match: visiblePostMatch },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          count: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);

    res.status(200).json({ stats });
  } catch (error) {
    next(error);
  }
};

const getPostsPerGroup = async (req, res, next) => {
  try {
    const visiblePostMatch = await getVisiblePostMatch(req.user._id);
    const accessibleGroupIds = visiblePostMatch.$or[2].group.$in;

    const stats = await Post.aggregate([
      {
        $match: {
          group: { $in: accessibleGroupIds }
        }
      },
      {
        $group: {
          _id: '$group',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: '_id',
          foreignField: '_id',
          as: 'group'
        }
      },
      { $unwind: '$group' },
      {
        $project: {
          _id: 0,
          groupId: '$_id',
          groupName: '$group.name',
          count: 1
        }
      },
      { $sort: { count: -1, groupName: 1 } }
    ]);

    res.status(200).json({ stats });
  } catch (error) {
    next(error);
  }
};

const getPetsByType = async (req, res, next) => {
  try {
    const stats = await Pet.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1
        }
      },
      { $sort: { type: 1 } }
    ]);

    res.status(200).json({ stats });
  } catch (error) {
    next(error);
  }
};

const getUsersPerMonth = async (req, res, next) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          count: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);

    res.status(200).json({ stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyActivity,
  getPostsPerMonth,
  getPostsPerGroup,
  getPetsByType,
  getUsersPerMonth
};
