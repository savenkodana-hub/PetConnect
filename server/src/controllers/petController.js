const mongoose = require('mongoose');

const Pet = require('../models/Pet');
const Post = require('../models/Post');
const { escapeRegex, PUBLIC_USER_FIELDS } = require('../utils/security');
const runWithTransactionFallback = require('../utils/transactions');
const { buildMediaUrl, removeLocalMediaByUrl } = require('../utils/mediaFiles');

const ensureImageUpload = (req, res) => {
  if (req.file && !req.file.mimetype.startsWith('image/')) {
    res.status(400);
    throw new Error('Pet media must be an image');
  }
  if (req.file?.size > 10 * 1024 * 1024) {
    res.status(413);
    throw new Error('Pet images must be 10 MB or smaller');
  }
};

const ensureValidObjectId = (id, res) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid pet id');
  }
};

const ensureOwner = (pet, userId, res) => {
  if (pet.owner.toString() !== userId.toString()) {
    res.status(403);
    throw new Error('You cannot edit or delete another user\'s pet');
  }
};

const createPet = async (req, res, next) => {
  try {
    ensureImageUpload(req, res);
    const pet = await Pet.create({
      ...req.body,
      imageUrl: req.file ? buildMediaUrl(req, req.file.filename) : req.body.imageUrl,
      owner: req.user._id
    });

    res.status(201).json({ pet });
  } catch (error) {
    next(error);
  }
};

const getPets = async (req, res, next) => {
  try {
    const pets = await Pet.find()
      .populate('owner', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 });

    res.status(200).json({ pets });
  } catch (error) {
    next(error);
  }
};

const getMyPets = async (req, res, next) => {
  try {
    const pets = await Pet.find({ owner: req.user._id }).sort({ createdAt: -1 });

    res.status(200).json({ pets });
  } catch (error) {
    next(error);
  }
};

const getPetById = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.id, res);

    const pet = await Pet.findById(req.params.id).populate('owner', PUBLIC_USER_FIELDS);
    if (!pet) {
      res.status(404);
      throw new Error('Pet not found');
    }

    res.status(200).json({ pet });
  } catch (error) {
    next(error);
  }
};

const updatePet = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.id, res);

    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      res.status(404);
      throw new Error('Pet not found');
    }

    ensureOwner(pet, req.user._id, res);
    ensureImageUpload(req, res);
    const previousImageUrl = pet.imageUrl;

    const allowedUpdates = [
      'name',
      'type',
      'breed',
      'age',
      'city',
      'bio',
      'imageUrl'
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        pet[field] = req.body[field];
      }
    });

    if (req.body.removeImage) pet.imageUrl = undefined;
    if (req.file) pet.imageUrl = buildMediaUrl(req, req.file.filename);

    const updatedPet = await pet.save();

    if (previousImageUrl && previousImageUrl !== updatedPet.imageUrl) {
      removeLocalMediaByUrl(previousImageUrl).catch(() => {});
    }

    res.status(200).json({ pet: updatedPet });
  } catch (error) {
    next(error);
  }
};

const deletePet = async (req, res, next) => {
  try {
    ensureValidObjectId(req.params.id, res);

    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      res.status(404);
      throw new Error('Pet not found');
    }

    ensureOwner(pet, req.user._id, res);

    await runWithTransactionFallback(mongoose, async (session) => {
      const options = session ? { session } : undefined;
      await Post.updateMany({ pet: pet._id }, { $unset: { pet: 1 } }, options);
      await Pet.deleteOne({ _id: pet._id }, options);
    });
    removeLocalMediaByUrl(pet.imageUrl).catch(() => {});

    res.status(200).json({ message: 'Pet deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const searchPets = async (req, res, next) => {
  try {
    const { type, breed, city, minAge, maxAge } = req.query;
    const filters = {};

    if (type) {
      filters.type = type;
    }

    if (breed) {
      filters.breed = { $regex: escapeRegex(breed), $options: 'i' };
    }

    if (city) {
      filters.city = { $regex: escapeRegex(city), $options: 'i' };
    }

    if (minAge !== undefined || maxAge !== undefined) {
      filters.age = {};

      if (minAge !== undefined) {
        filters.age.$gte = Number(minAge);
      }

      if (maxAge !== undefined) {
        filters.age.$lte = Number(maxAge);
      }
    }

    const pets = await Pet.find(filters)
      .populate('owner', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 });

    res.status(200).json({ pets });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPet,
  getPets,
  getMyPets,
  getPetById,
  updatePet,
  deletePet,
  searchPets
};
