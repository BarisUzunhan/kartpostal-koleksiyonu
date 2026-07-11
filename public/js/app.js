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

    // URL'de etiket veya mod parametresi var mı?
    const urlParams = new URLSearchParams(window.location.search);
    const urlTag = urlParams.get('tag');
    const urlMode = urlParams.get('mode');

    // Veri durumuna göre görünüm
    const emptyState = document.getElementById('empty-state');
    const galleryContainer = document.getElementById('gallery-container');
    const paginationContainer = document.getElementById('pagination-container');

    if (postcards.length === 0) {
        emptyState.style.display = 'flex';
        galleryContainer.style.display = 'none';
        paginationContainer.style.display = 'none';
    } else {
        emptyState.style.display = 'none';

        // Etiket parametresi varsa uygula
        if (urlTag) {
            Gallery.setActiveTag(urlTag);
        }

        Gallery.render(PostcardData.filterPostcards(postcards, {
            sortBy: document.getElementById('filter-sort').value,
            tag: urlTag || ''
        }));
    }

    // ── Mod değişimi (Galeri ↔ Harita) ──────────────────────────────────
    const navLinks = document.querySelectorAll('.nav-link');
    const mapLink = document.getElementById('nav-map-link');
    const mapContainer = document.getElementById('map-container');
    let currentMode = 'gallery';

    if (urlMode === 'map') switchToMap();

    mapLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentMode === 'map') switchToGallery();
        else switchToMap();
    });

    function switchToMap() {
        currentMode = 'map';
        galleryContainer.style.display = 'none';
        paginationContainer.style.display = 'none';
        mapContainer.style.display = '';
        emptyState.style.display = 'none';
        // Filtre çubuğu haritada da açık kalır — pinler filtreye göre güncellenir
        // (Gallery.applyFilters() zaten PostcardMap.updateMarkers'ı çağırıyor)
        mapLink.classList.add('active');
        document.querySelector('.nav-link[href="index.html"]').classList.remove('active');
        PostcardMap.show(Gallery.getFiltered());
    }

    function switchToGallery() {
        currentMode = 'gallery';
        galleryContainer.style.display = '';
        paginationContainer.style.display = '';
        mapContainer.style.display = 'none';
        mapLink.classList.remove('active');
        document.querySelector('.nav-link[href="index.html"]').classList.add('active');
        if (postcards.length === 0) {
            emptyState.style.display = 'flex';
            galleryContainer.style.display = 'none';
            paginationContainer.style.display = 'none';
        }
    }

    // Harita boyutlandırma
    window.addEventListener('resize', () => {
        if (currentMode === 'map') PostcardMap.resize();
    });
})();
