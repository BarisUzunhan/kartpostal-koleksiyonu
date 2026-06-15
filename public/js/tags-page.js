/* ========================================
   Etiket Bulutu Sayfası — Dil Filtresi + Görsel Word Cloud
   ======================================== */

(async function () {
    I18n.init();

    const container = document.getElementById('tag-cloud-container');
    const statsEl   = document.getElementById('tag-stats');
    const countText = document.getElementById('tag-count-text');

    let allPostcards = [];

    // ── Deterministik pseudo-random (seed = etiket adı) ─────────────────────
    function strHash(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    function randRange(seed, min, max) {
        return min + (strHash(seed) % 10000) / 10000 * (max - min);
    }

    // ── Frekans → görsel özellik eşlemeleri ─────────────────────────────────
    function norm(count, min, max) {
        return max === min ? 0.5 : (count - min) / (max - min);
    }

    function fontSize(n) {
        // Log ölçeği: nadir → 0.82rem, çok yaygın → 3.4rem
        return (0.82 + Math.pow(n, 0.55) * 2.58).toFixed(2) + 'rem';
    }

    function fontWeight(n) {
        if (n > 0.88) return 800;
        if (n > 0.70) return 700;
        if (n > 0.50) return 600;
        if (n > 0.30) return 500;
        if (n > 0.12) return 400;
        return 300;
    }

    function letterSpacing(weight) {
        // İnce fontlar biraz geniş, kalın fontlar biraz dar
        if (weight >= 700) return '-0.02em';
        if (weight <= 300) return '0.06em';
        return '0.01em';
    }

    // Renk paleti: teal arka plan üzerinde beyaz tonları + sıcak ton
    const COLORS = [
        '#ffffff',           // en yaygın → saf beyaz
        '#f0f8ff',           // yüksek → soğuk beyaz
        '#ffe8d6',           // orta-yüksek → sıcak krem
        '#d4efdf',           // orta → soft yeşil-beyaz
        'rgba(255,255,255,0.82)', // orta-düşük
        'rgba(255,255,255,0.70)', // düşük
    ];

    function tagColor(n, tag) {
        const idx = Math.floor((1 - n) * (COLORS.length - 1));
        // Renkleri biraz karıştır (deterministic)
        const offset = strHash(tag + 'c') % 2;
        return COLORS[Math.min(idx + offset, COLORS.length - 1)];
    }

    function tagOpacity(n) {
        return (0.62 + n * 0.38).toFixed(2);
    }

    // Döndürme açısı — büyük etiketler yatay, küçükler rastgele / dikey
    function tagRotation(tag, fsize) {
        const size = parseFloat(fsize);
        if (size >= 2.4) return { deg: 0, vertical: false };
        if (size >= 1.7) return { deg: randRange(tag + 'r', -7, 7), vertical: false };
        if (size >= 1.15) return { deg: randRange(tag + 'r', -16, 16), vertical: false };
        // Küçük etiketlerin %18'i dikey
        if (strHash(tag + 'v') % 100 < 18) return { deg: 0, vertical: true };
        return { deg: randRange(tag + 'r', -22, 22), vertical: false };
    }

    // Marjin varyasyonu — organik boşluk için
    function tagMargin(tag) {
        const mh = randRange(tag + 'mh', 0.25, 0.95);
        const mv = randRange(tag + 'mv', 0.12, 0.55);
        return `${mv.toFixed(2)}rem ${mh.toFixed(2)}rem`;
    }

    // ── Etiket bulutunu oluştur ──────────────────────────────────────────────
    async function buildTagCloud() {
        container.innerHTML = '<div class="loading-state">Yükleniyor...</div>';

        // Dile göre filtrelenmiş etiket sayıları
        const tagCounts = {};
        for (const p of allPostcards) {
            const tags = I18n.filterTagsByLang(p.tags || []);
            for (const t of tags) {
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            }
        }

        const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) {
            container.innerHTML = '<p class="no-results-title">Bu dilde etiket bulunamadı.</p>';
            statsEl.style.display = 'none';
            return;
        }

        const maxCount = entries[0][1];
        const minCount = entries[entries.length - 1][1];

        container.innerHTML = '';

        // Hafif karıştırılmış sıra: çok büyük etiketlerin hepsi başa yığılmasın
        const sorted = [...entries];
        // Ortaları hafifçe karıştır, en büyükler dağıtsın
        for (let i = 3; i < sorted.length - 1; i++) {
            const j = i + Math.floor(strHash(sorted[i][0] + 'sh') % 3) - 1;
            if (j > 2 && j < sorted.length) [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        }

        for (const [tag, count] of sorted) {
            const n = norm(count, minCount, maxCount);
            const fsize = fontSize(n);
            const fw = fontWeight(n);
            const { deg, vertical } = tagRotation(tag, fsize);

            const a = document.createElement('a');
            a.className = 'tag-cloud-word' + (vertical ? ' tag-vertical' : '');
            a.href = `index.html?tag=${encodeURIComponent(tag)}`;
            a.textContent = tag;
            a.title = `${count} kartpostal`;

            a.style.fontSize = fsize;
            a.style.fontWeight = fw;
            a.style.color = tagColor(n, tag);
            a.style.opacity = tagOpacity(n);
            a.style.letterSpacing = letterSpacing(fw);
            a.style.margin = tagMargin(tag);

            if (!vertical) {
                a.style.setProperty('--rot', `${deg.toFixed(1)}deg`);
            }

            container.appendChild(a);
        }

        statsEl.style.display = '';
        countText.textContent = `${entries.length} etiket · ${allPostcards.length} kartpostal`;
    }

    // ── Başlat ───────────────────────────────────────────────────────────────
    allPostcards = await PostcardData.getAll();
    if (!allPostcards || allPostcards.length === 0) {
        container.innerHTML = '<p class="no-results-title">Henüz kartpostal eklenmemiş.</p>';
        return;
    }

    await buildTagCloud();

    // Dil değişince yeniden oluştur
    window.TagCloud = { refresh: buildTagCloud };
})();
