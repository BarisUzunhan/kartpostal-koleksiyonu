/* ========================================
   Galeri Modu — Grid, Pagination, Filtre, Etiket
   ======================================== */

const Gallery = (function () {
    const container = document.getElementById('gallery-container');
    const paginationContainer = document.getElementById('pagination-container');
    let allPostcards = [];
    let filteredPostcards = [];
    let currentPage = 1;
    const perPage = 18;
    let observer = null;
    let activeTag = '';  // aktif etiket filtresi
    let onChange = null; // durum değişince (filtre/sayfa) tetiklenen callback (URL senkronu)
    let restoring = false; // popstate/ilk yükleme sırasında geri-bildirim döngüsünü engeller

    function init(postcards) {
        allPostcards = postcards;
        filteredPostcards = [...postcards];
        setupLazyLoading();
        setupFilters();
    }

    function render(postcards) {
        filteredPostcards = postcards;
        currentPage = 1;
        renderPage();
    }

    function setActiveTag(tag) {
        activeTag = tag;
    }

    function renderPage() {
        container.innerHTML = '';

        if (filteredPostcards.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p class="no-results-title" data-i18n="noResults">${I18n.t('noResults')}</p>
                    <p class="no-results-desc" data-i18n="noResultsDesc">${I18n.t('noResultsDesc')}</p>
                </div>
            `;
            if (paginationContainer) paginationContainer.innerHTML = '';
            renderActiveTagChip();
            return;
        }

        const totalPages = Math.ceil(filteredPostcards.length / perPage);
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * perPage;
        const pageItems = filteredPostcards.slice(start, start + perPage);

        pageItems.forEach((postcard, index) => {
            const card = createCard(postcard, index);
            container.appendChild(card);
        });

        observeImages();
        renderPagination(totalPages);
        renderActiveTagChip();
    }

    function createCard(postcard, index) {
        const card = document.createElement('div');
        card.className = 'postcard-card fade-in';
        card.style.animationDelay = `${index * 0.03}s`;
        card.dataset.id = postcard.id;

        const imgSrc = PostcardData.getThumb(postcard);
        const translatedCountry = I18n.translateCountry(postcard.country);
        const label = escapeHtml(postcard.city) + ', ' + escapeHtml(translatedCountry);

        card.innerHTML = `
            <div class="card-image-wrapper">
                <div class="skeleton"></div>
                <img data-src="${escapeHtml(imgSrc)}" alt="${label}" loading="lazy">
                <div class="card-overlay">
                    <span class="card-name">${label}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => Modal.open(postcard, filteredPostcards));
        return card;
    }

    // ── Aktif etiket chip'i ───────────────────────────────────────────────
    function renderActiveTagChip() {
        let chipContainer = document.getElementById('active-tag-chip');
        if (!chipContainer) {
            chipContainer = document.createElement('div');
            chipContainer.id = 'active-tag-chip';
            chipContainer.className = 'active-tag-chip-container';
            const filterBar = document.getElementById('filter-bar');
            if (filterBar) filterBar.after(chipContainer);
        }
        if (activeTag) {
            chipContainer.innerHTML = `
                <div class="active-tag-chip">
                    <span class="tag-chip-icon">🏷</span>
                    <span>${escapeHtml(activeTag)}</span>
                    <button class="tag-chip-remove" title="${I18n.t('removeTag') || 'Etiketi kaldır'}">&times;</button>
                </div>
            `;
            chipContainer.querySelector('.tag-chip-remove').addEventListener('click', () => {
                activeTag = '';
                document.getElementById('filter-tag-hidden').value = '';
                applyFilters(); // URL senkronu notifyChange üzerinden yapılır (boş tag URL'den düşer)
            });
        } else {
            chipContainer.innerHTML = '';
        }
    }

    // ── Pagination ────────────────────────────────────────────────────────
    function renderPagination(totalPages) {
        if (!paginationContainer) return;
        if (totalPages <= 1) { paginationContainer.innerHTML = ''; return; }

        let html = '';

        if (currentPage > 1) {
            html += `<a data-page="1">${I18n.t('paginationFirst')}</a>`;
            html += `<a data-page="${currentPage - 1}">${I18n.t('paginationPrev')}</a>`;
        } else {
            html += `<span class="disabled">${I18n.t('paginationFirst')}</span>`;
            html += `<span class="disabled">${I18n.t('paginationPrev')}</span>`;
        }

        const range = getPageRange(currentPage, totalPages);
        range.forEach(p => {
            if (p === '...') html += `<span>...</span>`;
            else if (p === currentPage) html += `<span class="active">${p}</span>`;
            else html += `<a data-page="${p}">${p}</a>`;
        });

        if (currentPage < totalPages) {
            html += `<a data-page="${currentPage + 1}">${I18n.t('paginationNext')}</a>`;
            html += `<a data-page="${totalPages}">${I18n.t('paginationLast')}</a>`;
        } else {
            html += `<span class="disabled">${I18n.t('paginationNext')}</span>`;
            html += `<span class="disabled">${I18n.t('paginationLast')}</span>`;
        }

        // Sayfaya git kutusu
        html += `<span class="page-jump">`
            + `<input type="number" min="1" max="${totalPages}" aria-label="${escapeHtml(I18n.t('paginationGoto'))}" placeholder="${currentPage}/${totalPages}">`
            + `<button type="button">${escapeHtml(I18n.t('paginationGo'))}</button>`
            + `</span>`;

        paginationContainer.innerHTML = html;
        paginationContainer.querySelectorAll('a[data-page]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                goToPage(parseInt(a.dataset.page, 10));
            });
        });

        const jump = paginationContainer.querySelector('.page-jump');
        if (jump) {
            const input = jump.querySelector('input');
            const btn = jump.querySelector('button');
            const go = () => {
                const val = parseInt(input.value, 10);
                if (Number.isNaN(val)) { input.value = ''; return; }
                goToPage(val);
            };
            btn.addEventListener('click', go);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); go(); }
            });
        }
    }

    // Tek sayfa-geçiş yolu — pagination linkleri ve "sayfaya git" kutusu bunu kullanır
    function goToPage(n) {
        if (!Number.isFinite(n)) return;
        const totalPages = Math.max(1, Math.ceil(filteredPostcards.length / perPage));
        const target = Math.min(Math.max(1, n), totalPages);
        if (target === currentPage) return;
        currentPage = target;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        notifyChange();
    }

    function notifyChange() {
        if (!restoring && typeof onChange === 'function') onChange();
    }

    function setOnChange(cb) { onChange = cb; }

    function getPageRange(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = [1];
        if (current > 3) pages.push('...');
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
        if (current < total - 2) pages.push('...');
        pages.push(total);
        return pages;
    }

    // ── Lazy loading ──────────────────────────────────────────────────────
    function setupLazyLoading() {
        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                const src = img.dataset.src;
                if (!src) return;
                img.src = src;
                img.removeAttribute('data-src');
                img.addEventListener('load', () => {
                    const sk = img.parentElement.querySelector('.skeleton');
                    if (sk) sk.remove();
                });
                img.addEventListener('error', () => {
                    img.src = 'data:image/svg+xml,' + encodeURIComponent(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23689fb0"><rect width="300" height="200"/><text x="150" y="105" text-anchor="middle" fill="%23fff" font-size="14" font-family="sans-serif">Gorsel yuklenemedi</text></svg>'
                    );
                    const sk = img.parentElement.querySelector('.skeleton');
                    if (sk) sk.remove();
                });
                observer.unobserve(img);
            });
        }, { rootMargin: '100px' });
    }

    function observeImages() {
        container.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
    }

    // ── Filtreler ─────────────────────────────────────────────────────────
    function setupFilters() {
        const countrySelect = document.getElementById('filter-country');
        const citySelect = document.getElementById('filter-city');
        const searchInput = document.getElementById('filter-search');
        const sortSelect = document.getElementById('filter-sort');

        // Gizli etiket alanı (URL'den gelen tag için)
        let hiddenTag = document.getElementById('filter-tag-hidden');
        if (!hiddenTag) {
            hiddenTag = document.createElement('input');
            hiddenTag.type = 'hidden';
            hiddenTag.id = 'filter-tag-hidden';
            hiddenTag.value = activeTag;
            document.body.appendChild(hiddenTag);
        }

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
        countrySelect.innerHTML = `<option value="">${escapeHtml(I18n.t('filterCountry'))}</option>`;
        countries.forEach(c => {
            const displayName = I18n.translateCountry(c);
            countrySelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(displayName)}</option>`;
        });
    }

    function refreshCountryFilter() {
        const savedCountry = document.getElementById('filter-country').value;
        const savedCity = document.getElementById('filter-city').value;
        populateCountryFilter(allPostcards);
        document.getElementById('filter-country').value = savedCountry;
        populateCityFilter(allPostcards, savedCountry);
        document.getElementById('filter-city').value = savedCity;
    }

    function populateCityFilter(postcards, country) {
        const citySelect = document.getElementById('filter-city');
        const cities = PostcardData.getCitiesByCountry(postcards, country);
        citySelect.innerHTML = `<option value="">${escapeHtml(I18n.t('filterCity'))}</option>`;
        cities.forEach(c => {
            citySelect.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });
    }

    function applyFilters() {
        const country = document.getElementById('filter-country').value;
        const city = document.getElementById('filter-city').value;
        const search = document.getElementById('filter-search').value;
        const sortBy = document.getElementById('filter-sort').value;
        const tag = activeTag || (document.getElementById('filter-tag-hidden')?.value || '');

        const filtered = PostcardData.filterPostcards(allPostcards, { country, city, search, sortBy, tag });
        filteredPostcards = filtered;
        currentPage = 1;
        renderPage();

        if (typeof PostcardMap !== 'undefined' && PostcardMap.updateMarkers) {
            PostcardMap.updateMarkers(filtered);
        }

        notifyChange();
    }

    // ── URL durum senkronu ────────────────────────────────────────────────
    function getStateParams() {
        return {
            country: document.getElementById('filter-country')?.value || '',
            city: document.getElementById('filter-city')?.value || '',
            search: document.getElementById('filter-search')?.value || '',
            sort: document.getElementById('filter-sort')?.value || '',
            tag: activeTag || (document.getElementById('filter-tag-hidden')?.value || ''),
            page: currentPage
        };
    }

    // params: URLSearchParams veya düz nesne. silent iken notifyChange tetiklenmez.
    function restoreFromParams(params, { silent = true } = {}) {
        const get = (k) => (params && typeof params.get === 'function')
            ? (params.get(k) || '')
            : ((params && params[k]) || '');

        const country = get('country');
        const city = get('city');
        const search = get('search');
        const sort = get('sort');
        const tag = get('tag');
        const page = parseInt(get('page'), 10) || 1;

        const countrySelect = document.getElementById('filter-country');
        const citySelect = document.getElementById('filter-city');
        const searchInput = document.getElementById('filter-search');
        const sortSelect = document.getElementById('filter-sort');

        restoring = true;

        // Sıra önemli: ülke → şehir seçenekleri → şehir değeri
        if (countrySelect) countrySelect.value = country;
        populateCityFilter(allPostcards, country);
        if (citySelect) citySelect.value = city;
        if (searchInput) searchInput.value = search;
        if (sortSelect && sort) sortSelect.value = sort;

        activeTag = tag;
        const hiddenTag = document.getElementById('filter-tag-hidden');
        if (hiddenTag) hiddenTag.value = tag;

        const filtered = PostcardData.filterPostcards(allPostcards, {
            country, city, search,
            sortBy: sortSelect ? sortSelect.value : sort,
            tag
        });
        filteredPostcards = filtered;

        const totalPages = Math.max(1, Math.ceil(filteredPostcards.length / perPage));
        currentPage = Math.min(Math.max(1, page), totalPages);
        renderPage();

        if (typeof PostcardMap !== 'undefined' && PostcardMap.updateMarkers) {
            PostcardMap.updateMarkers(filtered);
        }

        restoring = false;
        if (!silent) notifyChange();
    }

    function updateData(postcards) {
        allPostcards = postcards;
        populateCountryFilter(postcards);
        applyFilters();
    }

    function getFiltered() { return filteredPostcards; }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init, render, updateData, applyFilters, getFiltered, formatDate, escapeHtml, setActiveTag, refreshCountryFilter, getStateParams, restoreFromParams, setOnChange };
})();
