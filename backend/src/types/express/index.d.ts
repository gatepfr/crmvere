export {};

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        tenantId: string | null;
        email: string;
        role: 'super_admin' | 'admin' | 'vereador' | 'assessor';
      };
    }
  }
}
