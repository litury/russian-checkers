ALTER TABLE email_challenges ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE email_challenges ADD COLUMN recovery_hash TEXT;
ALTER TABLE email_challenges ADD CONSTRAINT email_recovery_binding CHECK (
 (requester_id IS NOT NULL AND recovery_hash IS NULL) OR
 (requester_id IS NULL AND purpose = 'login' AND recovery_hash IS NOT NULL)
);
