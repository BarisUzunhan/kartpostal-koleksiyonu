/* ========================================
   Etiket Bulutu — Tipografik Word Cloud
   Referans: çoklu font ailesi + baseline hizalama
   ======================================== */

(async function () {
    I18n.init();

    const container = document.getElementById('tag-cloud-container');
    const statsEl   = document.getElementById('tag-stats');
    const countText = document.getElementById('tag-count-text');

    let allPostcards = [];

    // ── Deterministik hash (her etiket her zaman aynı stili alır) ───────────
    function strHash(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    // ── Tipografi stilleri — referanstaki gibi karışık font karakteri ────────
    // Her stil: font, weight, italic, uppercase, outline (hollow harf)
    const STYLES = [
        { f: "'Oswald', sans-serif",        w: 700, i: false, u: true,  o: false },  // 0  bold condensed caps
        { f: "'Playfair Display', serif",   w: 700, i: true,  u: false, o: false },  // 1  bold italic serif
        { f: "'Dosis', sans-serif",         w: 800, i: false, u: false, o: false },  // 2  geometric bold
        { f: "'Oswald', sans-serif",        w: 200, i: false, u: true,  o: false },  // 3  thin condensed caps
        { f: "'Caveat', cursive",           w: 700, i: false, u: false, o: false },  // 4  handwritten bold
        { f: "'Playfair Display', serif",   w: 400, i: true,  u: false, o: false },  // 5  light italic serif
        { f: "'Oswald', sans-serif",        w: 600, i: false, u: true,  o: true  },  // 6  outline/hollow caps
        { f: "'Dosis', sans-serif",         w: 300, i: false, u: true,  o: false },  // 7  thin geometric caps
        { f: "'Caveat', cursive",           w: 400, i: false, u: false, o: false },  // 8  handwritten light
        { f: "'Oswald', sans-serif",        w: 500, i: false, u: false, o: false },  // 9  medium condensed
    ];

    // Sitenin renk paletine uygun renkler (açık teal arka plan üzerinde)
    const COLORS = [
        '#0d3545',    // 0  koyu lacivert — maksimum kontrast
        '#ffffff',    // 1  beyaz
        '#1f5c6c',    // 2  sitenin koyu teal rengi
        '#0a2535',    // 3  en koyu lacivert
        '#0d3545',    // 4  koyu lacivert
        '#fffde7',    // 5  sıcak krem
        'transparent',// 6  outline için (renk yok, sadece stroke)
        '#1f5c6c',    // 7  koyu teal
        '#ffffff',    // 8  beyaz
        '#0d3545',    // 9  koyu lacivert
    ];

    // ── Log-ölçeği boyut hesabı (word cloud için standart) ──────────────────
    function logFontSize(count, minC, maxC) {
        if (maxC === minC) return '1.8rem';
        const logN = (Math.log(count) - Math.log(minC)) / (Math.log(maxC) - Math.log(minC));
        const size = 0.78 + logN * 3.22;
        return size.toFixed(2) + 'rem';
    }

    // Büyük harfler için biraz küçült (optik denge)
    function adjustSize(rem, isUpper, isCaveat) {
        const n = parseFloat(rem);
        if (isUpper) return (n * 0.88).toFixed(2) + 'rem';
        if (isCaveat) return (n * 1.15).toFixed(2) + 'rem'; // Caveat doğal küçük görünür
        return rem;
    }

    // ── Etiket bulutunu oluştur ──────────────────────────────────────────────
    async function buildTagCloud() {
        container.innerHTML = '<div class="loading-state">Yükleniyor...</div>';

        // Dile göre filtrelenmiş etiket sayıları
        const tagCounts = {};
        for (const p of allPostcards) {
            const tags = I18n.filterTagsByLang(p.tags || []);
            for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
        }

        const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) {
            container.innerHTML = '<p class="no-results-title">Bu dilde etiket bulunamadı.</p>';
            statsEl.style.display = 'none';
            return;
        }

        const maxC = entries[0][1];
        const minC = entries[entries.length - 1][1];

        // Tam deterministik Fisher-Yates karıştırma — her çalıştırmada aynı sonuç
        const shuffled = [...entries];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = strHash(shuffled[i][0] + String(i)) % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        container.innerHTML = '';

        for (const [tag, count] of shuffled) {
            const styleIdx = strHash(tag) % STYLES.length;
            const s = STYLES[styleIdx];
            const isOutline = s.o;
            const isCaveat = s.f.includes('Caveat');

            const baseSize = logFontSize(count, minC, maxC);
            const fsize = adjustSize(baseSize, s.u, isCaveat);
            const logN = (Math.log(count) - Math.log(minC)) / (Math.log(maxC) - Math.log(minC) || 1);

            // Küçük etiketlerde outline okunamaz — beyaza zorla
            const smallTag = logN < 0.35;
            const useOutline = isOutline && !smallTag;

            const a = document.createElement('a');
            a.className = 'tag-cloud-word' + (useOutline ? ' tag-outline' : '');
            a.href = `index.html?tag=${encodeURIComponent(tag)}`;
            a.textContent = s.u ? tag.toUpperCase() : tag;
            a.title = `${count} kartpostal`;

            a.style.fontFamily = s.f;
            a.style.fontWeight = s.w;
            a.style.fontStyle  = s.i ? 'italic' : 'normal';
            a.style.fontSize   = fsize;

            // Küçük etiket → beyaz (teal arka planda en iyi okunur)
            // Büyük etiket → stile göre renk
            if (smallTag) {
                a.style.color   = '#ffffff';
                a.style.opacity = (0.82 + logN * 0.18).toFixed(2); // min 0.82
            } else if (useOutline) {
                a.style.color   = 'transparent';
                a.style.opacity = '1';
                const strokeW = Math.max(1.8, Math.min(3.5, parseFloat(fsize) * 0.55)).toFixed(1);
                a.style.webkitTextStroke = `${strokeW}px #0d3545`;
            } else {
                a.style.color   = COLORS[styleIdx];
                a.style.opacity = (0.80 + logN * 0.20).toFixed(2); // min 0.80
            }

            // Büyük kelimelere hafif derinlik gölgesi
            if (logN > 0.65 && !useOutline) {
                a.style.textShadow = '2px 3px 0 rgba(13,53,69,0.1), 4px 5px 0 rgba(13,53,69,0.05)';
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

    window.TagCloud = { refresh: buildTagCloud };
})();
