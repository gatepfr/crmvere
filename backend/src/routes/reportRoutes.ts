import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { generateReportPdf, calcDateRange } from '../services/reportService';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { type, startDate: customStart, endDate: customEnd } = req.body;

    const validTypes = ['mensal', 'trimestral', 'anual', 'custom'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'type deve ser: mensal, trimestral, anual ou custom' });
    }

    if (type === 'custom' && (!customStart || !customEnd)) {
      return res.status(400).json({ error: 'Para tipo custom, informe startDate e endDate' });
    }

    const { startDate, endDate } = calcDateRange(type, customStart, customEnd);

    const pdfBuffer = await generateReportPdf(tenantId, startDate, endDate);

    const filename = `prestacao-contas-${startDate}-${endDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error('[REPORT] Erro ao gerar PDF:', err);
    return res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

export default router;
