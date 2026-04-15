/* ========================================
   Modal / Popup Bileşeni
   ======================================== */

const Modal = (function () {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    const imgEl = document.getElementById('modal-image');
    const cityEl = document.getElementById('modal-city');
    const countryEl = document.getElementById('modal-country');
    const dateEl = document.getElementById('modal-date');
    const descEl = document.getElementById('modal-description');
    const openPageEl = document.getElementById('modal-open-page');

    let currentPostcard = null;
    let postcardList = [];
    let currentIndex = -1;

    function init() {
        closeBtn.addEventListener('click', close);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePrev();
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateNext();
        });

        document.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('visible')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') navigatePrev();
            if (e.key === 'ArrowRight') navigateNext();
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
    }

    function renderContent(postcard) {
        imgEl.src = postcard.image;
        imgEl.alt = postcard.city;
        cityEl.textContent = postcard.city;
        countryEl.textContent = postcard.country;
        dateEl.textContent = Gallery.formatDate(postcard.date);
        descEl.textContent = postcard.description || '';
        openPageEl.href = `postcard.html?id=${encodeURIComponent(postcard.id)}`;
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
