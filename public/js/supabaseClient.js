/* ========================================
   Supabase İstemcisi — Ön Yüz (anon key)
   Anon key herkese açık; RLS güvenliği sağlar.
   ======================================== */

// Supabase JS v2 — CDN
// NOT: Bu değerleri Supabase Dashboard > Settings > API'dan alın.
// Anon key commit edilmesi normaldir (salt-okunur RLS korumalı).
// SERVICE_ROLE key ASLA buraya/repoya girmez.

const SUPABASE_URL = 'https://eyapkqmmagzstdoxprnp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RUi-Qk_i4Cy0Q22JifYLnA_4Hx_PzvO';

// supabase-js CDN'den yükleniyor (html <head>'de):
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
const { createClient } = supabase;

const SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
