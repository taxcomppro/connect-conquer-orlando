WITH tpl AS (
  INSERT INTO public.sms_templates (name, body, is_default)
  VALUES (
    'Atlas Welcome',
    'Hi {{first_name}}, I''m Atlas!  Thanks for visiting Tax Compliance Pro at Booth 540! For the Forum, you can choose ANY membership and get your first 2 months FREE. Claim yours here: {{signup_link}}

Reply STOP to opt out.',
    true
  )
  RETURNING id
)
INSERT INTO public.sms_triggers (name, event, template_id, enabled, require_consent)
VALUES (
  'Atlas welcome text',
  'lead_captured',
  (SELECT id FROM tpl),
  true,
  true
);