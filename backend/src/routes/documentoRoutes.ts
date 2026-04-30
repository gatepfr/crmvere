import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { listDocumentos, getCategorias, createDocumento, updateDocumento, deleteDocumento } from '../controllers/documentoController';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.get('/categorias', getCategorias);
router.get('/', listDocumentos);
router.post('/', createDocumento);
router.patch('/:id', updateDocumento);
router.delete('/:id', deleteDocumento);

export default router;
