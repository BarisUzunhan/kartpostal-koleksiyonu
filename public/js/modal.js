/* ========================================
   Modal — Alt Alta Ön/Arka Yüz + Zoom + Mini Harita
   ======================================== */

const Modal = (function () {
    const overlay    = document.getElementById('modal-overlay');
    const closeBtn   = document.getElementById('modal-close');
    const prevBtn    = document.getElementById('modal-prev');
    const nextBtn    = document.getElementById('modal-next');
    const imagesWrap = document.getElementById('modal-images');
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
    let zoomImages = [];

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
            if (zoomImages[0]) ImageZoom.open(zoomImages, 0);
        });
        imgBack.addEventListener('click', () => {
            if (zoomImages.length > 1) ImageZoom.open(zoomImages, 1);
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
        if (mapEl) { mapEl.style.display = 'none'; mapEl.classList.remove('visible'); }
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

        // Büyütme (zoom) için görsel listesi
        zoomImages = [postcard.image_front_original || frontSrc];
        if (backSrc) zoomImages.push(postcard.image_back_original || backSrc);

        // Önceki karttan kalan satır içi ekstra görselleri temizle
        imagesWrap.querySelectorAll('.modal-extra-img').forEach(el => el.remove());

        // Ekstra görseller
        const extras     = Array.isArray(postcard.extra_images)          ? postcard.extra_images          : [];
        const extrasOrig = Array.isArray(postcard.extra_images_original) ? postcard.extra_images_original : [];
        const pos        = postcard.extra_images_position || 'after_description';
        const hasExtras  = extras.length > 0;

        // "Ön/arka yüzün hemen altında" işaretliyse ekstraları modalda satır içi göster
        if (hasExtras && pos === 'after_images') {
            for (let i = 0; i < extras.length; i++) {
                if (!extras[i]) continue;
                const zoomIndex = zoomImages.length;
                zoomImages.push(extrasOrig[i] || extras[i]);

                const img = document.createElement('img');
                img.className = 'modal-extra-img';
                img.src = extras[i];
                img.alt = (postcard.city || '') + ' - görsel ' + (i + 2);
                img.addEventListener('click', () => ImageZoom.open(zoomImages, zoomIndex));
                imagesWrap.appendChild(img);
            }
            if (extraBtn) extraBtn.style.display = 'none';
        } else if (hasExtras && extraBtn) {
            // Aksi halde: detay sayfasına giden link butonu
            extraBtn.style.display = '';
            extraBtn.href = `postcard.html?id=${encodeURIComponent(postcard.id)}`;
            const span = extraBtn.querySelector('[data-i18n]');
            if (span) span.textContent = I18n.t('hasMoreImages') || 'Bu sayfa başka görseller de içermektedir';
        } else if (extraBtn) {
            extraBtn.style.display = 'none';
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
                // Görünür yap — hem inline hem CSS override (Leaflet inline ekliyor)
                mapEl.style.display = 'block';
                mapEl.classList.add('visible');
                // Kısa gecikme: modal animasyonu bitmeden önce harita boyutu sıfır olur
                setTimeout(() => {
                    miniMap = L.map(mapEl, {
                        zoomControl: true,
                        scrollWheelZoom: true,
                        dragging: true,
                        minZoom: 2,
                        maxZoom: 19
                    }).setView([postcard.lat, postcard.lng], 5);
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
                mapEl.classList.remove('visible');
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
