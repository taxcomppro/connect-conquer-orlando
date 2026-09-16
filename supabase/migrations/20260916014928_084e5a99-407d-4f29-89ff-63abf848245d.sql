UPDATE public.approved_staff_emails
SET role = 'admin'
WHERE lower(email) IN (
  'jennifer@taxcomppro.com',
  'tonique@taxcomppro.com',
  'tracina.m@hotmail.com'
);

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users AS u
WHERE lower(u.email) IN (
  'jennifer@taxcomppro.com',
  'tonique@taxcomppro.com',
  'tracina.m@hotmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'staff'::public.app_role
FROM auth.users AS u
WHERE lower(u.email) IN (
  'jennifer@taxcomppro.com',
  'tonique@taxcomppro.com',
  'tracina.m@hotmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;