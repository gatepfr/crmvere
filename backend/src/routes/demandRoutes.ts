import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { 
  listDemands, 
  getDemand, 
  updateDemand, 
  updateMunicipe, 
  deleteMunicipe, 
  createDemand, 
  listMunicipes,
  createMunicipe,
  importMunicipes,
  listCategories,
  createCategory,
  deleteCategory,
  seedCategories
} from '../controllers/demandController';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/temp/' });

router.use(authenticate);
router.use(checkTenant);

router.get('/', listDemands);
router.get('/categories', listCategories);
router.post('/categories', createCategory);
router.post('/categories/seed', seedCategories);
router.delete('/categories/:id', deleteCategory);
router.get('/municipes/list', listMunicipes);
router.post('/municipes', createMunicipe);
router.post('/municipes/import', upload.single('file'), importMunicipes);
router.post('/', createDemand);
router.get('/:id', getDemand);
router.patch('/:id/status', updateDemand);
router.patch('/municipe/:id', updateMunicipe);
router.delete('/municipe/:id', deleteMunicipe);

export default router;
