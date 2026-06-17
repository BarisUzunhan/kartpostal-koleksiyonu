/* ========================================
   Detay Sayfası — Yan Yana Görsel, Zoom, Ekstra Görseller,
   Mini Harita (tembel), Önceki/Sonraki, Benzer Kartpostallar
   (Supabase async)
   ======================================== */

(async function () {
    I18n.init();

    const container = document.getElementById('detail-content');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) { showNotFound(); return; }

    // Supabase'den getir
    const [postcard, allPostcards] = await Promise.all([
        PostcardData.getById(id),
        PostcardData.getAll()
    ]);
    if (!postcard) { showNotFound(); return; }

    document.title = `${postcard.city}, ${I18n.translateCountry(postcard.country)} — ${I18n.t('siteTitle')}`;

    const frontSrc = PostcardData.getImage(postcard);
    const backSrc  = postcard.image_back || postcard.imageBack || '';
    const hasBack  = !!backSrc;

    const frontOrigSrc = postcard.image_front_original || frontSrc;
    const backOrigSrc  = postcard.image_back_original  || backSrc;

    const extras      = Array.isArray(postcard.extra_images)          ? postcard.extra_images          : [];
    const extrasOrig  = Array.isArray(postcard.extra_images_original) ? postcard.extra_images_original : [];

    const desc = I18n.getDescription(postcard);

    // Önceki/sonraki (tarih-desc listesi)
    const sortedAll = [...allPostcards].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const idx = sortedAll.findIndex(p => p.id === postcard.id);
    const prevCard = idx > 0 ? sortedAll[idx - 1] : null;
    const nextCard = idx < sortedAll.length - 1 ? sortedAll[idx + 1] : null;

    // Benzer kartpostallar
    const similar = PostcardData.getSimilar(postcard, allPostcards, 10);

    let html = `<div class="detail-card fade-in">`;

    // ── Görseller yan yana ──────────────────────────────────────────────────
    html += `<div class="detail-images" id="detail-images">`;
    html += `<img class="detail-image" id="detail-img-front"
                  src="${escapeHtml(frontSrc)}" alt="${escapeHtml(postcard.city)}"
                  title="${I18n.t('clickToZoom') || 'Büyütmek için tıklayın'}"
                  onerror="this.style.display='none'">`;
    if (hasBack) {
        html += `<img class="detail-image" id="detail-img-back"
                      src="${escapeHtml(backSrc)}" alt="${escapeHtml(postcard.city)} - arka yüz"
                      title="${I18n.t('clickToZoom') || 'Büyütmek için tıklayın'}"
                      onerror="this.style.display='none'">`;
    }
    html += `</div>`;

    // ── Önceki / Sonraki — görselin hemen altında ────────────────────────────
    html += `<div class="detail-nav">`;
    if (prevCard) {
        html += `<a href="postcard.html?id=${encodeURIComponent(prevCard.id)}" class="detail-nav-link detail-nav-prev">
                    ${escapeHtml(I18n.t('prevPostcard') || '‹ Önceki')}
                    <span class="detail-nav-label">${escapeHtml(prevCard.city)}</span>
                 </a>`;
    } else {
        html += `<span></span>`;
    }
    if (nextCard) {
        html += `<a href="postcard.html?id=${encodeURIComponent(nextCard.id)}" class="detail-nav-link detail-nav-next">
                    ${escapeHtml(I18n.t('nextPostcard') || 'Sonraki ›')}
                    <span class="detail-nav-label">${escapeHtml(nextCard.city)}</span>
                 </a>`;
    }
    html += `</div>`;

    // ── Bilgiler ─────────────────────────────────────────────────────────────
    html += `<div class="detail-info">`;

    // Şehir + ülke aynı satırda
    html += `<h2 class="detail-city">${escapeHtml(postcard.city)}<span class="detail-country-inline">, ${escapeHtml(I18n.translateCountry(postcard.country))}</span></h2>`;

    // Açıklamalar
    if (desc.text)  html += `<p class="detail-description">${escapeHtml(desc.text)}</p>`;
    if (desc.text2) html += `<p class="detail-description detail-description-secondary">${escapeHtml(desc.text2)}</p>`;
    if (desc.note)  html += `<p class="detail-translation-note">${escapeHtml(desc.note)}</p>`;

    // Ekstra görseller bölümü
    if (extras.length > 0) {
        html += `<h3 class="detail-section-title" id="other-images-title">${I18n.t('otherImages') || 'Diğer görseller'}</h3>`;
        html += `<div class="detail-extra-grid" id="detail-extra-grid">`;
        for (let i = 0; i < extras.length; i++) {
            if (!extras[i]) continue;
            html += `<img src="${escapeHtml(extras[i])}" loading="lazy"
                          alt="${escapeHtml(postcard.city)} - görsel ${i + 2}"
                          title="${I18n.t('clickToZoom') || 'Büyütmek için tıklayın'}"
                          data-orig="${escapeHtml(extrasOrig[i] || extras[i])}"
                          onerror="this.style.display='none'">`;
        }
        html += `</div>`;
    }

    // Mini harita (kabı koy, harita tembel yüklenir)
    html += `<div class="detail-section-header">
                <h3 class="detail-section-title" style="margin-bottom:0;border:none;padding:0;">${I18n.t('location')}</h3>
                <button class="map-toggle-btn" id="map-toggle-btn" onclick="DetailPage.toggleMap()">⛶ Genişlet</button>
             </div>`;
    html += `<div class="detail-map" id="detail-map" style="margin-top:0.75rem;"></div>`;

    html += `</div></div>`;

    // Benzer kartpostallar barı
    if (similar.length > 0) {
        html += `<div class="similar-bar">
                    <h3 class="similar-bar-title">${I18n.t('similarCards')}</h3>
                    <div class="similar-bar-track">`;
        similar.forEach(s => {
            const sImg = PostcardData.getImage(s);
            const label = escapeHtml(s.city) + ', ' + escapeHtml(I18n.translateCountry(s.country));
            html += `<a href="postcard.html?id=${encodeURIComponent(s.id)}" class="similar-bar-card">
                        <img src="${escapeHtml(sImg)}" alt="${label}" loading="lazy"
                             onerror="this.style.display='none'">
                        <div class="similar-bar-overlay">
                            <span class="similar-bar-name">${label}</span>
                        </div>
                     </a>`;
        });
        html += `</div></div>`;
    }

    container.innerHTML = html;

    // ── Zoom olayları bağla ─────────────────────────────────────────────────
    const imgFrontEl = document.getElementById('detail-img-front');
    const imgBackEl  = document.getElementById('detail-img-back');

    if (imgFrontEl) imgFrontEl.addEventListener('click', () => ImageZoom.open(frontOrigSrc));
    if (imgBackEl)  imgBackEl.addEventListener('click',  () => ImageZoom.open(backOrigSrc));

    // Ekstra görseller zoom
    const extraGrid = document.getElementById('detail-extra-grid');
    if (extraGrid) {
        extraGrid.querySelectorAll('img').forEach(img => {
            img.addEventListener('click', () => ImageZoom.open(img.dataset.orig || img.src));
        });
    }

    // ── Mini harita — tembel yükleme ────────────────────────────────────────
    let detailMap = null;
    const mapContainer = document.getElementById('detail-map');

    if (postcard.lat && postcard.lng && mapContainer) {
        function buildDetailMap() {
            if (detailMap) return;
            detailMap = L.map(mapContainer, {
                zoomControl: true,
                scrollWheelZoom: true,
                dragging: true,
                minZoom: 2,
                maxZoom: 19
            }).setView([postcard.lat, postcard.lng], 8);
            if (typeof MapBase !== 'undefined') {
                MapBase.addBaseLayer(detailMap);
            } else {
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap', maxZoom: 18
                }).addTo(detailMap);
            }
            L.marker([postcard.lat, postcard.lng]).addTo(detailMap);
            // GL canvas boyut senkronizasyonu
            setTimeout(() => detailMap && detailMap.invalidateSize(), 200);
        }

        // IntersectionObserver: geniş rootMargin ile fold altını da yakala
        const mapObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting || detailMap) return;
                buildDetailMap();
                mapObserver.disconnect();
            });
        }, { rootMargin: '600px' });
        mapObserver.observe(mapContainer);

        // Emniyet: ~1.5s sonra hâlâ kurulmadıysa zorla kur (gözlemci kaçırsa bile)
        setTimeout(() => buildDetailMap(), 1500);
    }

    // ── Yardımcılar ─────────────────────────────────────────────────────────
    function showNotFound() {
        container.innerHTML = `
            <div class="detail-not-found">
                <h2>Kartpostal bulunamadı</h2>
                <p>Aradığınız kartpostal mevcut değil.</p>
                <a href="index.html" class="back-link" style="margin-top:1rem;display:inline-flex;color:#fff">
                    ${I18n.t('backToCollection')}
                </a>
            </div>
        `;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    window.DetailPage = {
        toggleMap() {
            const mapEl = document.getElementById('detail-map');
            const btn = document.getElementById('map-toggle-btn');
            if (!mapEl) return;
            const isExpanded = mapEl.classList.toggle('expanded');
            btn.textContent = isExpanded ? '⛶ Küçült' : '⛶ Genişlet';
            if (detailMap) setTimeout(() => detailMap.invalidateSize(), 350);
        }
    };
})();
