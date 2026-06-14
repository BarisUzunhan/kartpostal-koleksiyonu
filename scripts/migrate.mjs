/**
 * migrate.mjs — WordPress SQL → Supabase Migration (v2)
 *
 * Kullanım:
 *   node scripts/migrate.mjs           # gerçek yükleme
 *   node scripts/migrate.mjs --dry-run # sadece parse et, upload etme
 *
 * Gereksinimler:
 *   .env dosyasında:
 *     SUPABASE_URL=https://xxxxx.supabase.co
 *     SERVICE_ROLE=sb_secret_...
 *
 *   npm install (@supabase/supabase-js, sharp)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const ESKİ      = path.resolve(ROOT, 'EskiSiteDatalari');
const SQL_PATH  = path.join(ESKİ, 'maviatlas_wrdp3.sql');
const UPLOADS_DIR = path.join(ESKİ, 'colorsofotherlands', 'wp-content', 'uploads');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Ortam değişkenleri ──────────────────────────────────────────────────────
function loadEnv() {
    const envPath = path.join(ROOT, '.env');
    if (!existsSync(envPath)) {
        console.error('❌  .env dosyası bulunamadı.');
        process.exit(1);
    }
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const [k, ...rest] = line.split('=');
        if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    }
}

// ── SQL parser (karakter tabanlı — tüm blokları yakalar) ───────────────────
// MySQL dökümünde her tablo için 1-N ayrı INSERT bloğu olabilir.
// Regex tabanlı çözümün "INSERT" kelimesini tüketmesi nedeniyle bloklar atlanıyordu.
// Bu versiyon: string arama + tırnak-farkında `;` bulma ile tüm blokları okur.

function extractTableInserts(sql, tableName) {
    const rows  = [];
    const marker = `INSERT INTO \`${tableName}\``;
    let pos = 0;

    while (true) {
        // Her INSERT INTO `tableName` konumunu bul
        const insertIdx = sql.indexOf(marker, pos);
        if (insertIdx === -1) break;

        // VALUES anahtar kelimesini bul (aynı INSERT içinde)
        const valuesIdx = sql.indexOf('VALUES', insertIdx + marker.length);
        if (valuesIdx === -1) { pos = insertIdx + marker.length; continue; }

        // VALUES'dan sonraki ilk '(' konumunu bul (blok başlangıcı)
        let blockStart = valuesIdx + 6;
        while (blockStart < sql.length && sql[blockStart] !== '(') blockStart++;
        if (blockStart >= sql.length) break;

        // Tırnak-farkında ';' araması ile INSERT'in sonunu bul
        let i = blockStart;
        let inString = false;
        let escape   = false;

        while (i < sql.length) {
            const c = sql[i];
            if (escape) { escape = false; i++; continue; }
            if (c === '\\' && inString) { escape = true; i++; continue; }
            if (c === "'" && !inString) { inString = true;  i++; continue; }
            if (c === "'" &&  inString) { inString = false; i++; continue; }
            if (c === ';' && !inString) break;
            i++;
        }

        const block = sql.slice(blockStart, i);
        rows.push(...parseValueBlock(block));
        pos = i + 1; // ';' sonrasından devam et
    }

    return rows;
}

function parseValueBlock(block) {
    const rows = [];
    let i = 0;
    const n = block.length;

    while (i < n) {
        // Satır başlangıcı '('
        while (i < n && block[i] !== '(') i++;
        if (i >= n) break;
        i++; // '(' atla

        const fields = [];
        let cur = '';

        while (i < n) {
            const c = block[i];

            if (c === '\\') {
                i++;
                const esc = block[i] || '';
                const map = { n: '\n', r: '\r', t: '\t', "'": "'", '"': '"', '\\': '\\' };
                cur += map[esc] ?? esc;
                i++;
            } else if (c === "'") {
                // String literal
                i++;
                while (i < n) {
                    const sc = block[i];
                    if (sc === '\\') {
                        i++;
                        const esc = block[i] || '';
                        const map = { n: '\n', r: '\r', t: '\t', "'": "'", '"': '"', '\\': '\\' };
                        cur += map[esc] ?? esc;
                        i++;
                    } else if (sc === "'") {
                        i++; break;
                    } else {
                        cur += sc; i++;
                    }
                }
            } else if (c === ',') {
                fields.push(cur); cur = ''; i++;
            } else if (c === ')') {
                fields.push(cur); i++; break;
            } else {
                cur += c; i++;
            }
        }

        if (fields.length) {
            rows.push(fields.map(f => {
                f = f.trim();
                return f === 'NULL' ? null : f;
            }));
        }

        // Satırlar arası ',' ve boşluk atla
        while (i < n && (block[i] === ',' || block[i] === '\n' || block[i] === '\r' || block[i] === ' ')) i++;
    }

    return rows;
}

// ── Ülke tespiti ────────────────────────────────────────────────────────────
// Öncelik: 1) marker.address son segmenti  2) koordinat bbox  3) etiket

const EN_TO_TR = {
    'Turkey': 'Türkiye', 'Germany': 'Almanya', 'France': 'Fransa', 'Spain': 'İspanya',
    'Italy': 'İtalya', 'Greece': 'Yunanistan', 'England': 'İngiltere',
    'United Kingdom': 'İngiltere', 'UK': 'İngiltere',
    'USA': 'ABD', 'America': 'ABD', 'US': 'ABD', 'United States': 'ABD',
    'Japan': 'Japonya', 'China': 'Çin', 'India': 'Hindistan', 'Brazil': 'Brezilya',
    'Egypt': 'Mısır', 'Morocco': 'Fas', 'Portugal': 'Portekiz', 'Netherlands': 'Hollanda',
    'Belgium': 'Belçika', 'Switzerland': 'İsviçre', 'Austria': 'Avusturya',
    'Czech Republic': 'Çekya', 'Hungary': 'Macaristan', 'Poland': 'Polonya',
    'Romania': 'Romanya', 'Bulgaria': 'Bulgaristan', 'Croatia': 'Hırvatistan',
    'Serbia': 'Sırbistan', 'Bosnia-Hercegovina': 'Bosna-Hersek', 'Bosnia': 'Bosna-Hersek',
    'Slovakia': 'Slovakya', 'Slovenia': 'Slovenya', 'Russia': 'Rusya',
    'Ukraine': 'Ukrayna', 'Sweden': 'İsveç', 'Norway': 'Norveç', 'Denmark': 'Danimarka',
    'Finland': 'Finlandiya', 'Ireland': 'İrlanda', 'Scotland': 'İskoçya',
    'Australia': 'Avustralya', 'New Zealand': 'Yeni Zelanda', 'Canada': 'Kanada',
    'Mexico': 'Meksika', 'Argentina': 'Arjantin', 'Chile': 'Şili', 'Peru': 'Peru',
    'Colombia': 'Kolombiya', 'Cuba': 'Küba', 'Thailand': 'Tayland', 'Vietnam': 'Vietnam',
    'Cambodia': 'Kamboçya', 'Indonesia': 'Endonezya', 'Malaysia': 'Malezya',
    'Singapore': 'Singapur', 'South Korea': 'Güney Kore', 'Korea': 'Güney Kore',
    'Taiwan': 'Tayvan', 'Iran': 'İran', 'Iraq': 'Irak', 'Syria': 'Suriye',
    'Lebanon': 'Lübnan', 'Jordan': 'Ürdün', 'Israel': 'İsrail',
    'Saudi Arabia': 'Suudi Arabistan', 'UAE': 'BAE', 'Qatar': 'Katar',
    'Kuwait': 'Kuveyt', 'Bahrain': 'Bahreyn', 'Pakistan': 'Pakistan',
    'Bangladesh': 'Bangladeş', 'Sri Lanka': 'Sri Lanka', 'Nepal': 'Nepal',
    'Afghanistan': 'Afganistan', 'Kenya': 'Kenya', 'Tanzania': 'Tanzanya',
    'Ethiopia': 'Etiyopya', 'Nigeria': 'Nijerya', 'Ghana': 'Gana',
    'Senegal': 'Senegal', 'South Africa': 'Güney Afrika', 'Mozambique': 'Mozambik',
    'Zanzibar': 'Zanzibar', 'Tunisia': 'Tunus', 'Algeria': 'Cezayir',
    'Azerbaijan': 'Azerbaycan', 'Georgia': 'Gürcistan', 'Armenia': 'Ermenistan',
    'Kazakhstan': 'Kazakistan', 'Uzbekistan': 'Özbekistan', 'Myanmar': 'Myanmar',
    'Laos': 'Laos', 'Philippines': 'Filipinler', 'Luxembourg': 'Lüksemburg',
    'Malta': 'Malta', 'Cyprus': 'Kıbrıs', 'Iceland': 'İzlanda',
    'Latvia': 'Letonya', 'Lithuania': 'Litvanya', 'Estonia': 'Estonya',
    'Belarus': 'Belarus', 'Moldova': 'Moldova', 'Albania': 'Arnavutluk',
    'Macedonia': 'Kuzey Makedonya', 'Kosovo': 'Kosova', 'Montenegro': 'Karadağ',
    'San Marino': 'San Marino', 'North Carolina': 'ABD', 'New York': 'ABD',
    'Birleşik Devletler': 'ABD', 'Birleşik Arap Emirlikleri': 'BAE',
    'Hồ Chí Minh': 'Vietnam',
    // Kıta/bölge → null (ülke değil)
    'Europe': null, 'Asia': null, 'Asya': null, 'Avrupa': null, 'America': null, 'Amerika': null,
};

const TR_COUNTRY_NAMES = new Set([
    'Türkiye', 'Almanya', 'Fransa', 'İspanya', 'İtalya', 'Yunanistan', 'İngiltere',
    'ABD', 'Japonya', 'Çin', 'Hindistan', 'Brezilya', 'Mısır', 'Fas', 'Portekiz',
    'Hollanda', 'Belçika', 'İsviçre', 'Avusturya', 'Çekya', 'Macaristan', 'Polonya',
    'Romanya', 'Bulgaristan', 'Hırvatistan', 'Sırbistan', 'Bosna-Hersek', 'Slovakya',
    'Slovenya', 'Rusya', 'Ukrayna', 'İsveç', 'Norveç', 'Danimarka', 'Finlandiya',
    'İrlanda', 'İskoçya', 'Avustralya', 'Yeni Zelanda', 'Kanada', 'Meksika',
    'Arjantin', 'Şili', 'Peru', 'Kolombiya', 'Küba', 'Tayland', 'Vietnam',
    'Kamboçya', 'Endonezya', 'Malezya', 'Singapur', 'Güney Kore', 'İran', 'Irak',
    'Suriye', 'Lübnan', 'Ürdün', 'İsrail', 'Suudi Arabistan', 'BAE', 'Katar',
    'Kuveyt', 'Bahreyn', 'Pakistan', 'Bangladeş', 'Sri Lanka', 'Nepal',
    'Kenya', 'Tanzanya', 'Etiyopya', 'Nijerya', 'Gana', 'Senegal', 'Güney Afrika',
    'Zanzibar', 'Tunus', 'Cezayir', 'Azerbaycan', 'Gürcistan', 'Ermenistan',
    'Kazakistan', 'Özbekistan', 'Myanmar', 'Laos', 'Filipinler', 'Tayvan',
    'Lüksemburg', 'Malta', 'Kıbrıs', 'İzlanda', 'Letonya', 'Litvanya', 'Estonya',
    'Belarus', 'Moldova', 'Arnavutluk', 'Kuzey Makedonya', 'Kosova', 'Karadağ',
    'Mozambik', 'San Marino', 'Kuzey Kıbrıs',
]);

// marker.address alanından ülke çıkarma
// Örn: "Casa Batlló, Passeig de Gràcia, Barselona, İspanya" → "İspanya"
function countryFromAddress(address) {
    if (!address || !address.trim()) return null;
    const segments = address.split(',').map(s => s.trim()).filter(Boolean);
    // Son segmentten geriye doğru ülke ara
    for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        if (TR_COUNTRY_NAMES.has(seg)) return seg;
        if (EN_TO_TR[seg] !== undefined) return EN_TO_TR[seg] || null;
    }
    return null;
}

const COUNTRY_BBOX = [
    { name: 'Türkiye',      lat: [36, 42],  lng: [26, 45] },
    { name: 'Almanya',      lat: [47, 55],  lng: [6, 15] },
    { name: 'Fransa',       lat: [42, 51],  lng: [-5, 8] },
    { name: 'İspanya',      lat: [36, 44],  lng: [-9, 4] },
    { name: 'İtalya',       lat: [37, 47],  lng: [7, 19] },
    { name: 'Yunanistan',   lat: [35, 42],  lng: [20, 26] },
    { name: 'İngiltere',    lat: [50, 59],  lng: [-8, 2] },
    { name: 'Portekiz',     lat: [37, 42],  lng: [-9, -6] },
    { name: 'Hollanda',     lat: [51, 53],  lng: [4, 7] },
    { name: 'Belçika',      lat: [50, 51],  lng: [3, 6] },
    { name: 'İsviçre',      lat: [46, 48],  lng: [6, 10] },
    { name: 'Avusturya',    lat: [47, 49],  lng: [10, 17] },
    { name: 'Çekya',        lat: [49, 51],  lng: [12, 19] },
    { name: 'Macaristan',   lat: [46, 48],  lng: [16, 23] },
    { name: 'Polonya',      lat: [49, 55],  lng: [14, 24] },
    { name: 'Romanya',      lat: [44, 48],  lng: [22, 30] },
    { name: 'Bulgaristan',  lat: [42, 44],  lng: [22, 28] },
    { name: 'Hırvatistan',  lat: [43, 46],  lng: [14, 19] },
    { name: 'Sırbistan',    lat: [42, 46],  lng: [19, 23] },
    { name: 'Bosna-Hersek', lat: [42, 45],  lng: [16, 20] },
    { name: 'Slovakya',     lat: [48, 50],  lng: [17, 22] },
    { name: 'Rusya',        lat: [41, 82],  lng: [27, 180] },
    { name: 'Ukrayna',      lat: [44, 53],  lng: [22, 40] },
    { name: 'İsveç',        lat: [56, 70],  lng: [11, 25] },
    { name: 'Norveç',       lat: [57, 72],  lng: [4, 31] },
    { name: 'Danimarka',    lat: [55, 58],  lng: [8, 15] },
    { name: 'Finlandiya',   lat: [60, 70],  lng: [20, 32] },
    { name: 'İrlanda',      lat: [51, 55],  lng: [-10, -6] },
    { name: 'Japonya',      lat: [31, 46],  lng: [130, 146] },
    { name: 'Güney Kore',   lat: [34, 38],  lng: [126, 130] },
    { name: 'Çin',          lat: [18, 54],  lng: [73, 135] },
    { name: 'Hindistan',    lat: [8, 37],   lng: [68, 97] },
    { name: 'Bangladeş',    lat: [21, 27],  lng: [88, 93] },
    { name: 'Pakistan',     lat: [24, 37],  lng: [61, 77] },
    { name: 'Tayland',      lat: [6, 21],   lng: [98, 106] },
    { name: 'Vietnam',      lat: [8, 24],   lng: [102, 110] },
    { name: 'Endonezya',    lat: [-11, 6],  lng: [95, 141] },
    { name: 'Malezya',      lat: [1, 7],    lng: [100, 119] },
    { name: 'Filipinler',   lat: [5, 21],   lng: [117, 127] },
    { name: 'Singapur',     lat: [1.2, 1.5],lng: [103, 104] },
    { name: 'Mısır',        lat: [22, 32],  lng: [25, 37] },
    { name: 'Fas',          lat: [28, 36],  lng: [-13, -1] },
    { name: 'Tunus',        lat: [30, 37],  lng: [8, 12] },
    { name: 'Cezayir',      lat: [19, 37],  lng: [-8, 12] },
    { name: 'Tanzanya',     lat: [-12, -1], lng: [29, 41] },
    { name: 'Kenya',        lat: [-5, 5],   lng: [34, 42] },
    { name: 'Etiyopya',     lat: [3, 15],   lng: [33, 48] },
    { name: 'Güney Afrika', lat: [-35, -22],lng: [16, 33] },
    { name: 'Nijerya',      lat: [4, 14],   lng: [3, 15] },
    { name: 'Suudi Arabistan', lat: [16, 32], lng: [36, 56] },
    { name: 'BAE',          lat: [22, 26],  lng: [51, 56] },
    { name: 'İsrail',       lat: [29, 33],  lng: [34, 36] },
    { name: 'Ürdün',        lat: [29, 33],  lng: [35, 39] },
    { name: 'Lübnan',       lat: [33, 34],  lng: [35, 37] },
    { name: 'Suriye',       lat: [33, 37],  lng: [36, 42] },
    { name: 'Irak',         lat: [29, 38],  lng: [39, 49] },
    { name: 'İran',         lat: [25, 40],  lng: [44, 64] },
    { name: 'Azerbaycan',   lat: [38, 42],  lng: [45, 51] },
    { name: 'Gürcistan',    lat: [41, 43],  lng: [40, 47] },
    { name: 'Ermenistan',   lat: [38, 41],  lng: [43, 47] },
    { name: 'Kazakistan',   lat: [41, 56],  lng: [51, 87] },
    { name: 'ABD',          lat: [24, 50],  lng: [-125, -66] },
    { name: 'Kanada',       lat: [42, 84],  lng: [-141, -52] },
    { name: 'Meksika',      lat: [15, 33],  lng: [-118, -87] },
    { name: 'Küba',         lat: [20, 23],  lng: [-85, -74] },
    { name: 'Brezilya',     lat: [-34, 5],  lng: [-74, -35] },
    { name: 'Arjantin',     lat: [-56, -22],lng: [-73, -53] },
    { name: 'Şili',         lat: [-56, -18],lng: [-75, -67] },
    { name: 'Peru',         lat: [-18, 0],  lng: [-82, -68] },
    { name: 'Avustralya',   lat: [-44, -10],lng: [114, 155] },
    { name: 'Yeni Zelanda', lat: [-47, -34],lng: [166, 178] },
    { name: 'Kıbrıs',       lat: [34, 36],  lng: [32, 34] },
    { name: 'İzlanda',      lat: [63, 67],  lng: [-25, -13] },
    { name: 'Zanzibar',     lat: [-6.5, -5.7], lng: [39.1, 39.8] },
    { name: 'San Marino',   lat: [43.8, 44.0], lng: [12.3, 12.6] },
];

function countryFromLatLng(lat, lng) {
    if (lat == null || lng == null) return null;
    const matches = COUNTRY_BBOX.filter(c =>
        lat >= c.lat[0] && lat <= c.lat[1] && lng >= c.lng[0] && lng <= c.lng[1]
    );
    if (matches.length === 1) return matches[0].name;
    if (matches.length === 0) return null;
    return { ambiguous: matches.map(m => m.name) };
}

function countryFromTags(tags) {
    for (const tag of tags) {
        if (TR_COUNTRY_NAMES.has(tag)) return tag;
        if (EN_TO_TR[tag] !== undefined) return EN_TO_TR[tag] || null;
    }
    return null;
}

// ── Dil tespiti ──────────────────────────────────────────────────────────────
const TR_CHARS = /[çğışöüÇĞİŞÖÜ]/;
const TR_WORDS = /\b(ve|bir|bu|da|de|ile|için|olan|gibi|ama|çok|ne|kim|biz|ben|sen|var|yok|geldi|gitti|sevgiler|selamlar|sana|bana|seni|beni|çünkü|nasıl|neden|evet|hayır|tamam)\b/i;
const EN_WORDS = /\b(the|and|is|are|was|were|have|has|with|from|dear|love|hello|greetings|my|your|we|our|this|that|hope|wish|miss|beautiful|wonderful|when|here|come|will|would|should|could)\b/i;

function detectLang(text) {
    if (!text || !text.trim()) return 'unknown';
    const hasTR = TR_CHARS.test(text) || TR_WORDS.test(text);
    const hasEN = EN_WORDS.test(text);
    if (hasTR && !hasEN) return 'tr';
    if (hasEN && !hasTR) return 'en';
    if (hasTR && hasEN) return 'mixed';
    return /[a-zA-Z]/.test(text) ? 'en' : 'unknown';
}

function splitDescriptions(rawContent) {
    let text = rawContent
        .replace(/\[mapsmarker[^\]]*\]/g, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    const paragraphs = text
        .split(/\n{2,}/)
        .map(p => p.replace(/\n/g, ' ').trim())
        .filter(p => p.length > 0);

    if (paragraphs.length === 0) return { description: '', description_en: '' };

    const trParas = [], enParas = [];

    for (const p of paragraphs) {
        // Kısa metinler (imza, selam, <25 karakter) ayrı alana bölünmez —
        // içinde bulunduğu bloğun diline eklenir veya EN'e eklenir.
        if (p.length < 25) {
            // Açık TR karakteri varsa TR'ye, yoksa şimdilik beklet
            if (TR_CHARS.test(p) || TR_WORDS.test(p)) trParas.push(p);
            else enParas.push(p);
            continue;
        }
        const lang = detectLang(p);
        if (lang === 'tr') trParas.push(p);
        else if (lang === 'en') enParas.push(p);
        else if (lang === 'mixed') {
            if (TR_CHARS.test(p)) trParas.push(p); else enParas.push(p);
        } else enParas.push(p); // unknown → EN
    }

    return {
        description:    trParas.join('\n\n'),
        description_en: enParas.join('\n\n'),
    };
}

// ── Görsel yardımcıları ──────────────────────────────────────────────────────
function resolveUploadPath(relativePath) {
    if (!relativePath) return null;
    const full = path.join(UPLOADS_DIR, relativePath);
    return existsSync(full) ? full : null;
}

function extractImgSrcs(htmlContent) {
    const pattern = /src=["']https?:\/\/[^"']*\/wp-content\/uploads\/([^"']+)["']/g;
    const srcs = [];
    let m;
    while ((m = pattern.exec(htmlContent)) !== null) {
        const rel = m[1];
        // Boyutlandırılmış türevleri atla (-300x199 gibi)
        if (!/-\d+x\d+\.(jpg|jpeg|png|gif|webp)$/i.test(rel)) srcs.push(rel);
    }
    return srcs;
}

async function optimizeImage(inputPath) {
    return sharp(inputPath)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
}

async function uploadToStorage(supabase, buf, storagePath, mime) {
    const { error } = await supabase.storage
        .from('postcards')
        .upload(storagePath, buf, { contentType: mime, upsert: true });
    if (error) throw new Error(`Storage upload hatası (${storagePath}): ${error.message}`);
    const { data } = supabase.storage.from('postcards').getPublicUrl(storagePath);
    return data.publicUrl;
}

async function uploadImagePair(supabase, localPath, baseName) {
    const origBuf = readFileSync(localPath);
    let optBuf;
    try { optBuf = await optimizeImage(localPath); }
    catch { optBuf = origBuf; }

    const mime = localPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const ext  = localPath.toLowerCase().endsWith('.png') ? '.png' : '.jpg';

    const [optimizedUrl, originalUrl] = await Promise.all([
        uploadToStorage(supabase, optBuf, `optimized/${baseName}${ext}`, 'image/jpeg'),
        uploadToStorage(supabase, origBuf, `original/${baseName}${ext}`, mime),
    ]);
    return { optimizedUrl, originalUrl };
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
    loadEnv();

    const SUPABASE_URL  = process.env.SUPABASE_URL;
    const SERVICE_ROLE  = process.env.SERVICE_ROLE;

    let supabase = null;
    if (!DRY_RUN) {
        if (!SUPABASE_URL || !SERVICE_ROLE) {
            console.error('❌  SUPABASE_URL veya SERVICE_ROLE eksik (.env kontrol edin)');
            process.exit(1);
        }
        supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }

    // ── SQL yükle ────────────────────────────────────────────────────────────
    console.log('📖  SQL dosyası okunuyor...');
    const sql = readFileSync(SQL_PATH, 'utf8');
    console.log(`   → ${(sql.length / 1e6).toFixed(1)} MB okundu`);

    // ── Tabloları ayrıştır ───────────────────────────────────────────────────
    console.log('🔍  Tablolar ayrıştırılıyor...');

    // wp_posts sütun sırası (0-tabanlı):
    // 0:ID  1:author  2:date  3:date_gmt  4:content  5:title
    // 6:excerpt  7:status  8:comment_status  9:ping_status  10:password
    // 11:name(slug)  12:to_ping  13:pinged  14:modified  15:modified_gmt
    // 16:content_filtered  17:parent  18:guid  19:menu_order  20:type  21:mime  22:comment_count
    const allPosts       = extractTableInserts(sql, 'wp_posts');
    const publishedPosts = allPosts.filter(r => r[7] === 'publish' && r[20] === 'post');
    console.log(`   → wp_posts: ${allPosts.length} toplam, ${publishedPosts.length} yayınlanmış post`);

    // wp_postmeta: 0:meta_id  1:post_id  2:meta_key  3:meta_value
    const allPostmeta = extractTableInserts(sql, 'wp_postmeta');
    const postmetaByPostId = {};
    for (const r of allPostmeta) {
        const pid = r[1];
        if (!postmetaByPostId[pid]) postmetaByPostId[pid] = {};
        if (!postmetaByPostId[pid][r[2]]) postmetaByPostId[pid][r[2]] = [];
        postmetaByPostId[pid][r[2]].push(r[3]);
    }
    // attachment dosya yolları: post_id → relative_path
    const attachmentFilePath = {};
    for (const r of allPostmeta) {
        if (r[2] === '_wp_attached_file') attachmentFilePath[r[1]] = r[3];
    }
    console.log(`   → wp_postmeta: ${allPostmeta.length} satır (${Object.keys(attachmentFilePath).length} attachment)`);

    // wp_leafletmapsmarker_markers sütun sırası:
    // 0:id  1:markername  2:basemap  3:layer  4:lat  5:lon  6:icon  7:popuptext
    // 8:zoom  9:openpopup  10:mapwidth  11:mapwidthunit  12:mapheight  13:panel
    // 14:createdby  15:createdon  16:updatedby  17:updatedon  18:controlbox
    // 19-32: overlays/wms alanları  33:kml_timestamp  34:address  35:gpx_url  36:gpx_panel
    const allMarkers = extractTableInserts(sql, 'wp_leafletmapsmarker_markers');
    const markerById = {};
    for (const r of allMarkers) {
        markerById[r[0]] = {
            lat:     parseFloat(r[4]),
            lng:     parseFloat(r[5]),
            name:    r[1],
            address: r[34] || '',   // ← doğru index (önceki kodda r[35] hataydı)
        };
    }
    console.log(`   → markers: ${allMarkers.length} satır`);

    // wp_terms: 0:term_id  1:name  2:slug  3:term_group
    const allTerms = extractTableInserts(sql, 'wp_terms');
    const termById = {};
    for (const r of allTerms) termById[r[0]] = r[1];
    console.log(`   → wp_terms: ${allTerms.length} satır`);

    // wp_term_taxonomy: 0:tt_id  1:term_id  2:taxonomy  ...
    const allTaxonomy = extractTableInserts(sql, 'wp_term_taxonomy');
    const ttById = {};
    for (const r of allTaxonomy) ttById[r[0]] = { termId: r[1], taxonomy: r[2] };
    console.log(`   → wp_term_taxonomy: ${allTaxonomy.length} satır`);

    // wp_term_relationships: 0:object_id  1:tt_id  2:term_order
    const allRelations = extractTableInserts(sql, 'wp_term_relationships');
    const tagsByPostId = {};
    for (const r of allRelations) {
        const tt = ttById[r[1]];
        if (!tt) continue;
        if (tt.taxonomy !== 'post_tag' && tt.taxonomy !== 'category') continue;
        const name = termById[tt.termId];
        if (!name || name === 'Kartpostallar') continue;
        if (!tagsByPostId[r[0]]) tagsByPostId[r[0]] = [];
        tagsByPostId[r[0]].push(name);
    }
    console.log(`   → term_relationships: ${allRelations.length} satır`);

    // ── Post'ları işle ───────────────────────────────────────────────────────
    console.log('\n🔄  Kartpostallar işleniyor...');

    const stats = {
        total: 0, uploaded: 0, reviewNeeded: 0,
        noCoords: 0, noImage: 0, multiImage: 0,
        countryFromAddress: 0, countryFromCoord: 0,
        countryFromTag: 0, countryUnknown: 0,
    };
    const reviewList = [];

    const sortedPosts = [...publishedPosts].sort((a, b) => a[2].localeCompare(b[2]));

    for (const post of sortedPosts) {
        const postId      = post[0];
        const postDate    = post[2].split(' ')[0];
        const city        = post[5].trim();
        const postContent = post[4] || '';
        const postSlug    = post[11];

        stats.total++;
        const reviewReasons = [];

        // ─ Koordinat ─────────────────────────────────────────────────────────
        const markerMatch = postContent.match(/\[mapsmarker marker="(\d+)"\]/);
        let lat = null, lng = null, markerAddress = '';
        if (markerMatch) {
            const mk = markerById[markerMatch[1]];
            if (mk && !isNaN(mk.lat)) { lat = mk.lat; lng = mk.lng; markerAddress = mk.address || ''; }
        }
        if (lat == null) { reviewReasons.push('no_coords'); stats.noCoords++; }

        // ─ Etiketler ─────────────────────────────────────────────────────────
        const tags = tagsByPostId[postId] || [];

        // ─ Ülke (3 katmanlı) ─────────────────────────────────────────────────
        let country = null;

        // 1) marker.address — en güvenilir (insan girişi, Türkçe ülke adı)
        const addrCountry = countryFromAddress(markerAddress);
        if (addrCountry) { country = addrCountry; stats.countryFromAddress++; }

        // 2) koordinat bbox
        if (!country && lat != null) {
            const coord = countryFromLatLng(lat, lng);
            if (coord && typeof coord === 'string') { country = coord; stats.countryFromCoord++; }
            else if (coord && coord.ambiguous) reviewReasons.push('ambiguous_country');
        }

        // 3) etiketler
        if (!country) {
            const tagC = countryFromTags(tags);
            if (tagC) { country = tagC; stats.countryFromTag++; }
        }

        if (!country) {
            country = 'Bilinmiyor';
            reviewReasons.push('no_country');
            stats.countryUnknown++;
        }

        // ─ Açıklamalar ───────────────────────────────────────────────────────
        const { description, description_en } = splitDescriptions(postContent);
        if (!description && !description_en) reviewReasons.push('no_text');

        // ─ Görseller ─────────────────────────────────────────────────────────
        const meta = postmetaByPostId[postId] || {};
        let frontLocalPath = null, backLocalPath = null;

        // Öne çıkan görsel (featured image)
        const thumbIds = meta['_thumbnail_id'] || [];
        if (thumbIds.length > 0) {
            const rel = attachmentFilePath[thumbIds[0]];
            if (rel) frontLocalPath = resolveUploadPath(rel);
        }

        // post_content içindeki görseller
        const imgSrcs = extractImgSrcs(postContent);

        // Ön yüz yoksa içerikteki ilk görsel
        if (!frontLocalPath && imgSrcs.length > 0) frontLocalPath = resolveUploadPath(imgSrcs[0]);

        // Arka yüz: içerikteki ikinci görsel
        if (imgSrcs.length > 1) backLocalPath = resolveUploadPath(imgSrcs[1]);

        if (!frontLocalPath) { reviewReasons.push('no_image'); stats.noImage++; }

        // thumbnail yokken 2+ görsel → ön/arka belirsiz
        if (imgSrcs.length >= 2 && thumbIds.length === 0) reviewReasons.push('front_back_ambiguous');

        // 3+ görsel → birden fazla kartpostal olabilir
        if (imgSrcs.length >= 3) { reviewReasons.push('multi_image'); stats.multiImage++; }

        // ─ Review ────────────────────────────────────────────────────────────
        const needsReview = reviewReasons.length > 0;
        if (needsReview) {
            stats.reviewNeeded++;
            reviewList.push({
                wp_post_id: parseInt(postId), slug: postSlug, city, country,
                lat, lng, date: postDate, tags, reasons: reviewReasons,
                imgCount: imgSrcs.length, hasThumbnail: thumbIds.length > 0,
                markerAddress,
            });
        }

        // ─ Storage upload ─────────────────────────────────────────────────────
        let imageFront = null, imageBack = null;
        let imageFrontOriginal = null, imageBackOriginal = null;

        if (!DRY_RUN && supabase) {
            const safe = n => n.replace(/[^a-z0-9-]/gi, '-');

            if (frontLocalPath) {
                try {
                    const base = safe(`${postId}-${postSlug || 'front'}`);
                    const { optimizedUrl, originalUrl } = await uploadImagePair(supabase, frontLocalPath, base);
                    imageFront = optimizedUrl;
                    imageFrontOriginal = originalUrl;
                } catch (e) {
                    console.warn(`  ⚠️  Ön görsel yükleme hatası (post ${postId}): ${e.message}`);
                }
            }
            if (backLocalPath) {
                try {
                    const base = safe(`${postId}-${postSlug || 'back'}-back`);
                    const { optimizedUrl, originalUrl } = await uploadImagePair(supabase, backLocalPath, base);
                    imageBack = optimizedUrl;
                    imageBackOriginal = originalUrl;
                } catch (e) {
                    console.warn(`  ⚠️  Arka görsel yükleme hatası (post ${postId}): ${e.message}`);
                }
            }
        }

        // ─ Supabase upsert ────────────────────────────────────────────────────
        const record = {
            wp_post_id:           parseInt(postId),
            slug:                 postSlug,
            city,
            country,
            lat,
            lng,
            date:                 postDate,
            description:          description || null,
            description_en:       description_en || null,
            tags,
            image_front:          imageFront,
            image_back:           imageBack,
            image_front_original: imageFrontOriginal,
            image_back_original:  imageBackOriginal,
            needs_review:         needsReview,
            review_reasons:       reviewReasons,
        };

        if (!DRY_RUN && supabase) {
            const { error } = await supabase
                .from('postcards')
                .upsert(record, { onConflict: 'wp_post_id' });
            if (error) {
                console.error(`  ❌  DB upsert hatası (post ${postId} / ${city}): ${error.message}`);
                continue;
            }
            stats.uploaded++;
        }

        if (stats.total % 25 === 0) {
            process.stdout.write(`   → ${stats.total}/${sortedPosts.length} işlendi...\r`);
        }
    }

    // ── Rapor ─────────────────────────────────────────────────────────────────
    console.log('\n\n' + '═'.repeat(60));
    console.log('✅  Migration tamamlandı!');
    console.log('═'.repeat(60));
    console.log(`📊  Toplam işlenen post : ${stats.total}`);
    if (!DRY_RUN) console.log(`☁️   Supabase'e yüklenen : ${stats.uploaded}`);
    console.log(`\n🗺️   Ülke kaynağı:`);
    console.log(`   marker.address      : ${stats.countryFromAddress}`);
    console.log(`   koordinat bbox      : ${stats.countryFromCoord}`);
    console.log(`   etiket              : ${stats.countryFromTag}`);
    console.log(`   bilinmiyor          : ${stats.countryUnknown}`);
    console.log(`\n🔍  Gözden geçirilecek  : ${stats.reviewNeeded}`);
    console.log(`   └─ Koordinat yok    : ${stats.noCoords}`);
    console.log(`   └─ Görsel yok       : ${stats.noImage}`);
    console.log(`   └─ 3+ görsel        : ${stats.multiImage}`);
    if (DRY_RUN) console.log('\n⚠️   DRY-RUN modu — hiçbir şey yüklenmedi.');

    const reviewPath = path.join(__dirname, 'review-needed.json');
    writeFileSync(reviewPath, JSON.stringify(reviewList, null, 2), 'utf8');
    console.log(`\n📝  ${reviewList.length} şüpheli kayıt → ${reviewPath}`);
    console.log('═'.repeat(60));
}

main().catch(e => { console.error('❌  Hata:', e); process.exit(1); });
