/* ========================================
   Detay Sayfası — Mini Harita, Benzerler, Etiketler
   (Supabase async)
   ======================================== */

(async function () {
    I18n.init();

    const container = document.getElementById('detail-content');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) { showNotFound(); return; }

    // Supabase'den getir
    const postcard = await PostcardData.getById(id);
    if (!postcard) { showNotFound(); return; }

    document.title = `${postcard.city}, ${postcard.country} — ${I18n.t('siteTitle')}`;

    const frontSrc = PostcardData.getImage(postcard);
    const backSrc = postcard.image_back || postcard.imageBack || '';
    const hasBack = !!backSrc;
    const desc = I18n.getDescription(postcard);
    const allPostcards = await PostcardData.getAll();
    const similar = PostcardData.getSimilar(postcard, allPostcards, 4);

    let html = `<div class="detail-card fade-in">`;

    // Görseller alt alta
    html += `<div class="detail-images">`;
    html += `<img class="detail-image" src="${escapeHtml(frontSrc)}" alt="${escapeHtml(postcard.city)}"
                  onerror="this.style.display='none'">`;
    if (hasBack) {
        html += `<img class="detail-image" src="${escapeHtml(backSrc)}" alt="${escapeHtml(postcard.city)} - arka yüz"
                      onerror="this.style.display='none'">`;
    }
    html += `</div>`;

    // Bilgiler
    html += `<div class="detail-info">`;
    html += `<h2 class="detail-city">${escapeHtml(postcard.city)}</h2>`;
    html += `<p class="detail-country">${escapeHtml(postcard.country)}</p>`;

    // Etiket rozetleri
    const tags = postcard.tags || [];
    if (tags.length) {
        html += `<div class="modal-tags detail-tags">`;
        for (const tag of tags) {
            html += `<a class="tag-chip" href="index.html?tag=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`;
        }
        html += `</div>`;
    }

    // Açıklamalar
    if (desc.text)  html += `<p class="detail-description">${escapeHtml(desc.text)}</p>`;
    if (desc.text2) html += `<p class="detail-description detail-description-secondary">${escapeHtml(desc.text2)}</p>`;
    if (desc.note)  html += `<p class="detail-translation-note">${escapeHtml(desc.note)}</p>`;

    // Mini harita
    html += `<div class="detail-section-header">
                <h3 class="detail-section-title" style="margin-bottom:0;border:none;padding:0;">${I18n.t('location')}</h3>
                <button class="map-toggle-btn" id="map-toggle-btn" onclick="DetailPage.toggleMap()">⛶ Genişlet</button>
             </div>`;
    html += `<div class="detail-map" id="detail-map" style="margin-top:0.75rem;"></div>`;

    // Benzer kartpostallar
    if (similar.length > 0) {
        html += `<h3 class="detail-section-title">${I18n.t('similarCards')}</h3>`;
        html += `<div class="similar-grid">`;
        similar.forEach(s => {
            const sImg = PostcardData.getImage(s);
            html += `<a href="postcard.html?id=${encodeURIComponent(s.id)}" class="similar-card">
                        <img src="${escapeHtml(sImg)}" alt="${escapeHtml(s.city)}" loading="lazy"
                             onerror="this.style.display='none'">
                        <div class="card-overlay">
                            <span class="card-name">${escapeHtml(s.city)}</span>
                        </div>
                     </a>`;
        });
        html += `</div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;

    // Mini harita
    let detailMap = null;
    if (postcard.lat && postcard.lng) {
        detailMap = L.map('detail-map', { zoomControl: true, scrollWheelZoom: true, dragging: true })
            .setView([postcard.lat, postcard.lng], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap', maxZoom: 18
        }).addTo(detailMap);
        L.marker([postcard.lat, postcard.lng]).addTo(detailMap);
    }

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
