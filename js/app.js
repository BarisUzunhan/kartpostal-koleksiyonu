/* ========================================
   Ana Uygulama — Başlatma, Mod Değişimi
   ======================================== */

(function () {
    // i18n başlat
    I18n.init();

    // Verileri yükle
    const postcards = PostcardData.getAll();

    // Modal başlat
    Modal.init();

    // Galeri başlat
    Gallery.init(postcards);

    // Harita başlat
    PostcardMap.init();

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
        Gallery.render(PostcardData.filterPostcards(postcards, {
            sortBy: document.getElementById('filter-sort').value
        }));
    }

    // Mod değişimi
    const navLinks = document.querySelectorAll('.nav-link');
    const mapLink = document.getElementById('nav-map-link');
    const mapContainer = document.getElementById('map-container');
    const filterBar = document.getElementById('filter-bar');
    let currentMode = 'gallery';

    // URL parametresi kontrolü
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'map') {
        switchToMap();
    }

    mapLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentMode === 'map') {
            switchToGallery();
        } else {
            switchToMap();
        }
    });

    function switchToMap() {
        currentMode = 'map';
        galleryContainer.style.display = 'none';
        paginationContainer.style.display = 'none';
        mapContainer.style.display = '';
        emptyState.style.display = 'none';
        filterBar.style.display = 'none';
        mapLink.classList.add('active');
        document.querySelector('.nav-link[href="index.html"]').classList.remove('active');
        PostcardMap.show(Gallery.getFiltered());
    }

    function switchToGallery() {
        currentMode = 'gallery';
        galleryContainer.style.display = '';
        paginationContainer.style.display = '';
        mapContainer.style.display = 'none';
        filterBar.style.display = '';
        mapLink.classList.remove('active');
        document.querySelector('.nav-link[href="index.html"]').classList.add('active');
        if (postcards.length === 0) {
            emptyState.style.display = 'flex';
            galleryContainer.style.display = 'none';
            paginationContainer.style.display = 'none';
        }
    }

    // Pencere boyutu değişince haritayı yeniden boyutlandır
    window.addEventListener('resize', () => {
        if (currentMode === 'map') {
            PostcardMap.resize();
        }
    });
})();
