import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { documents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import pdf from 'pdf-parse';

const router = Router();
router.use(authenticate);

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return cb(new Error('No tenant context'), '');
    
    const uploadPath = path.join(__dirname, '../../uploads', tenantId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT and DOCX are allowed.'));
    }
  }
});

// POST /api/knowledge/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const tenantId = req.user?.tenantId;
  const file = req.file;

  if (!tenantId || !file) {
    return res.status(400).json({ error: 'No tenant context or file provided' });
  }

  try {
    let textContent = '';
    
    // Extract text based on file type
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdf(dataBuffer);
      textContent = data.text;
    } else if (file.mimetype === 'text/plain') {
      textContent = fs.readFileSync(file.path, 'utf-8');
    }

    // Save to DB
    const [newDoc] = await db.insert(documents).values({
      tenantId,
      fileName: file.originalname,
      filePath: file.path,
      fileType: file.mimetype,
      textContent: textContent.substring(0, 10000) // Cap text for now
    }).returning();

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// GET /api/knowledge
router.get('/', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const docs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// DELETE /api/knowledge/:id
router.delete('/:id', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete physical file
    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    // Delete from DB
    await db.delete(documents).where(eq(documents.id, id));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
