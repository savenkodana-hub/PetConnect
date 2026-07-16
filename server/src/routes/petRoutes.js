const express = require('express');

const {
  createPet,
  getPets,
  getMyPets,
  getPetById,
  updatePet,
  deletePet,
  searchPets
} = require('../controllers/petController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateCreatePet,
  validateUpdatePet,
  validateSearchPets,
  rejectPetFields,
  rejectPetSearchFields,
  handleValidationErrors
} = require('../validators/petValidators');
const { mongoIdParam } = require('../validators/commonValidators');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', upload.single('image'), rejectPetFields, validateCreatePet, handleValidationErrors, createPet);
router.get('/', getPets);
router.get('/my', getMyPets);
router.get('/search', rejectPetSearchFields, validateSearchPets, handleValidationErrors, searchPets);
router.get('/:id', mongoIdParam('id', 'pet id'), handleValidationErrors, getPetById);
router.put('/:id', mongoIdParam('id', 'pet id'), upload.single('image'), rejectPetFields, validateUpdatePet, handleValidationErrors, updatePet);
router.delete('/:id', mongoIdParam('id', 'pet id'), handleValidationErrors, deletePet);

module.exports = router;
