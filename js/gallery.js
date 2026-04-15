/* ========================================
   Galeri Modu — Grid Render, Filtreleme
   ======================================== */

const Gallery = (function () {
    const container = document.getElementById('gallery-container');
    let allPostcards = [];
    let filteredPostcards = [];
    let observer = null;

    function init(postcards) {
        allPostcards = postcards;
        filteredPostcards = [...postcards];
        setupLazyLoading();
        setupFilters();
    }

    function render(postcards) {
        filteredPostcards = postcards;
        container.innerHTML = '';

        if (postcards.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p class="no-results-title">Sonuc bulunamadi</p>
                    <p class="no-results-desc">Farkli bir filtre veya arama terimi deneyin.</p>
                </div>
            `;
            return;
        }

        postcards.forEach((postcard, index) => {
            const card = createCard(postcard, index);
            container.appendChild(card);
        });

        observeImages();
    }

    function createCard(postcard, index) {
        const card = document.createElement('div');
        card.className = 'postcard-card fade-in';
        card.style.animationDelay = `${index * 0.05}s`;
        card.dataset.id = postcard.id;

        const formattedDate = formatDate(postcard.date);

        card.innerHTML = `
            <div class="card-image-wrapper">
                <div class="skeleton"></div>
                <img data-src="${escapeHtml(postcard.image)}" alt="${escapeHtml(postcard.city)}" loading="lazy">
            </div>
            <div class="card-info">
                <h3 class="card-city">${escapeHtml(postcard.city)}</h3>
                <p class="card-country">${escapeHtml(postcard.country)}</p>
                <p class="card-date">${formattedDate}</p>
            </div>
        `;

        card.addEventListener('click', () => {
            Modal.open(postcard, filteredPostcards);
        });

        return card;
    }

    function setupLazyLoading() {
        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        img.addEventListener('load', () => {
                            const skeleton = img.parentElement.querySelector('.skeleton');
                            if (skeleton) skeleton.remove();
                        });
                        img.addEventListener('error', () => {
                            img.src = 'data:image/svg+xml,' + encodeURIComponent(
                                '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23EDE7DB"><rect width="300" height="200"/><text x="150" y="105" text-anchor="middle" fill="%238B7355" font-size="14" font-family="serif">Gorsel yuklenemedi</text></svg>'
                            );
                            const skeleton = img.parentElement.querySelector('.skeleton');
                            if (skeleton) skeleton.remove();
                        });
                    }
                    observer.unobserve(img);
                }
            });
        }, { rootMargin: '100px' });
    }

    function observeImages() {
        const images = container.querySelectorAll('img[data-src]');
        images.forEach(img => observer.observe(img));
    }

    function setupFilters() {
        const countrySelect = document.getElementById('filter-country');
        const citySelect = document.getElementById('filter-city');
        const searchInput = document.getElementById('filter-search');
        const sortSelect = document.getElementById('filter-sort');

        populateCountryFilter(allPostcards);

        countrySelect.addEventListener('change', () => {
            populateCityFilter(allPostcards, countrySelect.value);
            applyFilters();
        });

        citySelect.addEventListener('change', applyFilters);
        sortSelect.addEventListener('change', applyFilters);

        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(applyFilters, 300);
        });
    }

    function populateCountryFilter(postcards) {
        const countrySelect = document.getElementById('filter-country');
        const countries = PostcardData.getUniqueCountries(postcards);
        countrySelect.innerHTML = '<option value="">Tumu</option>';
        countries.forEach(c => {
            countrySelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });
    }

    function populateCityFilter(postcards, country) {
        const citySelect = document.getElementById('filter-city');
        const cities = PostcardData.getCitiesByCountry(postcards, country);
        citySelect.innerHTML = '<option value="">Tumu</option>';
        cities.forEach(c => {
            citySelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });
    }

    function applyFilters() {
        const country = document.getElementById('filter-country').value;
        const city = document.getElementById('filter-city').value;
        const search = document.getElementById('filter-search').value;
        const sortBy = document.getElementById('filter-sort').value;

        const filtered = PostcardData.filterPostcards(allPostcards, { country, city, search, sortBy });
        render(filtered);

        // Harita modunu da güncelle
        if (typeof PostcardMap !== 'undefined' && PostcardMap.updateMarkers) {
            PostcardMap.updateMarkers(filtered);
        }
    }

    function updateData(postcards) {
        allPostcards = postcards;
        populateCountryFilter(postcards);
        applyFilters();
    }

    function getFiltered() {
        return filteredPostcards;
    }

    // Yardımcılar
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init, render, updateData, applyFilters, getFiltered, formatDate, escapeHtml };
})();
