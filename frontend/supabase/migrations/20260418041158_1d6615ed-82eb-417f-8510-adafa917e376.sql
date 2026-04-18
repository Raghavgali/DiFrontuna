-- Add real geographic coordinates for tickets so we can plot them on a real Boston map.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Re-locate existing demo tickets to real Boston addresses.
-- 1) Mass General Hospital area (emergency)
UPDATE public.tickets
SET location = '55 Fruit St, Boston, MA 02114',
    latitude = 42.3631,
    longitude = -71.0686
WHERE id = '8092fea7-5245-4789-aeac-ab51d1c25f44';

-- 2) Allston / Brighton noise complaint
UPDATE public.tickets
SET location = '1265 Commonwealth Ave, Allston, MA 02134',
    latitude = 42.3505,
    longitude = -71.1303
WHERE id = '70f41164-8649-422c-b392-b92d5e67b5bf';

-- 3) Back Bay water main break
UPDATE public.tickets
SET location = 'Boylston St & Dartmouth St, Boston, MA 02116',
    latitude = 42.3496,
    longitude = -71.0780
WHERE id = 'ca5f62f0-12b0-41a1-9171-87f356dd0ece';

-- 4) Dorchester pothole
UPDATE public.tickets
SET location = 'Dorchester Ave & Savin Hill Ave, Dorchester, MA 02125',
    latitude = 42.3119,
    longitude = -71.0540
WHERE id = '45440140-c572-4756-8e77-90e4c239712e';

-- 5) Cambridge / MIT area
UPDATE public.tickets
SET location = '77 Massachusetts Ave, Cambridge, MA 02139',
    latitude = 42.3601,
    longitude = -71.0942
WHERE id = '89b60e82-ccdd-4b33-bca2-ac29800a8a23';

-- 6) North End
UPDATE public.tickets
SET location = '4 N Square, Boston, MA 02113',
    latitude = 42.3637,
    longitude = -71.0533
WHERE id = '29d73830-e4b3-4cc0-b48b-9cce0ef9701a';
