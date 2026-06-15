/* ========================================
   Çoklu Dil Desteği (i18n)
   TR / EN / ZH
   ======================================== */

const I18n = (function () {
    const LANG_KEY = 'postcards_lang';
    let currentLang = localStorage.getItem(LANG_KEY) || 'tr';

    const translations = {
        tr: {
            siteTitle: 'Baska Topraklarin Renkleri',
            siteSubtitle: 'Colors of Other Lands',
            navHome: 'Ana Sayfa',
            navMap: 'Harita',
            navAbout: 'Hakkimda',
            navWhatToDo: 'Ne Yapmaliyim?',
            navTags: 'Etiketler',
            filterCountry: 'Ulke',
            filterCity: 'Sehir',
            filterSearch: 'Ara...',
            filterSortNew: 'Yeni \u2192 Eski',
            filterSortOld: 'Eski \u2192 Yeni',
            filterSort: 'Sirala',
            filterAll: 'Tumu',
            emptyTitle: 'Henuz kartpostal eklenmemis',
            emptyDesc: 'Yonetici panelinden ilk kartpostalinizi ekleyin.',
            noResults: 'Sonuc bulunamadi',
            noResultsDesc: 'Farkli bir filtre veya arama terimi deneyin.',
            openNewTab: 'Yeni sekmede ac',
            modalPrev: 'Onceki',
            modalNext: 'Sonraki',
            close: 'Kapat',
            frontSide: 'On Yuz',
            backSide: 'Arka Yuz',
            description: 'Aciklama',
            similarCards: 'Benzer Kartpostallar',
            location: 'Konum',
            paginationFirst: '\u00ab Ilk',
            paginationPrev: '\u2039 Onceki',
            paginationNext: 'Sonraki \u203a',
            paginationLast: 'Son \u00bb',
            footerText: '\u00a9 2026 Baska Topraklarin Renkleri',
            translationNote: '',
            backToCollection: 'Koleksiyona don',
            aboutTitle: 'Hakkimda',
            whatToDoTitle: 'Ne Yapmaliyim?',
            tagCloudTitle: 'Etiket Bulutu',
            tagCloudDesc: 'Bir etikete tiklayarak o etiketi iceren kartpostallari goruntuleyin.',
            removeTag: 'Etiketi kald\u0131r',
            needsReview: 'Gozden Gecirilmeli',
            reviewReasonNoCoords: 'Koordinat yok',
            reviewReasonNoImage: 'Gorsel yok',
            reviewReasonMultiPostcard: 'Cok kartpostal',
            reviewReasonAmbiguous: 'Belirsiz on/arka',
            reviewReasonNoCountry: 'Ulke tespit edilemedi',
            savingChanges: 'Kaydediliyor...',
            saveSuccess: 'Kaydedildi!',
            saveError: 'Kaydetme hatasi'
        },
        en: {
            siteTitle: 'Colors of Other Lands',
            siteSubtitle: 'Baska Topraklarin Renkleri',
            navHome: 'Main Page',
            navMap: 'Map View',
            navAbout: 'About Me',
            navWhatToDo: 'What to Do?',
            navTags: 'Tags',
            filterCountry: 'Country',
            filterCity: 'City',
            filterSearch: 'Search...',
            filterSortNew: 'Newest First',
            filterSortOld: 'Oldest First',
            filterSort: 'Sort',
            filterAll: 'All',
            emptyTitle: 'No postcards yet',
            emptyDesc: 'Add your first postcard from the admin panel.',
            noResults: 'No results found',
            noResultsDesc: 'Try a different filter or search term.',
            openNewTab: 'Open in new tab',
            modalPrev: 'Previous',
            modalNext: 'Next',
            close: 'Close',
            frontSide: 'Front',
            backSide: 'Back',
            description: 'Description',
            similarCards: 'Similar Postcards',
            location: 'Location',
            paginationFirst: '\u00ab First',
            paginationPrev: '\u2039 Prev',
            paginationNext: 'Next \u203a',
            paginationLast: 'Last \u00bb',
            footerText: '\u00a9 2026 Colors of Other Lands',
            translationNote: '',
            backToCollection: 'Back to collection',
            aboutTitle: 'About Me',
            whatToDoTitle: 'What to Do?',
            tagCloudTitle: 'Tag Cloud',
            tagCloudDesc: 'Click a tag to view postcards with that tag.',
            removeTag: 'Remove tag',
            needsReview: 'Needs Review',
            reviewReasonNoCoords: 'No coordinates',
            reviewReasonNoImage: 'No image',
            reviewReasonMultiPostcard: 'Multiple postcards',
            reviewReasonAmbiguous: 'Front/back ambiguous',
            reviewReasonNoCountry: 'Country not detected',
            savingChanges: 'Saving...',
            saveSuccess: 'Saved!',
            saveError: 'Save error'
        },
        zh: {
            siteTitle: '\u5f02\u57df\u4e4b\u8272',
            siteSubtitle: 'Colors of Other Lands',
            navHome: '\u4e3b\u9875',
            navMap: '\u5730\u56fe',
            navAbout: '\u5173\u4e8e\u6211',
            navWhatToDo: '\u600e\u4e48\u505a\uff1f',
            navTags: '\u6807\u7b7e',
            filterCountry: '\u56fd\u5bb6',
            filterCity: '\u57ce\u5e02',
            filterSearch: '\u641c\u7d22...',
            filterSortNew: '\u6700\u65b0\u4f18\u5148',
            filterSortOld: '\u6700\u65e7\u4f18\u5148',
            filterSort: '\u6392\u5e8f',
            filterAll: '\u5168\u90e8',
            emptyTitle: '\u8fd8\u6ca1\u6709\u660e\u4fe1\u7247',
            emptyDesc: '\u4ece\u7ba1\u7406\u9762\u677f\u6dfb\u52a0\u60a8\u7684\u7b2c\u4e00\u5f20\u660e\u4fe1\u7247\u3002',
            noResults: '\u672a\u627e\u5230\u7ed3\u679c',
            noResultsDesc: '\u8bf7\u5c1d\u8bd5\u4e0d\u540c\u7684\u7b5b\u9009\u6761\u4ef6\u3002',
            openNewTab: '\u5728\u65b0\u6807\u7b7e\u9875\u4e2d\u6253\u5f00',
            modalPrev: '\u4e0a\u4e00\u5f20',
            modalNext: '\u4e0b\u4e00\u5f20',
            close: '\u5173\u95ed',
            frontSide: '\u6b63\u9762',
            backSide: '\u80cc\u9762',
            description: '\u8bf4\u660e',
            similarCards: '\u7c7b\u4f3c\u7684\u660e\u4fe1\u7247',
            location: '\u4f4d\u7f6e',
            paginationFirst: '\u00ab \u9996\u9875',
            paginationPrev: '\u2039 \u4e0a\u4e00\u9875',
            paginationNext: '\u4e0b\u4e00\u9875 \u203a',
            paginationLast: '\u672b\u9875 \u00bb',
            footerText: '\u00a9 2026 \u5f02\u57df\u4e4b\u8272',
            translationNote: '\u81ea\u52a8\u7ffb\u8bd1\uff0c\u53ef\u80fd\u6709\u8bef / Automatically translated, may contain errors',
            backToCollection: '\u8fd4\u56de\u6536\u85cf',
            aboutTitle: '\u5173\u4e8e\u6211',
            whatToDoTitle: '\u600e\u4e48\u505a\uff1f',
            tagCloudTitle: '\u6807\u7b7e\u4e91',
            tagCloudDesc: '\u70b9\u51fb\u6807\u7b7e\u67e5\u770b\u76f8\u5173\u660e\u4fe1\u7247\u3002',
            removeTag: '\u5220\u9664\u6807\u7b7e',
            needsReview: '\u9700\u8981\u5ba1\u6838',
            reviewReasonNoCoords: '\u65e0\u5750\u6807',
            reviewReasonNoImage: '\u65e0\u56fe\u7247',
            reviewReasonMultiPostcard: '\u591a\u5f20\u660e\u4fe1\u7247',
            reviewReasonAmbiguous: '\u6b63\u80cc\u9762\u4e0d\u660e\u786e',
            reviewReasonNoCountry: '\u672a\u68c0\u6d4b\u5230\u56fd\u5bb6',
            savingChanges: '\u4fdd\u5b58\u4e2d...',
            saveSuccess: '\u5df2\u4fdd\u5b58\uff01',
            saveError: '\u4fdd\u5b58\u9519\u8bef'
        }
    };

    function t(key) {
        return (translations[currentLang] && translations[currentLang][key]) ||
               (translations['tr'] && translations['tr'][key]) ||
               key;
    }

    function getLang() {
        return currentLang;
    }

    function setLang(lang) {
        if (!translations[lang]) return;
        currentLang = lang;
        localStorage.setItem(LANG_KEY, lang);
        applyTranslations();
        updateLangButtons();
        if (typeof Gallery !== 'undefined' && Gallery.refreshCountryFilter) {
            Gallery.refreshCountryFilter();
        }
    }

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = t(key);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = val;
            } else if (el.tagName === 'OPTION') {
                el.textContent = val;
            } else {
                el.textContent = val;
            }
        });
    }

    function updateLangButtons() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
    }

    function translateCountry(name) {
        if (typeof CountryTranslator === 'undefined') return name;
        return CountryTranslator.translate(name, currentLang);
    }

    function getDescription(postcard) {
        // Supabase şeması: description + description_en
        return {
            text: postcard.description || '',
            text2: postcard.description_en || '',
            note: currentLang === 'zh' ? t('translationNote') : ''
        };
    }

    function init() {
        applyTranslations();
        updateLangButtons();

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('lang-btn')) {
                setLang(e.target.dataset.lang);
                // Galeri ve filtreleri yeniden render et
                if (typeof Gallery !== 'undefined') Gallery.applyFilters();
            }
        });
    }

    return { t, getLang, setLang, init, getDescription, applyTranslations, translateCountry };
})();
