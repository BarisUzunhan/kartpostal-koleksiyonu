// ============================================================
// collect — Ziyaretçi analitiği yazma geçidi (Supabase Edge Function, Deno)
//
// Tarayıcı doğrudan Supabase'e YAZMAZ; bu fonksiyona POST eder. Fonksiyon
// doğrular, botu işaretler, ülke/şehir'i sunucu tarafında çözer (ham IP
// SAKLANMAZ) ve service_role ile page_views tablosuna yazar. Tabloda public
// yazma izni yoktur; delik bu şekilde kapalıdır.
//
// Deploy (ikisinden biri):
//   supabase functions deploy collect --no-verify-jwt
//   ya da Supabase Dashboard > Edge Functions > New function (verify JWT: OFF)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Yalnız bu host'lardan gelen istekler kabul edilir (kötüye kullanım filtresi)
const ALLOWED_HOSTS = new Set([
  'baskatopraklarinrenkleri.b-uzunhan.workers.dev',
  'colorsofotherlands.com',
  'www.colorsofotherlands.com',
  'localhost',
  '127.0.0.1',
]);

const DAILY_IP_CAP = 1000; // aynı IP'den günde yazılabilecek max kayıt (kötüye kullanım tavanı)
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|slackbot|vkshare|whatsapp|telegram|preview|monitor|scan|headless|python-requests|curl|wget/i;

const cors = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Content-Type': 'application/json',
});

const today = () => new Date().toISOString().slice(0, 10);

function hostOf(u?: string | null): string {
  if (!u) return '';
  try { return new URL(u).hostname; } catch { return ''; }
}

function clip(s: unknown, n: number): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t ? t.slice(0, n) : null;
}

function isUuid(s: unknown): boolean {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function posInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n | 0, 20000) : null;
}

// Ham IP saklanmaz: günlük tuzlanmış (date+IP) SHA-256'nın ilk 16 baytı
async function ipHash(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${today()}:${ip}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST')    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: cors(origin) });

  // 1) Origin/Referer allowlist
  const reqHost = hostOf(origin) || hostOf(req.headers.get('referer'));
  if (reqHost && !ALLOWED_HOSTS.has(reqHost)) {
    return new Response(JSON.stringify({ error: 'origin' }), { status: 403, headers: cors(origin) });
  }

  // 2) Payload doğrulama
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'json' }), { status: 400, headers: cors(origin) }); }

  const path = clip(body.path, 300);
  if (!path) return new Response(JSON.stringify({ error: 'path' }), { status: 400, headers: cors(origin) });

  // 3) Bot tespiti
  const ua = req.headers.get('user-agent') || '';
  const is_bot = BOT_RE.test(ua);

  // 4) Geo çözümü + hız sınırı (ham IP saklanmadan, günlük tuzlu hash ile)
  let country: string | null = null, city: string | null = null, region: string | null = null;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (ip) {
    const h = await ipHash(ip);
    const { data: cached } = await admin.from('geo_cache').select('*').eq('ip_hash', h).maybeSingle();
    if (cached && cached.day === today()) {
      if (cached.hits >= DAILY_IP_CAP) {
        return new Response(JSON.stringify({ error: 'rate' }), { status: 429, headers: cors(origin) });
      }
      country = cached.country; city = cached.city; region = cached.region;
      await admin.from('geo_cache').update({ hits: cached.hits + 1, updated_at: new Date().toISOString() }).eq('ip_hash', h);
    } else {
      try {
        const r = await fetch(`https://ipwho.is/${ip}`);
        const g = await r.json();
        if (g && g.success !== false) {
          country = g.country || g.country_code || null;
          city = g.city || null;
          region = g.region || null;
        }
      } catch { /* geo yoksa null kalır */ }
      await admin.from('geo_cache').upsert({ ip_hash: h, day: today(), country, city, region, hits: 1, updated_at: new Date().toISOString() });
    }
  }

  // 5) service_role ile yaz (RLS baypas — public insert izni yok)
  const row = {
    path,
    page_type:     clip(body.page_type, 40),
    referrer:      clip(body.referrer, 600),
    referrer_host: clip(body.referrer_host, 200),
    source:        clip(body.source, 40),
    utm_source:    clip(body.utm_source, 100),
    utm_medium:    clip(body.utm_medium, 100),
    utm_campaign:  clip(body.utm_campaign, 150),
    country, city, region,
    browser:       clip(body.browser, 40),
    os:            clip(body.os, 40),
    device_type:   ['mobile', 'tablet', 'desktop'].includes(body.device_type as string) ? body.device_type : null,
    language:      clip(body.language, 20),
    screen_w:      posInt(body.screen_w),
    screen_h:      posInt(body.screen_h),
    visitor_id:    isUuid(body.visitor_id) ? body.visitor_id : null,
    session_id:    isUuid(body.session_id) ? body.session_id : null,
    is_bot,
  };

  const { error } = await admin.from('page_views').insert(row);
  if (error) return new Response(JSON.stringify({ error: 'db' }), { status: 500, headers: cors(origin) });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors(origin) });
});
