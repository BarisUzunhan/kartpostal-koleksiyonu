-- ============================================================
-- Baska Topraklarin Renkleri — Supabase Schema
-- Supabase SQL Editor'de bir kez çalıştırılır.
-- ============================================================

-- uuid-ossp uzantısı (genellikle Supabase'de zaten aktif)
create extension if not exists "uuid-ossp";

-- ============================================================
-- Ana tablo: postcards
-- ============================================================
create table if not exists postcards (
    id                    uuid primary key default uuid_generate_v4(),
    wp_post_id            integer unique,          -- orijinal WP post ID (upsert için)
    slug                  text,                    -- URL slug
    city                  text not null,
    country               text not null,
    lat                   double precision,
    lng                   double precision,
    date                  date,
    description           text,                    -- Türkçe açıklama / mektup
    description_en        text,                    -- İngilizce açıklama / mektup
    original_text         text,                    -- kartpostal üzerindeki orijinal yabancı metin
    tags                  text[] default '{}',     -- çift dilli etiketler
    image_front           text,                    -- Supabase Storage optimize URL
    image_back            text,                    -- Supabase Storage optimize URL (varsa)
    image_front_original  text,                    -- Supabase Storage orijinal URL
    image_back_original   text,                    -- Supabase Storage orijinal URL (varsa)
    image_thumbnail       text,                    -- özel küçük resim (yoksa ön yüz kullanılır)
    extra_images          text[] default '{}',     -- Supabase Storage optimize URL'leri (3+ görsel)
    extra_images_original text[] default '{}',     -- Supabase Storage orijinal URL'leri (3+ görsel)
    extra_images_position text default 'after_description'
                          check (extra_images_position in ('after_images','after_description')),
                                                     -- ek görseller ön/arka altında mı, açıklamalardan sonra mı
    needs_review          boolean default false,   -- editör düzeltmesi gerekiyor mu
    review_reasons        text[] default '{}',     -- neden (ör. 'multi_postcard', 'no_coords')
    created_at            timestamptz default now(),
    updated_at            timestamptz default now()
);

-- İndeksler (filtre/arama için)
create index if not exists idx_postcards_country   on postcards(country);
create index if not exists idx_postcards_date      on postcards(date desc);
create index if not exists idx_postcards_needs_review on postcards(needs_review) where needs_review = true;
create index if not exists idx_postcards_tags      on postcards using gin(tags);

-- updated_at otomatik güncelleme
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_postcards_updated_at on postcards;
create trigger trg_postcards_updated_at
    before update on postcards
    for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table postcards enable row level security;

-- Herkese okuma (anon dahil)
create policy "Public read"
    on postcards for select
    to anon, authenticated
    using (true);

-- Sadece giriş yapmış kullanıcılar yazabilir (admin/editor)
create policy "Authenticated insert"
    on postcards for insert
    to authenticated
    with check (true);

create policy "Authenticated update"
    on postcards for update
    to authenticated
    using (true)
    with check (true);

create policy "Authenticated delete"
    on postcards for delete
    to authenticated
    using (true);

-- ============================================================
-- Storage bucket (Supabase Dashboard > Storage > New bucket)
-- NOT: Bucket'ı Dashboard'dan oluşturun, adı: "postcards", Public = açık.
-- Klasörler: optimized/ ve original/ (script otomatik oluşturur).
-- ============================================================

-- Storage politikaları: herkes okuyabilir, sadece authenticated yükleyebilir
insert into storage.buckets (id, name, public)
values ('postcards', 'postcards', true)
on conflict (id) do nothing;

create policy "Public image read"
    on storage.objects for select
    to public
    using (bucket_id = 'postcards');

create policy "Authenticated image upload"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'postcards');

create policy "Authenticated image update"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'postcards');

create policy "Authenticated image delete"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'postcards');

-- ============================================================
-- Sonradan eklenen kolonlar (mevcut DB için ALTER TABLE kullan)
-- Yeni kurulumda CREATE TABLE bloğu zaten içeriyor.
-- ============================================================
alter table postcards add column if not exists extra_images          text[] default '{}';
alter table postcards add column if not exists extra_images_original text[] default '{}';
alter table postcards add column if not exists extra_images_position text default 'after_description';
alter table postcards drop constraint if exists postcards_extra_images_position_check;
alter table postcards add constraint postcards_extra_images_position_check
    check (extra_images_position in ('after_images','after_description'));
alter table postcards add column if not exists image_thumbnail text;

-- ============================================================
-- Ziyaretçi Analitiği (first-party, StatCounter benzeri)
-- Yazma yalnız "collect" Edge Function (service_role) üzerinden yapılır;
-- tabloda PUBLIC YAZMA İZNİ YOKTUR.
-- ============================================================
create table if not exists page_views (
    id            bigserial primary key,
    created_at    timestamptz not null default now(),
    path          text not null,          -- location.pathname (+ postcard ?id)
    page_type     text,                   -- 'gallery','postcard','tags','about','what-to-do','other'
    referrer      text,
    referrer_host text,                    -- ayrıştırılmış alan adı ('' = direkt)
    source        text,                    -- 'direct','search','social','referral' (+ utm_source)
    utm_source    text,
    utm_medium    text,
    utm_campaign  text,
    country       text,
    city          text,
    region        text,
    browser       text,
    os            text,
    device_type   text,                    -- 'mobile' | 'tablet' | 'desktop'
    language      text,
    screen_w      int,
    screen_h      int,
    visitor_id    uuid,                    -- first-party localStorage kimliği (tekil ziyaretçi)
    session_id    uuid,                    -- sessionStorage kimliği (oturum)
    is_bot        boolean default false
);
create index if not exists idx_page_views_created on page_views(created_at desc);
create index if not exists idx_page_views_visitor on page_views(visitor_id);
create index if not exists idx_page_views_path    on page_views(path);

-- Geo önbelleği + basit hız sınırı. Yalnız günlük tuzlanmış IP hash tutulur (ham IP DEĞİL).
create table if not exists geo_cache (
    ip_hash    text primary key,
    day        date not null default current_date,
    country    text,
    city       text,
    region     text,
    hits       int  default 1,
    updated_at timestamptz default now()
);
create index if not exists idx_geo_cache_day on geo_cache(day);

alter table page_views enable row level security;
alter table geo_cache  enable row level security;

-- page_views: yalnız giriş yapmış admin OKUR ve SİLER. Public/anon insert YOK.
-- (Yazmayı service_role yapar; service_role RLS'i baypas eder, policy gerekmez.)
drop policy if exists "pv read"   on page_views;
drop policy if exists "pv delete" on page_views;
create policy "pv read"   on page_views for select to authenticated using (true);
create policy "pv delete" on page_views for delete to authenticated using (true);

-- geo_cache: hiçbir client policy'si yok → RLS anon/authenticated tüm erişimi bloklar.
-- Yalnız service_role (Edge Function) erişebilir.

-- ------------------------------------------------------------
-- Özet fonksiyonu: tek çağrıda tüm agregalar (ham satır telden geçmez).
-- Saat/gün kovaları Europe/Istanbul yerel saatine göre.
-- ------------------------------------------------------------
create or replace function stats(from_ts timestamptz, to_ts timestamptz, exclude_bots boolean default true)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with base as (
    select *
    from page_views
    where created_at >= from_ts and created_at < to_ts
      and (exclude_bots is false or is_bot = false)
  )
  select jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'views',    count(*),
        'visitors', count(distinct visitor_id),
        'sessions', count(distinct session_id)
      ) from base
    ),
    'timeseries', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'views', v, 'visitors', vis) order by d), '[]'::jsonb)
      from (
        select (created_at at time zone 'Europe/Istanbul')::date as d,
               count(*) as v, count(distinct visitor_id) as vis
        from base group by 1
      ) t
    ),
    'by_hour', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'views', v) order by h), '[]'::jsonb)
      from (
        select extract(hour from (created_at at time zone 'Europe/Istanbul'))::int as h, count(*) as v
        from base group by 1
      ) t
    ),
    'top_pages',     (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(path,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 20) s),
    'top_referrers', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(referrer_host,''),'(direkt)') key, count(*) v from base group by 1 order by v desc limit 15) s),
    'top_sources',   (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(source,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 10) s),
    'top_countries', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(country,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 15) s),
    'top_cities',    (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(city,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 15) s),
    'browsers',      (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(browser,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 10) s),
    'os',            (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(os,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 10) s),
    'devices',       (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(device_type,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 5) s),
    'languages',     (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'views', v) order by v desc), '[]'::jsonb) from (select coalesce(nullif(language,''),'(bilinmiyor)') key, count(*) v from base group by 1 order by v desc limit 10) s)
  );
$$;

revoke all     on function stats(timestamptz, timestamptz, boolean) from anon, public;
grant  execute on function stats(timestamptz, timestamptz, boolean) to authenticated;
