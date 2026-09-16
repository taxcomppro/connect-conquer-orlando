UPDATE public.email_templates
SET html_body = replace(
      replace(html_body, '          {{rep_name}}<br>' || chr(10), ''),
      'Tax Comp Pro · [Your mailing address here]', 'Tax Comp Pro'
    )
WHERE html_body LIKE '%[Your mailing address here]%' OR html_body LIKE '%{{rep_name}}%';