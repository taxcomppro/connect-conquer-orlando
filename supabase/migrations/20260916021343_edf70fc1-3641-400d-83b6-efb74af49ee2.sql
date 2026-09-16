ALTER TABLE public.sms_messages ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE public.sms_messages ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.sms_messages ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound';
ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_direction_check CHECK (direction IN ('inbound','outbound'));

ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound';
ALTER TABLE public.email_messages ADD CONSTRAINT email_messages_direction_check CHECK (direction IN ('inbound','outbound'));
ALTER TABLE public.email_messages ALTER COLUMN to_email DROP NOT NULL;
ALTER TABLE public.email_messages ALTER COLUMN from_email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS sms_messages_contact_phone_idx ON public.sms_messages (contact_phone);