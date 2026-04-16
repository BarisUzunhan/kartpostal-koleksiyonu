/* ========================================
   Detay Sayfası — Mini Harita, Benzerler
   ======================================== */

(function () {
    I18n.init();

    const container = document.getElementById('detail-content');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) { showNotFound(); return; }

    const postcard = PostcardData.getById(id);
    if (!postcard) { showNotFound(); return; }

    document.title = `${postcard.city}, ${postcard.country} — ${I18n.t('siteTitle')}`;

    const frontSrc = PostcardData.getImage(postcard);
    const backSrc = postcard.imageBack || '';
    const hasBack = !!backSrc;
    const desc = I18n.getDescription(postcard);
    const allPostcards = PostcardData.getAll();
    const similar = PostcardData.getSimilar(postcard, allPostcards, 4);

    let html = `<div class="detail-card fade-in">`;

    // Carousel
    html += `<div class="detail-carousel" id="detail-carousel">`;
    html += `<img class="active-slide" src="${escapeHtml(frontSrc)}" alt="${escapeHtml(postcard.city)}"
                  onerror="this.parentElement.innerHTML='<p style=\\"padding:3rem;color:var(--color-text-muted)\\">Gorsel yuklenemedi</p>'">`;
    if (hasBack) {
        html += `<img src="${escapeHtml(backSrc)}" alt="${escapeHtml(postcard.city)} - arka yuz">`;
        html += `<button class="img-nav-btn img-nav-prev" onclick="DetailPage.showSlide(0)">&#8249;</button>`;
        html += `<button class="img-nav-btn img-nav-next" onclick="DetailPage.showSlide(1)">&#8250;</button>`;
        html += `<div class="img-dots">
                    <button class="img-dot active" onclick="DetailPage.showSlide(0)"></button>
                    <button class="img-dot" onclick="DetailPage.showSlide(1)"></button>
                 </div>`;
    }
    html += `</div>`;

    // Bilgiler
    html += `<div class="detail-info">`;
    html += `<h2 class="detail-city">${escapeHtml(postcard.city)}</h2>`;
    html += `<p class="detail-country">${escapeHtml(postcard.country)}</p>`;

    if (postcard.originalText) {
        html += `<div class="detail-original-text">${escapeHtml(postcard.originalText)}</div>`;
    }

    html += `<p class="detail-description">${escapeHtml(desc.text)}</p>`;

    if (desc.note) {
        html += `<p class="detail-translation-note">${escapeHtml(desc.note)}</p>`;
    }

    // Mini harita
    html += `<h3 class="detail-section-title">${I18n.t('location')}</h3>`;
    html += `<div class="detail-map" id="detail-map"></div>`;

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

    // Mini haritayı oluştur
    if (postcard.lat && postcard.lng) {
        const miniMap = L.map('detail-map', { zoomControl: false, scrollWheelZoom: false, dragging: false }).setView([postcard.lat, postcard.lng], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 18
        }).addTo(miniMap);
        L.marker([postcard.lat, postcard.lng]).addTo(miniMap);
    }

    function showNotFound() {
        container.innerHTML = `
            <div class="detail-not-found">
                <h2>Kartpostal bulunamadi</h2>
                <p>Aradiginiz kartpostal mevcut degil.</p>
                <a href="index.html" class="back-link" style="margin-top:1rem;display:inline-flex;color:#fff">${I18n.t('backToCollection')}</a>
            </div>
        `;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Carousel slide kontrolü (global erişim için)
    window.DetailPage = {
        showSlide: function(index) {
            const carousel = document.getElementById('detail-carousel');
            if (!carousel) return;
            const imgs = carousel.querySelectorAll('img');
            const dots = carousel.querySelectorAll('.img-dot');
            imgs.forEach((img, i) => img.classList.toggle('active-slide', i === index));
            dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
        }
    };
})();
