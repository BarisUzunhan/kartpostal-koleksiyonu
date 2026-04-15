/* ========================================
   Ana Uygulama — Başlatma, Mod Değişimi
   ======================================== */

(function () {
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

    if (postcards.length === 0) {
        emptyState.style.display = 'flex';
        galleryContainer.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        Gallery.render(PostcardData.filterPostcards(postcards, {
            sortBy: document.getElementById('filter-sort').value
        }));
    }

    // Mod değişimi
    const modeBtns = document.querySelectorAll('.mode-btn');
    const mapContainer = document.getElementById('map-container');
    const filterBar = document.getElementById('filter-bar');
    let currentMode = 'gallery';

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            if (mode === currentMode) return;

            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = mode;

            if (mode === 'gallery') {
                galleryContainer.style.display = '';
                mapContainer.style.display = 'none';
                filterBar.style.display = '';
                if (postcards.length === 0) {
                    emptyState.style.display = 'flex';
                    galleryContainer.style.display = 'none';
                }
            } else {
                galleryContainer.style.display = 'none';
                mapContainer.style.display = '';
                emptyState.style.display = 'none';
                filterBar.style.display = 'none';
                PostcardMap.show(Gallery.getFiltered());
            }
        });
    });

    // Pencere boyutu değişince haritayı yeniden boyutlandır
    window.addEventListener('resize', () => {
        if (currentMode === 'map') {
            PostcardMap.resize();
        }
    });
})();
