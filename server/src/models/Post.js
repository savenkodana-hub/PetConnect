const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment user is required']
    },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      maxlength: [5000, 'Post content cannot exceed 5000 characters']
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: [4096, 'imageUrl cannot exceed 4096 characters']
    },
    videoUrl: {
      type: String,
      trim: true,
      maxlength: [4096, 'videoUrl cannot exceed 4096 characters']
    },
    stickerData: {
      type: mongoose.Schema.Types.Mixed
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post author is required']
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet'
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    comments: [commentSchema]
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
