import { Request, Response } from 'express';
import * as intelligenceService from '../services/intelligenceService';

export const getSummary = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  try {
    const vacuums = await intelligenceService.identifyTerritorialVacuums(tenantId);
    res.json({ vacuums });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const executePlan = async (req: Request, res: Response) => {
  const { bairro } = req.body;
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  try {
    const result = await intelligenceService.executeExpansionPlan(tenantId, bairro);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
