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
