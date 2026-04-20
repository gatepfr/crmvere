import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import {
  listDemands,
  listMyDemands,
  assignDemand,
  addDemandComment,
  getDemandTimeline,
  listAtendimentos,
  updateAtendimento,
  deleteAtendimento,
  getDemand,
  updateDemand,
  deleteDemand,
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

// Rotas de Atendimento (WhatsApp/IA)
router.get('/atendimentos', listAtendimentos);
router.patch('/atendimentos/:id', updateAtendimento);
router.delete('/atendimentos/:id', deleteAtendimento);

// Rotas de Demandas Oficiais
router.get('/', listDemands);
router.get('/my', listMyDemands);
router.post('/', createDemand);
router.get('/:id', getDemand);
router.patch('/:id/status', updateDemand);
router.patch('/:id/assign', assignDemand);
router.post('/:id/comments', addDemandComment);
router.get('/:id/timeline', getDemandTimeline);
router.delete('/:id', deleteDemand);

// Rotas de Categorias
router.get('/categories', listCategories);
router.post('/categories', createCategory);
router.post('/categories/seed', seedCategories);
router.delete('/categories/:id', deleteCategory);

// Rotas de Munícipes
router.get('/municipes/list', listMunicipes);
router.post('/municipes', createMunicipe);
router.post('/municipes/import', upload.single('file'), importMunicipes);
router.patch('/municipe/:id', updateMunicipe);
router.delete('/municipe/:id', deleteMunicipe);

export default router;
