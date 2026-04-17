-- Migration to allow daily service records and track human interaction
ALTER TABLE atendimentos DROP CONSTRAINT IF EXISTS atendimento_tenant_municipe_unq;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='atendimentos' AND column_name='last_human_interaction_at') THEN
    ALTER TABLE atendimentos ADD COLUMN last_human_interaction_at TIMESTAMP;
  END IF;
END $$;
