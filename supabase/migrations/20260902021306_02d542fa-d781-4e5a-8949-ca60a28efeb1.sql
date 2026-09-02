INSERT INTO public.sms_templates (name, body, is_default)
VALUES (
  'Card activation invite',
  $TXT$Hi {{first_name}}, our building Wi-Fi caused issues today and your digital business card couldn’t be activated. Please stop by TCPC Booth 540 tomorrow with your TCPC profile QR code ready and we’ll activate your card on the spot. See you then!

Reply STOP to opt out.$TXT$,
  false
)
ON CONFLICT DO NOTHING;