/**
 * fix-thumb-fronts.mjs
 * Featured image'ı _thumb dosyası olan 2 kartpostali düzeltir:
 *   - Post 3128 (argentina): 01_argentina_thumb.jpg → 01_argentina_on.jpg
 *   - Post 4413 (ferhangiseyler-2000): KSGD_Thumb.jpg → içerik ilk görseli
 *
 * Kullanım:
 *   node scripts/fix-thumb-fronts.mjs            # gerçek yükleme
 *   node scripts/fix-thumb-fronts.mjs --dry-run  # sadece önizle
 *   node scripts/fix-thumb-fronts.mjs --force    # dolu olsa da üzerine yaz
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
function extractImgRels(htmlContent) {
    if (!htmlContent) return [];
    const out   = [];
    const bases = new Set();
    const push  = rel => {
        if (!rel) return;
        const norm = rel.replace(/-\d+x\d+(\.(jpe?g|png|gif|webp))$/i, '$1');
        const base = path.basename(norm).toLowerCase();
        if (bases.has(base)) return;
        bases.add(base);
        out.push(norm);
    };
    const hrefPat = /href=["']https?:\/\/[^"']*\/wp-content\/uploads\/([^"']+\.(?:jpe?g|png|gif|webp))["']/gi;
    let m; while ((m = hrefPat.exec(htmlContent)) !== null) push(m[1]);
    const srcPat  = /src=["']https?:\/\/[^"']*\/wp-content\/uploads\/([^"']+)["']/gi;
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

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SERVICE_ROLE;

    let supabase = null;
    if (!DRY_RUN) {
        if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('❌  .env eksik'); process.exit(1); }
        supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }

    console.log('📖  SQL okunuyor...');
    const sql = readFileSync(SQL_PATH, 'utf8');
    console.log(`   → ${(sql.length / 1e6).toFixed(1)} MB\n`);

    const allPosts = extractTableInserts(sql, 'wp_posts');
    const allMeta  = extractTableInserts(sql, 'wp_postmeta');

    // thumb ön-yüzlü postları bul
    const thumbId   = {};  // post_id → thumbnail attach id
    const attachFile = {}; // attach_id → relative path
    for (const r of allMeta) {
        if (r[2] === '_thumbnail_id')   thumbId[r[1]]    = r[3];
        if (r[2] === '_wp_attached_file') attachFile[r[1]] = r[3];
    }

    const published = allPosts.filter(r => r[7] === 'publish' && r[20] === 'post');
    const targets = published.filter(p => {
        const tid = thumbId[p[0]];
        if (!tid) return false;
        const f = attachFile[tid] || '';
        return /_thumb/i.test(f.split('/').pop());
    });

    console.log(`🎯  _thumb ön-yüzlü post: ${targets.length}\n`);

    if (targets.length === 0) {
        console.log('✅  Düzeltilecek kayıt yok.');
        return;
    }

    // Supabase'den mevcut kayıtları çek
    let existingMap = {};
    if (!DRY_RUN && supabase) {
        const { data, error } = await supabase
            .from('postcards')
            .select('id, wp_post_id, image_front, city, slug');
        if (error) { console.error('❌', error.message); process.exit(1); }
        for (const row of data) {
            if (row.wp_post_id) existingMap[row.wp_post_id] = row;
        }
    }

    const safe = s => s.replace(/[^a-z0-9-]/gi, '-');
    let fixed = 0, errors = 0;

    for (const post of targets) {
        const wpId     = parseInt(post[0]);
        const postSlug = post[11];
        const content  = post[4] || '';

        const tid      = thumbId[post[0]];
        const thumbRel = attachFile[tid] || '';
        const thumbBase= thumbRel.split('/').pop();

        // Doğru ön yüzü bul:
        // 1) _thumb → _on dönüşümü
        const onBase   = thumbBase.replace(/_thumb(\.[^.]+)$/i, '_on$1');
        const onRel    = thumbRel.replace(/_thumb(\.[^.]+)$/i, '_on$1');
        let frontPath  = resolveLocal(onRel) || resolveLocalFuzzy(onBase);

        // 2) Dönüşüm işe yaramazsa içerik ilk görseli
        if (!frontPath) {
            const contentRels = extractImgRels(content);
            if (contentRels.length > 0) {
                const rel = contentRels[0];
                frontPath = resolveLocal(rel) || resolveLocalFuzzy(path.basename(rel));
            }
        }

        const frontBase = frontPath ? path.basename(frontPath) : '(bulunamadı)';

        if (DRY_RUN) {
            console.log(`  🔍  Post ${wpId} (${postSlug})`);
            console.log(`       _thumb : ${thumbBase}`);
            console.log(`       düzelt → ${frontBase} ${frontPath ? '✓' : '✗'}`);
            continue;
        }

        if (!frontPath) {
            console.log(`  ⚠️  Post ${wpId}: doğru ön yüz bulunamadı, atlandı.`);
            continue;
        }

        const existing = existingMap[wpId];
        if (!existing) { console.log(`  ⚠️  Post ${wpId} Supabase'de yok.`); continue; }

        if (existing.image_front && !FORCE) {
            console.log(`  ℹ️  Post ${wpId} (${existing.city}): image_front zaten dolu; üzerine yazmak için --force.`);
            continue;
        }

        console.log(`  📸  ${existing.city || postSlug} (${wpId}): ${thumbBase} → ${frontBase}`);
        try {
            const bName = safe(`${wpId}-${postSlug}`);
            const { optimizedUrl, originalUrl } = await uploadImagePair(supabase, frontPath, bName);
            const { error } = await supabase
                .from('postcards')
                .update({ image_front: optimizedUrl, image_front_original: originalUrl })
                .eq('wp_post_id', wpId);
            if (error) { console.error(`  ❌  DB hatası: ${error.message}`); errors++; }
            else { console.log(`  ✅  Düzeltildi`); fixed++; }
        } catch (e) {
            console.error(`  ❌  Hata: ${e.message}`);
            errors++;
        }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('📊  ÖZET');
    console.log('═══════════════════════════════════════════');
    console.log(`  Hedef post : ${targets.length}`);
    if (DRY_RUN) {
        console.log('\n⚠️   DRY-RUN — gerçek yükleme yapılmadı.');
    } else {
        console.log(`  Düzeltilen : ${fixed}`);
        console.log(`  Hata       : ${errors}`);
    }
}

main().catch(e => { console.error('❌  Script hatası:', e); process.exit(1); });
