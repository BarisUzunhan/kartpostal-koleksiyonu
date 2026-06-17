/* ========================================
   Modal — Alt Alta Ön/Arka Yüz + Zoom + Mini Harita
   ======================================== */

const Modal = (function () {
    const overlay    = document.getElementById('modal-overlay');
    const closeBtn   = document.getElementById('modal-close');
    const prevBtn    = document.getElementById('modal-prev');
    const nextBtn    = document.getElementById('modal-next');
    const imgFront   = document.getElementById('modal-img-front');
    const imgBack    = document.getElementById('modal-img-back');
    const extraBtn   = document.getElementById('modal-extra-btn');
    const cityEl     = document.getElementById('modal-city');
    const countryEl  = document.getElementById('modal-country');
    const descEl     = document.getElementById('modal-description');
    const desc2El    = document.getElementById('modal-description-2');
    const translationNoteEl = document.getElementById('modal-translation-note');
    const openPageEl = document.getElementById('modal-open-page');
    const mapEl      = document.getElementById('modal-map');

    let currentPostcard = null;
    let postcardList = [];
    let currentIndex = -1;
    let miniMap = null;

    function init() {
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigatePrev(); });
        nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateNext(); });

        document.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('visible')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') navigatePrev();
            if (e.key === 'ArrowRight') navigateNext();
        });

        // Zoom — ön/arka görsele tıklanınca
        imgFront.addEventListener('click', () => {
            if (!currentPostcard) return;
            const src = currentPostcard.image_front_original || imgFront.src;
            if (src) ImageZoom.open(src);
        });
        imgBack.addEventListener('click', () => {
            if (!currentPostcard) return;
            const src = currentPostcard.image_back_original || imgBack.src;
            if (src) ImageZoom.open(src);
        });
    }

    function open(postcard, list) {
        currentPostcard = postcard;
        postcardList = list || [];
        currentIndex = postcardList.findIndex(p => p.id === postcard.id);
        renderContent(postcard);
        updateNavButtons();
        overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        overlay.classList.remove('visible');
        document.body.style.overflow = '';
        currentPostcard = null;
        // Mini haritayı temizle
        if (miniMap) { miniMap.remove(); miniMap = null; }
        if (mapEl) mapEl.style.display = 'none';
    }

    function renderContent(postcard) {
        const frontSrc = PostcardData.getImage(postcard);
        const backSrc  = postcard.image_back || postcard.imageBack || '';

        // Ön yüz — her zaman göster
        imgFront.src = frontSrc;
        imgFront.alt = postcard.city;
        imgFront.style.display = '';

        // Arka yüz — varsa göster, yoksa gizle
        if (backSrc) {
            imgBack.src = backSrc;
            imgBack.alt = (postcard.city || '') + ' - arka yüz';
            imgBack.style.display = '';
        } else {
            imgBack.src = '';
            imgBack.style.display = 'none';
        }

        // Ekstra görseller butonu
        const extras = postcard.extra_images;
        if (extraBtn) {
            if (extras && extras.length > 0) {
                extraBtn.style.display = '';
                extraBtn.href = `postcard.html?id=${encodeURIComponent(postcard.id)}`;
                const span = extraBtn.querySelector('[data-i18n]');
                if (span) span.textContent = I18n.t('hasMoreImages') || 'Bu sayfa başka görseller de içermektedir';
            } else {
                extraBtn.style.display = 'none';
            }
        }

        // Şehir + ülke aynı satırda
        if (cityEl) cityEl.textContent = postcard.city || '';
        if (countryEl) {
            const ctry = I18n.translateCountry(postcard.country);
            countryEl.textContent = ctry ? ', ' + ctry : '';
        }

        // Açıklamalar
        const desc = I18n.getDescription(postcard);
        descEl.textContent  = desc.text;
        descEl.style.display = desc.text ? '' : 'none';

        if (desc.text2) {
            desc2El.textContent  = desc.text2;
            desc2El.style.display = '';
        } else {
            desc2El.style.display = 'none';
        }

        if (desc.note) {
            translationNoteEl.textContent  = desc.note;
            translationNoteEl.style.display = '';
        } else {
            translationNoteEl.style.display = 'none';
        }

        openPageEl.href = `postcard.html?id=${encodeURIComponent(postcard.id)}`;

        // Mini harita — mevcut haritayı temizle, yenisini kur
        if (miniMap) { miniMap.remove(); miniMap = null; }
        if (mapEl) {
            if (postcard.lat && postcard.lng) {
                mapEl.style.display = '';
                // Kısa gecikme: modal animasyonu bitmeden önce harita boyutu sıfır olur
                setTimeout(() => {
                    miniMap = L.map(mapEl, { zoomControl: false, scrollWheelZoom: false, dragging: false })
                        .setView([postcard.lat, postcard.lng], 8);
                    if (typeof MapBase !== 'undefined') {
                        MapBase.addBaseLayer(miniMap);
                    } else {
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '&copy; OpenStreetMap', maxZoom: 18
                        }).addTo(miniMap);
                    }
                    L.marker([postcard.lat, postcard.lng]).addTo(miniMap);
                    miniMap.invalidateSize();
                }, 320);
            } else {
                mapEl.style.display = 'none';
            }
        }
    }

    function navigatePrev() {
        if (currentIndex <= 0) return;
        currentIndex--;
        currentPostcard = postcardList[currentIndex];
        renderContent(currentPostcard);
        updateNavButtons();
    }

    function navigateNext() {
        if (currentIndex >= postcardList.length - 1) return;
        currentIndex++;
        currentPostcard = postcardList[currentIndex];
        renderContent(currentPostcard);
        updateNavButtons();
    }

    function updateNavButtons() {
        prevBtn.style.visibility = currentIndex <= 0 ? 'hidden' : 'visible';
        nextBtn.style.visibility = currentIndex >= postcardList.length - 1 ? 'hidden' : 'visible';
    }

    return { init, open, close };
})();
