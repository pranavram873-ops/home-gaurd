-- ============================================================================
-- TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
-- Seed Units & Geofenced Duty Locations
-- ============================================================================

DO $$
DECLARE
    chn_id UUID;
    cbe_id UUID;
    mdu_id UUID;
    try_id UUID;
    slm_id UUID;
    tnv_id UUID;
    unit_chn_1 UUID;
    unit_chn_2 UUID;
    unit_chn_3 UUID;
    unit_cbe_1 UUID;
    unit_mdu_1 UUID;
BEGIN
    SELECT id INTO chn_id FROM public.districts WHERE code = 'CHN';
    SELECT id INTO cbe_id FROM public.districts WHERE code = 'CBE';
    SELECT id INTO mdu_id FROM public.districts WHERE code = 'MDU';
    SELECT id INTO try_id FROM public.districts WHERE code = 'TRY';
    SELECT id INTO slm_id FROM public.districts WHERE code = 'SLM';
    SELECT id INTO tnv_id FROM public.districts WHERE code = 'TNV';

    -- Insert Initial Units for Chennai
    IF chn_id IS NOT NULL THEN
        INSERT INTO public.units (district_id, name, code, description)
        VALUES 
            (chn_id, 'Zone IV - Mylapore Division', 'CHN-Z4-MYL', 'Covers Marina Beach, Santhome, and Luz Corner bandobast'),
            (chn_id, 'Zone I - Harbour & Central Division', 'CHN-Z1-HBR', 'Covers Chennai Central, High Court, and George Town traffic control'),
            (chn_id, 'Traffic Wing South - T.Nagar', 'CHN-TRF-STH', 'Festival bandobast and crowd management at Usman Road & Panagal Park')
        ON CONFLICT (district_id, code) DO NOTHING;
    END IF;

    -- Insert Initial Units for Coimbatore
    IF cbe_id IS NOT NULL THEN
        INSERT INTO public.units (district_id, name, code, description)
        VALUES 
            (cbe_id, 'Central Range - Gandhipuram Unit', 'CBE-CR-GND', 'Gandhipuram Bus Stand and Cross Cut Road surveillance'),
            (cbe_id, 'South Range - RS Puram Unit', 'CBE-SR-RSP', 'RS Puram & DB Road patrol')
        ON CONFLICT (district_id, code) DO NOTHING;
    END IF;

    -- Insert Initial Units for Madurai
    IF mdu_id IS NOT NULL THEN
        INSERT INTO public.units (district_id, name, code, description)
        VALUES 
            (mdu_id, 'Temple Security Wing - Zone A', 'MDU-TSW-ZA', 'Meenakshi Amman Temple outer perimeter and Chithirai festival routes'),
            (mdu_id, 'Railway Junction & Periyar Unit', 'MDU-RW-PER', 'Madurai Junction crowd regulation and bus terminal vigil')
        ON CONFLICT (district_id, code) DO NOTHING;
    END IF;

    -- Retrieve IDs for Duty Locations
    SELECT id INTO unit_chn_1 FROM public.units WHERE code = 'CHN-Z4-MYL';
    SELECT id INTO unit_chn_2 FROM public.units WHERE code = 'CHN-Z1-HBR';
    SELECT id INTO unit_cbe_1 FROM public.units WHERE code = 'CBE-CR-GND';
    SELECT id INTO unit_mdu_1 FROM public.units WHERE code = 'MDU-TSW-ZA';

    -- Insert Duty Locations with precise real coordinates & geofences (Radius 100m to 250m)
    -- 1. Marina Beach Promenade Post, Chennai
    INSERT INTO public.duty_locations (name, address, latitude, longitude, radius_meters, district_id, unit_id, is_active)
    VALUES (
        'Marina Beach Light House & Promenade Post',
        'Kamarajar Salai, Marina Beach, Mylapore, Chennai, Tamil Nadu 600004',
        13.0398,
        80.2785,
        200,
        chn_id,
        unit_chn_1,
        true
    );

    -- 2. Dr. MGR Chennai Central Railway Station Bandobast
    INSERT INTO public.duty_locations (name, address, latitude, longitude, radius_meters, district_id, unit_id, is_active)
    VALUES (
        'Chennai Central Station Security Zone',
        'Kannappar Thidal, Periyamet, Chennai, Tamil Nadu 600003',
        13.0827,
        80.2757,
        150,
        chn_id,
        unit_chn_2,
        true
    );

    -- 3. Ripon Building HQ & Government Estate Post
    INSERT INTO public.duty_locations (name, address, latitude, longitude, radius_meters, district_id, unit_id, is_active)
    VALUES (
        'Ripon Building Headquarters Perimeter',
        'Raja Muthiah Rd, Kannappar Thidal, Periyamet, Chennai 600003',
        13.0823,
        80.2728,
        150,
        chn_id,
        unit_chn_2,
        true
    );

    -- 4. Madurai Meenakshi Amman Temple Gate 1 & 2
    INSERT INTO public.duty_locations (name, address, latitude, longitude, radius_meters, district_id, unit_id, is_active)
    VALUES (
        'Meenakshi Amman Temple Chithirai Gopuram Post',
        'Madurai Main, Madurai, Tamil Nadu 625001',
        9.9195,
        78.1193,
        180,
        mdu_id,
        unit_mdu_1,
        true
    );

    -- 5. Coimbatore Gandhipuram Central Bus Station Post
    INSERT INTO public.duty_locations (name, address, latitude, longitude, radius_meters, district_id, unit_id, is_active)
    VALUES (
        'Gandhipuram Central Terminal Traffic Sector',
        'Gandhipuram, Coimbatore, Tamil Nadu 641012',
        11.0168,
        76.9675,
        150,
        cbe_id,
        unit_cbe_1,
        true
    );

END $$;
