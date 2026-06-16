/**
 * migrate-extra-images.mjs
 * WordPress SQL → Supabase: 3+ görselli postlardaki ekstra görselleri aktar.
 *
 * Strateji:
 *   - Her post için içerikteki ilk iki görsel = front + back (migration tarafından
 *     zaten yüklenmiş). Bundan sonraki görseller "extra" sayılır.
 *   - extra_images / extra_images_original alanlarını doldurur.
 *
 * Kullanım:
 *   node scripts/migrate-extra-images.mjs            # gerçek yükleme
 *   node scripts/migrate-extra-images.mjs --dry-run  # sadece listele
 *   node scripts/migrate-extra-images.mjs --force    # dolu olsa da üzerine yaz
 */

import { existsSync, readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const SQL_PATH   = path.join(ROOT, 'EskiSiteDatalari', 'maviatlas_wrdp3.sql');
const UPLOADS_DIR = path.join(ROOT, 'EskiSiteDatalari', 'colorsofotherlands', 'wp-content', 'uploads');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE   = process.argv.includes('--force');

// ── .env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
    const envPath = path.join(ROOT, '.env');
    if (!existsSync(envPath)) { console.error('❌  .env bulunamadı'); process.exit(1); }
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const [k, ...rest] = line.split('=');
        if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    }
}

// ── SQL parser ────────────────────────────────────────────────────────────────
function extractTableInserts(sql, tableName) {
    const rows = [];
    const marker = `INSERT INTO \`${tableName}\``;
    let pos = 0;
    while (true) {
        const insertIdx = sql.indexOf(marker, pos);
        if (insertIdx === -1) break;
        const valuesIdx = sql.indexOf('VALUES', insertIdx + marker.length);
        if (valuesIdx === -1) { pos = insertIdx + marker.length; continue; }
        let blockStart = valuesIdx + 6;
        while (blockStart < sql.length && sql[blockStart] !== '(') blockStart++;
        if (blockStart >= sql.length) break;
        let i = blockStart, inStr = false, esc = false;
        while (i < sql.length) {
            const c = sql[i];
            if (esc) { esc = false; i++; continue; }
            if (c === '\\' && inStr) { esc = true; i++; continue; }
            if (c === "'" && !inStr) { inStr = true;  i++; continue; }
            if (c === "'" &&  inStr) { inStr = false; i++; continue; }
            if (c === ';' && !inStr) break;
            i++;
        }
        rows.push(...parseValueBlock(sql.slice(blockStart, i)));
        pos = i + 1;
    }
    return rows;
}

function parseValueBlock(block) {
    const rows = [];
    let i = 0, n = block.length;
    while (i < n) {
        while (i < n && block[i] !== '(') i++;
        if (i >= n) break;
        i++;
        const fields = [];
        let cur = '';
        while (i < n) {
            const c = block[i];
            if (c === '\\') {
                i++;
                const e = block[i] || '';
                cur += { n:'\n', r:'\r', t:'\t', "'":"'", '"':'"', '\\':'\\' }[e] ?? e;
                i++;
            } else if (c === "'") {
                i++;
                while (i < n) {
                    const sc = block[i];
                    if (sc === '\\') { i++; const e = block[i]||''; cur += {n:'\n',r:'\r',t:'\t',"'":"'",'"':'"','\\':'\\'}[e]??e; i++; }
                    else if (sc === "'") { i++; break; }
                    else { cur += sc; i++; }
                }
            } else if (c === ',') { fields.push(cur); cur = ''; i++; }
            else if (c === ')') { fields.push(cur); i++; break; }
            else { cur += c; i++; }
        }
        if (fields.length) rows.push(fields.map(f => { f = f.trim(); return f === 'NULL' ? null : f; }));
        while (i < n && (block[i] === ',' || block[i] === '\n' || block[i] === '\r' || block[i] === ' ')) i++;
    }
    return rows;
}

// ── Görsel yardımcıları ───────────────────────────────────────────────────────
/**
 * Post içeriğinden sıralı, tam-boyutlu görsel yollarını çıkarır.
 * Href önce (Gutenberg orijinali), sonra src (klasik postlar).
 * Boyut son-ekini normalize eder, basename'e göre dedupe.
 */
function extractImgRels(htmlContent) {
    if (!htmlContent) return [];
    const out   = [];
    const bases = new Set();

    const push = rel => {
        if (!rel) return;
        const norm = rel.replace(/-\d+x\d+(\.(jpe?g|png|gif|webp))$/i, '$1');
        const base = path.basename(norm).toLowerCase();
        if (bases.has(base)) return;
        bases.add(base);
        out.push(norm);
    };

    const hrefPat = /href=["']https?:\/\/[^"']*\/wp-content\/uploads\/([^"']+\.(?:jpe?g|png|gif|webp))["']/gi;
    let m;
    while ((m = hrefPat.exec(htmlContent)) !== null) push(m[1]);

    const srcPat = /src=["']https?:\/\/[^"']*\/wp-content\/uploads\/([^"']+)["']/gi;
    while ((m = srcPat.exec(htmlContent)) !== null) push(m[1]);

    return out;
}

function resolveLocal(rel) {
    if (!rel) return null;
    const full = path.join(UPLOADS_DIR, rel);
    return existsSync(full) ? full : null;
}

function resolveLocalFuzzy(filename) {
    const years  = ['2012','2013','2014','2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2026'];
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    for (const y of years) {
        for (const m of months) {
            const candidate = path.join(UPLOADS_DIR, y, m, filename);
            if (existsSync(candidate)) return candidate;
        }
    }
    const direct = path.join(UPLOADS_DIR, filename);
    if (existsSync(direct)) return direct;
    return null;
}

// ── Supabase upload ───────────────────────────────────────────────────────────
async function optimizeImage(localPath) {
    return sharp(localPath)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
}

async function uploadToStorage(supabase, buf, storagePath, mime) {
    const { error } = await supabase.storage
        .from('postcards')
        .upload(storagePath, buf, { contentType: mime, upsert: true });
    if (error) throw new Error(`Storage hatası (${storagePath}): ${error.message}`);
    const { data } = supabase.storage.from('postcards').getPublicUrl(storagePath);
    return data.publicUrl;
}

async function uploadImagePair(supabase, localPath, baseName) {
    const origBuf = readFileSync(localPath);
    let optBuf;
    try { optBuf = await optimizeImage(localPath); } catch { optBuf = origBuf; }
    const isPng  = localPath.toLowerCase().endsWith('.png');
    const isBmp  = localPath.toLowerCase().endsWith('.bmp');
    const mime   = isPng ? 'image/png' : 'image/jpeg';
    const ext    = isPng ? '.png' : '.jpg';
    // BMP → her zaman JPEG optimize
    const [optimizedUrl, originalUrl] = await Promise.all([
        uploadToStorage(supabase, optBuf, `optimized/${baseName}${ext}`, 'image/jpeg'),
        uploadToStorage(supabase, origBuf, `original/${baseName}${ext}`, isBmp ? 'image/bmp' : mime),
    ]);
    return { optimizedUrl, originalUrl };
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
    loadEnv();

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SERVICE_ROLE;

    let supabase = null;
    if (!DRY_RUN) {
        if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('❌  .env eksik'); process.exit(1); }
        supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }

    // ── SQL yükle ────────────────────────────────────────────────────────────
    console.log('📖  SQL okunuyor...');
    const sql = readFileSync(SQL_PATH, 'utf8');
    console.log(`   → ${(sql.length / 1e6).toFixed(1)} MB\n`);

    // ── wp_posts parse ───────────────────────────────────────────────────────
    console.log('🔍  Tablolar ayrıştırılıyor...');
    const allPosts = extractTableInserts(sql, 'wp_posts');
    const published = allPosts.filter(r => r[7] === 'publish' && r[20] === 'post');
    // 0:ID 4:content 7:status 11:slug 20:type
    console.log(`   → ${published.length} yayınlanmış post`);

    // ── Supabase kayıtları ───────────────────────────────────────────────────
    let existingMap = {};
    if (!DRY_RUN && supabase) {
        console.log('☁️   Supabase sorgulanıyor...');
        const { data, error } = await supabase
            .from('postcards')
            .select('id, wp_post_id, extra_images, slug, city');
        if (error) { console.error('❌', error.message); process.exit(1); }
        for (const row of data) {
            if (row.wp_post_id) existingMap[row.wp_post_id] = row;
        }
        console.log(`   → ${data.length} mevcut kayıt\n`);
    }

    // ── Ekstra görsel tarama ─────────────────────────────────────────────────
    console.log('🔄  Ekstra görseller aranıyor...\n');

    const stats = { total: 0, found: 0, totalExtras: 0, uploaded: 0,
                    uploadedExtras: 0, skipped: 0, error: 0, notInSB: 0 };

    for (const post of published) {
        const wpId       = parseInt(post[0]);
        const postSlug   = post[11];
        const postContent = post[4] || '';

        stats.total++;

        const contentRels = extractImgRels(postContent);
        // İlk 2 görsel = front + back; geri kalanlar = extra
        const extraRels = contentRels.slice(2);
        if (extraRels.length === 0) continue;

        stats.found++;
        stats.totalExtras += extraRels.length;

        if (DRY_RUN) {
            console.log(`  📸  Post ${wpId} (${postSlug}) — ${extraRels.length} ekstra:`);
            for (const rel of extraRels) {
                const base = path.basename(rel);
                const local = resolveLocal(rel) || resolveLocalFuzzy(base);
                console.log(`       ${base} ${local ? '✓ yerel' : '✗ yerel bulunamadı'}`);
            }
            continue;
        }

        // Supabase'de var mı?
        const existing = existingMap[wpId];
        if (!existing) { stats.notInSB++; continue; }

        // Zaten dolu mu?
        if (existing.extra_images && existing.extra_images.length > 0 && !FORCE) {
            stats.skipped++;
            continue;
        }

        const safe = s => s.replace(/[^a-z0-9-]/gi, '-');
        const optUrls  = [];
        const origUrls = [];
        let localOk = 0, localFail = 0;

        for (let idx = 0; idx < extraRels.length; idx++) {
            const rel = extraRels[idx];
            const base = path.basename(rel);
            const localPath = resolveLocal(rel) || resolveLocalFuzzy(base);
            if (!localPath) { localFail++; origUrls.push(null); optUrls.push(null); continue; }

            const bName = safe(`${wpId}-${postSlug}-extra-${idx + 1}`);
            try {
                const { optimizedUrl, originalUrl } = await uploadImagePair(supabase, localPath, bName);
                optUrls.push(optimizedUrl);
                origUrls.push(originalUrl);
                localOk++;
                stats.uploadedExtras++;
            } catch (e) {
                console.error(`  ❌  Upload hatası ${base}: ${e.message}`);
                optUrls.push(null);
                origUrls.push(null);
                stats.error++;
            }
            await new Promise(r => setTimeout(r, 100));
        }

        if (localOk === 0) { stats.notInSB++; continue; }

        console.log(`  📸  ${existing.city || postSlug} (${wpId}) — ${localOk} ekstra yüklendi${localFail ? ` (${localFail} dosya bulunamadı)` : ''}`);
        try {
            const { error } = await supabase
                .from('postcards')
                .update({
                    extra_images:          optUrls.filter(Boolean),
                    extra_images_original: origUrls.filter(Boolean),
                })
                .eq('wp_post_id', wpId);
            if (error) { console.error(`  ❌  DB hatası: ${error.message}`); stats.error++; }
            else { console.log(`  ✅  Güncellendi`); stats.uploaded++; }
        } catch (e) {
            console.error(`  ❌  Hata: ${e.message}`);
            stats.error++;
        }
    }

    // ── Özet ─────────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('📊  ÖZET');
    console.log('═══════════════════════════════════════════');
    console.log(`  İncelenen post         : ${stats.total}`);
    console.log(`  3+ görselli post       : ${stats.found}`);
    console.log(`  Toplam ekstra görsel   : ${stats.totalExtras}`);
    if (DRY_RUN) {
        console.log('\n⚠️   DRY-RUN — gerçek yükleme yapılmadı.');
        console.log('    Yüklemek için: node scripts/migrate-extra-images.mjs');
    } else {
        console.log(`  Zaten dolu (atlandı)   : ${stats.skipped}`);
        console.log(`  Güncellenen post       : ${stats.uploaded}`);
        console.log(`  Yüklenen ekstra görsel : ${stats.uploadedExtras}`);
        console.log(`  Hata                   : ${stats.error}`);
        console.log(`  Supabase'de yok        : ${stats.notInSB}`);
    }
}

main().catch(e => { console.error('❌  Script hatası:', e); process.exit(1); });
