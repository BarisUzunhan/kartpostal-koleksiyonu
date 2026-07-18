/* ========================================
   Ana Uygulama — Başlatma, Mod Değişimi
   (Supabase async veri yükleme)
   ======================================== */

(async function () {
    // i18n başlat
    I18n.init();

    // Veri yükle (Supabase'den async)
    const postcards = await PostcardData.getAll();

    // Modal başlat
    Modal.init();

    // Galeri başlat
    Gallery.init(postcards);

    // Harita başlat
    PostcardMap.init();

    // URL parametreleri
    const urlParams = new URLSearchParams(window.location.search);
    const urlMode = urlParams.get('mode');

    // Veri durumuna göre görünüm
    const emptyState = document.getElementById('empty-state');
    const galleryContainer = document.getElementById('gallery-container');
    const paginationContainer = document.getElementById('pagination-container');

    // ── Mod değişimi altyapısı ───────────────────────────────────────────
    const mapLink = document.getElementById('nav-map-link');
    const mapContainer = document.getElementById('map-container');
    const galleryNavLink = document.querySelector('.nav-link[href="index.html"]');
    let currentMode = 'gallery';

    // Varsayılan sıralama (temiz URL için — varsayılansa URL'e yazma)
    const defaultSort = document.getElementById('filter-sort').value;

    // ── URL <-> durum senkronu ───────────────────────────────────────────
    function writeUrl(push) {
        const p = Gallery.getStateParams();
        const params = new URLSearchParams();
        if (p.country) params.set('country', p.country);
        if (p.city) params.set('city', p.city);
        if (p.search) params.set('search', p.search);
        if (p.sort && p.sort !== defaultSort) params.set('sort', p.sort);
        if (p.tag) params.set('tag', p.tag);
        if (p.page && p.page > 1) params.set('page', p.page);
        if (currentMode === 'map') params.set('mode', 'map');
        const qs = params.toString();
        const url = 'index.html' + (qs ? '?' + qs : '');
        if (push) history.pushState({}, '', url);
        else history.replaceState({}, '', url);
    }

    function switchToMap({ pushHistory = true } = {}) {
        currentMode = 'map';
        galleryContainer.style.display = 'none';
        paginationContainer.style.display = 'none';
        mapContainer.style.display = '';
        emptyState.style.display = 'none';
        // Filtre çubuğu haritada da açık kalır — pinler filtreye göre güncellenir
        mapLink.classList.add('active');
        if (galleryNavLink) galleryNavLink.classList.remove('active');
        PostcardMap.show(Gallery.getFiltered());
        if (pushHistory) writeUrl(true);
    }

    function switchToGallery({ pushHistory = true } = {}) {
        currentMode = 'gallery';
        galleryContainer.style.display = '';
        paginationContainer.style.display = '';
        mapContainer.style.display = 'none';
        mapLink.classList.remove('active');
        if (galleryNavLink) galleryNavLink.classList.add('active');
        if (postcards.length === 0) {
            emptyState.style.display = 'flex';
            galleryContainer.style.display = 'none';
            paginationContainer.style.display = 'none';
        }
        if (pushHistory) writeUrl(true);
    }

    // ── İlk yükleme ──────────────────────────────────────────────────────
    if (postcards.length === 0) {
        emptyState.style.display = 'flex';
        galleryContainer.style.display = 'none';
        paginationContainer.style.display = 'none';
    } else {
        emptyState.style.display = 'none';

        // Durum değişimlerini (filtre/sayfa) geçmişe yaz
        Gallery.setOnChange(() => writeUrl(true));

        // URL'deki tam durumu (filtre + sayfa + tag) geri yükle
        Gallery.restoreFromParams(urlParams, { silent: true });

        // Harita modu isteniyorsa geç (geçmişe yazmadan)
        if (urlMode === 'map') switchToMap({ pushHistory: false });

        // Canonical URL'i sabitle (replace — yeni geçmiş girişi oluşturmaz)
        writeUrl(false);
    }

    // ── Mod değişimi (nav bağlantısı) ────────────────────────────────────
    mapLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentMode === 'map') switchToGallery();
        else switchToMap();
    });

    // ── Geri / İleri (popstate) ──────────────────────────────────────────
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const wantMap = params.get('mode') === 'map';

        // Filtre + sayfa durumunu sessizce geri yükle (yeni geçmiş girişi oluşturma)
        Gallery.restoreFromParams(params, { silent: true });

        if (wantMap && currentMode !== 'map') {
            switchToMap({ pushHistory: false });
        } else if (!wantMap && currentMode !== 'gallery') {
            switchToGallery({ pushHistory: false });
        } else if (currentMode === 'map') {
            PostcardMap.updateMarkers(Gallery.getFiltered());
        }
    });

    // Harita boyutlandırma
    window.addEventListener('resize', () => {
        if (currentMode === 'map') PostcardMap.resize();
    });
})();
