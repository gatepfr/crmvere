-- Migration to allow daily service records by removing the unique constraint on tenant+municipe
ALTER TABLE atendimentos DROP CONSTRAINT IF EXISTS atendimento_tenant_municipe_unq;
