/**
 * migrate-back-images.mjs
 * WordPress SQL → Supabase: Eksik arka yüz görsellerini aktar
 *
 * Strateji 1: post content içinde _arka URL'si var → direkt kullan
 * Strateji 2: thumbnail _on.jpg → aynı adla _arka.jpg dosyasını bul
 * Strateji 3: content içinde _on.jpg → aynı adla _arka.jpg
 *
 * Kullanım:
 *   node scripts/migrate-back-images.mjs            # gerçek yükleme
 *   node scripts/migrate-back-images.mjs --dry-run  # sadece tarar
 *   node scripts/migrate-back-images.mjs --force    # dolu olsa da üzerine yaz
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
    const pattern = /src=["']https?:\/\/[^"']*\/wp-content\/uploads\/([^"']+)["']/gi;
    const found = [];
    let m;
    while ((m = pattern.exec(htmlContent)) !== null) {
        const rel = m[1];
        if (/-\d+x\d+\.(jpg|jpeg|png)$/i.test(rel)) continue;
        if (!found.includes(rel)) found.push(rel);
    }
    return found;
}

// `something_on.jpg` → `something_arka.jpg` dönüşümü
function onToArka(rel) {
    return rel.replace(/_on(\.[^.]+)$/i, '_arka$1');
}

// `something_thumb.jpg` → `something_arka.jpg` dönüşümü
function thumbToArka(rel) {
    return rel.replace(/_thumb(\.[^.]+)$/i, '_arka$1');
}

function resolveLocal(rel) {
    if (!rel) return null;
    const full = path.join(UPLOADS_DIR, rel);
    return existsSync(full) ? full : null;
}

// Dosyayı yıl/ay klasörü değişse de bul
function resolveLocalFuzzy(filename) {
    // Önce tam yolu dene, yoksa uploads altında ara
    const found = findFileRecursive(UPLOADS_DIR, filename);
    return found || null;
}

function findFileRecursive(dir, filename) {
    // Hızlı yaklaşım: bilinen yıl klasörlerinde ara
    const years = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2026'];
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    for (const y of years) {
        for (const m of months) {
            const candidate = path.join(dir, y, m, filename);
            if (existsSync(candidate)) return candidate;
        }
    }
    // Doğrudan klasörde de ara
    const direct = path.join(dir, filename);
    if (existsSync(direct)) return direct;
    return null;
}

// ── Supabase upload ───────────────────────────────────────────────────────────
async function optimizeImage(buf) {
    return sharp(buf)
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

    // wp_postmeta: 0:meta_id 1:post_id 2:meta_key 3:meta_value
    const allMeta = extractTableInserts(sql, 'wp_postmeta');
    const metaByPost = {};
    const attachPath = {}; // attachment_id → relative_path
    for (const r of allMeta) {
        if (!metaByPost[r[1]]) metaByPost[r[1]] = {};
        if (!metaByPost[r[1]][r[2]]) metaByPost[r[1]][r[2]] = [];
        metaByPost[r[1]][r[2]].push(r[3]);
        if (r[2] === '_wp_attached_file') attachPath[r[1]] = r[3];
    }
    console.log(`   → ${Object.keys(attachPath).length} attachment dosyası\n`);

    // ── Supabase kayıtları ───────────────────────────────────────────────────
    let existingMap = {};
    if (!DRY_RUN && supabase) {
        console.log('☁️   Supabase sorgulanıyor...');
        const { data, error } = await supabase
            .from('postcards')
            .select('id, wp_post_id, image_back, slug, city');
        if (error) { console.error('❌', error.message); process.exit(1); }
        for (const row of data) {
            if (row.wp_post_id) existingMap[row.wp_post_id] = row;
        }
        console.log(`   → ${data.length} mevcut kayıt\n`);
    }

    // ── Arka yüz eşleştirme ──────────────────────────────────────────────────
    console.log('🔄  Arka yüz aranıyor...\n');

    const stats = { total: 0, found: 0, uploaded: 0, skipped: 0, error: 0, notInSB: 0 };
    const matches = [];

    for (const post of published) {
        const wpId       = parseInt(post[0]);
        const postSlug   = post[11];
        const postContent = post[4] || '';

        stats.total++;

        const meta = metaByPost[wpId] || {};
        const thumbIds = meta['_thumbnail_id'] || [];

        let arkaLocalPath = null;
        let strategy = '';

        // ── Strateji 1: content içinde _arka URL ────────────────────────────
        const contentRels = extractImgRels(postContent);
        const arkaRels = contentRels.filter(r => /_arka/i.test(r));
        if (arkaRels.length > 0) {
            arkaLocalPath = resolveLocal(arkaRels[0]);
            strategy = 'S1:content_arka';
        }

        // ── Strateji 2: thumbnail _on.jpg → _arka.jpg ───────────────────────
        if (!arkaLocalPath && thumbIds.length > 0) {
            const thumbRel = attachPath[thumbIds[0]];
            if (thumbRel && /_on\./i.test(thumbRel)) {
                const arkaRel = onToArka(thumbRel);
                arkaLocalPath = resolveLocal(arkaRel);
                if (!arkaLocalPath) {
                    // Farklı yıl/ay klasöründe olabilir
                    arkaLocalPath = resolveLocalFuzzy(path.basename(arkaRel));
                }
                if (arkaLocalPath) strategy = 'S2:thumb_on→arka';
            }
            // thumbnail _thumb.jpg → _arka.jpg
            if (!arkaLocalPath && thumbRel && /_thumb\./i.test(thumbRel)) {
                const arkaRel = thumbToArka(thumbRel);
                arkaLocalPath = resolveLocal(arkaRel);
                if (!arkaLocalPath) {
                    arkaLocalPath = resolveLocalFuzzy(path.basename(arkaRel));
                }
                if (arkaLocalPath) strategy = 'S2:thumb_thumb→arka';
            }
        }

        // ── Strateji 3: content içinde _on.jpg → _arka.jpg ─────────────────
        if (!arkaLocalPath) {
            const onRels = contentRels.filter(r => /_on\./i.test(r));
            for (const onRel of onRels) {
                const arkaRel = onToArka(onRel);
                arkaLocalPath = resolveLocal(arkaRel);
                if (!arkaLocalPath) {
                    arkaLocalPath = resolveLocalFuzzy(path.basename(arkaRel));
                }
                if (arkaLocalPath) { strategy = 'S3:content_on→arka'; break; }
            }
        }

        if (!arkaLocalPath) continue;

        stats.found++;
        const arkaFile = path.basename(arkaLocalPath);
        matches.push({ wpId, postSlug, arkaFile, arkaLocalPath, strategy });

        if (DRY_RUN) {
            console.log(`  📸  Post ${wpId} (${postSlug}) [${strategy}] → ${arkaFile}`);
            continue;
        }

        // Supabase'de var mı?
        const existing = existingMap[wpId];
        if (!existing) { stats.notInSB++; continue; }

        // Zaten dolu mu?
        if (existing.image_back && !FORCE) { stats.skipped++; continue; }

        // Upload
        const safe = s => s.replace(/[^a-z0-9-]/gi, '-');
        const base = safe(`${wpId}-${postSlug}-back`);

        console.log(`  📸  ${existing.city || postSlug} (${wpId}) [${strategy}] → ${arkaFile}`);
        try {
            const { optimizedUrl, originalUrl } = await uploadImagePair(supabase, arkaLocalPath, base);
            const { error } = await supabase
                .from('postcards')
                .update({ image_back: optimizedUrl, image_back_original: originalUrl })
                .eq('wp_post_id', wpId);
            if (error) { console.error(`  ❌  DB hatası: ${error.message}`); stats.error++; }
            else { console.log(`  ✅  Yüklendi`); stats.uploaded++; }
        } catch (e) {
            console.error(`  ❌  Hata: ${e.message}`);
            stats.error++;
        }
        await new Promise(r => setTimeout(r, 150));
    }

    // ── Özet ─────────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('📊  ÖZET');
    console.log('═══════════════════════════════════════════');
    console.log(`  İncelenen post         : ${stats.total}`);
    console.log(`  Arka yüz eşleşen       : ${stats.found}`);
    if (DRY_RUN) {
        console.log('\n  Eşleşme detayı:');
        const byStrategy = {};
        for (const m of matches) {
            byStrategy[m.strategy] = (byStrategy[m.strategy] || 0) + 1;
        }
        for (const [k, v] of Object.entries(byStrategy)) {
            console.log(`     ${k}: ${v} post`);
        }
        console.log('\n⚠️   DRY-RUN — gerçek yükleme yapılmadı.');
        console.log('    Yüklemek için: node scripts/migrate-back-images.mjs');
    } else {
        console.log(`  Zaten dolu (atlandı)   : ${stats.skipped}`);
        console.log(`  Başarıyla yüklendi     : ${stats.uploaded}`);
        console.log(`  Hata                   : ${stats.error}`);
        console.log(`  Supabase'de yok        : ${stats.notInSB}`);
    }
}

main().catch(e => { console.error('❌  Script hatası:', e); process.exit(1); });
