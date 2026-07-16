const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Pet name is required'],
      trim: true,
      maxlength: [100, 'Pet name cannot exceed 100 characters']
    },
    type: {
      type: String,
      required: [true, 'Pet type is required'],
      enum: ['dog', 'cat', 'bird', 'rabbit', 'other'],
      lowercase: true,
      trim: true
    },
    breed: {
      type: String,
      trim: true,
      maxlength: [100, 'Breed cannot exceed 100 characters']
    },
    age: {
      type: Number,
      min: [0, 'Age cannot be negative']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters']
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters']
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: [4096, 'imageUrl cannot exceed 4096 characters']
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Pet owner is required']
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

petSchema.index({ owner: 1, createdAt: -1 });
petSchema.index({ type: 1, breed: 1, city: 1 });

module.exports = mongoose.model('Pet', petSchema);
