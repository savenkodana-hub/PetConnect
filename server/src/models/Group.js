const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Group description cannot exceed 1000 characters']
    },
    category: {
      type: String,
      required: [true, 'Group category is required'],
      enum: ['dogs', 'cats', 'adoption', 'training', 'health', 'general'],
      lowercase: true,
      trim: true
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Group admin is required']
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    pendingRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

groupSchema.index({ isPrivate: 1, category: 1, createdAt: -1 });
groupSchema.index({ members: 1, createdAt: -1 });

module.exports = mongoose.model('Group', groupSchema);
