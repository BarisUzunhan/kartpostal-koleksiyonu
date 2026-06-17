/* ========================================
   Veri Katmanı — Supabase bağlantısı
   Tüm okuma işlemleri herkese açık (anon + RLS).
   Yazma işlemleri yalnız authenticated session ile.
   ======================================== */

const PostcardData = (function () {

    // ── Bellek içi önbellek ──────────────────────────────────────────────
    let _cache = null;          // tüm kartpostallar yüklenince burada
    let _loadPromise = null;    // tekrar yüklenmesin

    // ── Veri yükleme (açılışta bir kez) ─────────────────────────────────
    async function loadAll() {
        if (_cache) return _cache;
        if (_loadPromise) return _loadPromise;

        _loadPromise = (async () => {
            const { data, error } = await SupabaseClient
                .from('postcards')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                console.error('Veri yükleme hatası:', error.message);
                return [];
            }
            _cache = data || [];
            return _cache;
        })();

        return _loadPromise;
    }

    // ── Placeholder görsel üretici (görsel yoksa) ────────────────────────
    function colorFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash * 31) | 0);
        }
        const h = Math.abs(hash) % 360;
        return `hsl(${h},55%,40%)`;
    }

    function makePlaceholder(city, country) {
        const color = colorFromString(country || city || '');
        const canvas = document.createElement('canvas');
        canvas.width = 800; canvas.height = 533;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 800, 533);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(city || '?', 400, 250);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '22px sans-serif';
        ctx.fillText(country || '', 400, 295);
        return canvas.toDataURL();
    }

    // ── Genel okuma API'si ───────────────────────────────────────────────
    async function getAll() {
        return loadAll();
    }

    async function getById(id) {
        // Önce önbellekten ara
        if (_cache) return _cache.find(p => p.id === id) || null;
        const { data, error } = await SupabaseClient
            .from('postcards')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return null;
        return data;
    }

    // ── Yazma API'si (authenticated gerektirir) ──────────────────────────
    async function add(postcard) {
        const { data, error } = await SupabaseClient
            .from('postcards')
            .insert([postcard])
            .select()
            .single();
        if (error) throw error;
        if (_cache) _cache.unshift(data);
        return data;
    }

    async function update(id, updates) {
        const { data, error } = await SupabaseClient
            .from('postcards')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        if (_cache) {
            const idx = _cache.findIndex(p => p.id === id);
            if (idx !== -1) _cache[idx] = data;
        }
        return data;
    }

    async function remove(id) {
        const { error } = await SupabaseClient
            .from('postcards')
            .delete()
            .eq('id', id);
        if (error) throw error;
        if (_cache) _cache = _cache.filter(p => p.id !== id);
        return true;
    }

    // Önbelleği geçersiz kıl (admin'den sonra yenile)
    function invalidateCache() {
        _cache = null;
        _loadPromise = null;
    }

    // ── Filtre & sıralama ────────────────────────────────────────────────
    function filterPostcards(postcards, {
        country = '', city = '', search = '', tag = '', sortBy = 'date-desc'
    } = {}) {
        let result = [...postcards];

        if (country) result = result.filter(p => p.country === country);
        if (city)    result = result.filter(p => p.city === city);
        if (tag)     result = result.filter(p => Array.isArray(p.tags) && p.tags.includes(tag));

        if (search) {
            const term = search.toLowerCase().trim();
            result = result.filter(p =>
                (p.city || '').toLowerCase().includes(term) ||
                (p.country || '').toLowerCase().includes(term) ||
                (p.description || '').toLowerCase().includes(term) ||
                (p.description_en || '').toLowerCase().includes(term) ||
                (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(term)))
            );
        }

        result.sort((a, b) => {
            const dA = new Date(a.date || 0);
            const dB = new Date(b.date || 0);
            return sortBy === 'date-asc' ? dA - dB : dB - dA;
        });

        return result;
    }

    function getUniqueCountries(postcards) {
        return [...new Set(postcards.map(p => p.country).filter(Boolean))].sort();
    }

    function getCitiesByCountry(postcards, country) {
        const filtered = country ? postcards.filter(p => p.country === country) : postcards;
        return [...new Set(filtered.map(p => p.city).filter(Boolean))].sort();
    }

    function getSimilar(postcard, allPostcards, limit = 10) {
        const myTags = Array.isArray(postcard.tags) ? postcard.tags : [];
        const scored = allPostcards
            .filter(p => p.id !== postcard.id)
            .map(p => {
                const pTags = Array.isArray(p.tags) ? p.tags : [];
                const shared = myTags.filter(t => pTags.includes(t)).length;
                const sameCountry = p.country === postcard.country ? 1 : 0;
                return { p, score: shared * 10 + sameCountry };
            })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.p);
        // Ortak etiket yoksa aynı ülke yedeği
        if (scored.length === 0 && postcard.country) {
            return allPostcards
                .filter(p => p.id !== postcard.id && p.country === postcard.country)
                .slice(0, limit);
        }
        return scored.slice(0, limit);
    }

    // ── Etiket işlemleri ─────────────────────────────────────────────────
    function getAllTags(postcards) {
        // İsim → kullanım sayısı
        const counts = {};
        for (const p of postcards) {
            if (!Array.isArray(p.tags)) continue;
            for (const t of p.tags) {
                counts[t] = (counts[t] || 0) + 1;
            }
        }
        return counts; // { 'İstanbul': 5, 'Deniz': 3, ... }
    }

    // ── Görsel yardımcısı ─────────────────────────────────────────────────
    function getImage(postcard) {
        return postcard.image_front
            || postcard.imageFront   // geriye dönük uyumluluk
            || postcard.image
            || makePlaceholder(postcard.city, postcard.country);
    }

    return {
        // Okuma
        getAll, getById,
        // Yazma (authenticated)
        add, update, remove, invalidateCache,
        // Yardımcılar
        filterPostcards, getUniqueCountries, getCitiesByCountry,
        getSimilar, getAllTags, getImage
    };
})();
