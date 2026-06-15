/* ========================================
   Modal — Çift Görsel + Dil Desteği + Etiket Rozetleri
   ======================================== */

const Modal = (function () {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    const imgFront = document.getElementById('modal-img-front');
    const imgBack = document.getElementById('modal-img-back');
    const imgPrevBtn = document.getElementById('img-prev');
    const imgNextBtn = document.getElementById('img-next');
    const imgDots = document.getElementById('img-dots');
    const cityEl = document.getElementById('modal-city');
    const countryEl = document.getElementById('modal-country');
    const descEl = document.getElementById('modal-description');
    const desc2El = document.getElementById('modal-description-2');
    const translationNoteEl = document.getElementById('modal-translation-note');
    const openPageEl = document.getElementById('modal-open-page');

    let currentPostcard = null;
    let postcardList = [];
    let currentIndex = -1;
    let currentSlide = 0;

    function init() {
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigatePrev(); });
        nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateNext(); });

        imgPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); showSlide(0); });
        imgNextBtn.addEventListener('click', (e) => { e.stopPropagation(); showSlide(1); });

        imgDots.addEventListener('click', (e) => {
            if (e.target.classList.contains('img-dot')) {
                e.stopPropagation();
                showSlide(parseInt(e.target.dataset.index));
            }
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
        currentSlide = 0;
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
        const frontSrc = PostcardData.getImage(postcard);
        // Supabase şeması: image_back; eski uyumluluk: imageBack
        const backSrc = postcard.image_back || postcard.imageBack || '';

        imgFront.src = frontSrc;
        imgFront.alt = postcard.city;

        if (backSrc) {
            imgBack.src = backSrc;
            imgBack.alt = postcard.city + ' - arka yüz';
            imgBack.style.display = '';
            imgPrevBtn.style.display = '';
            imgNextBtn.style.display = '';
            imgDots.style.display = '';
        } else {
            imgBack.src = '';
            imgBack.style.display = 'none';
            imgPrevBtn.style.display = 'none';
            imgNextBtn.style.display = 'none';
            imgDots.style.display = 'none';
        }

        showSlide(0);

        cityEl.textContent = postcard.city;
        countryEl.textContent = I18n.translateCountry(postcard.country);

        // Açıklamalar (TR + EN)
        const desc = I18n.getDescription(postcard);
        descEl.textContent = desc.text;
        descEl.style.display = desc.text ? '' : 'none';

        if (desc.text2) {
            desc2El.textContent = desc.text2;
            desc2El.style.display = '';
        } else {
            desc2El.style.display = 'none';
        }

        if (desc.note) {
            translationNoteEl.textContent = desc.note;
            translationNoteEl.style.display = '';
        } else {
            translationNoteEl.style.display = 'none';
        }

        // Etiket rozetleri
        renderTags(postcard);

        openPageEl.href = `postcard.html?id=${encodeURIComponent(postcard.id)}`;
    }

    function renderTags(postcard) {
        // Varsa önceki etiket alanını temizle
        const existing = document.getElementById('modal-tags');
        if (existing) existing.remove();

        const tags = I18n.filterTagsByLang(postcard.tags || []);
        if (!tags.length) return;

        const tagsDiv = document.createElement('div');
        tagsDiv.id = 'modal-tags';
        tagsDiv.className = 'modal-tags';

        tags.forEach(tag => {
            const chip = document.createElement('a');
            chip.className = 'tag-chip';
            chip.textContent = tag;
            chip.href = `index.html?tag=${encodeURIComponent(tag)}`;
            chip.title = `"${tag}" etiketini görüntüle`;
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                close();
                // Sayfayı etiketle yenile
                window.location.href = `index.html?tag=${encodeURIComponent(tag)}`;
            });
            tagsDiv.appendChild(chip);
        });

        // Açıklama alanının altına ekle
        openPageEl.before(tagsDiv);
    }

    function showSlide(index) {
        currentSlide = index;
        imgFront.classList.toggle('active-slide', index === 0);
        imgBack.classList.toggle('active-slide', index === 1);
        const dots = imgDots.querySelectorAll('.img-dot');
        dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
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
