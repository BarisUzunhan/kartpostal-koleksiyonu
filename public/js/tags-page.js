/* ========================================
   Etiket Bulutu Sayfası
   ======================================== */

(async function () {
    I18n.init();

    const container = document.getElementById('tag-cloud-container');
    const statsEl = document.getElementById('tag-stats');
    const countText = document.getElementById('tag-count-text');

    // Tüm kartpostalları yükle
    const postcards = await PostcardData.getAll();
    if (!postcards || postcards.length === 0) {
        container.innerHTML = '<p class="no-results-title">Henüz kartpostal eklenmemiş.</p>';
        return;
    }

    // Etiket → sayı
    const tagCounts = PostcardData.getAllTags(postcards);
    const tagEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]); // frekansa göre azalan

    if (tagEntries.length === 0) {
        container.innerHTML = '<p class="no-results-title">Henüz etiket eklenmemiş.</p>';
        return;
    }

    // Boyut aralığı: 0.85rem (en az) → 2.6rem (en fazla)
    const maxCount = tagEntries[0][1];
    const minCount = tagEntries[tagEntries.length - 1][1];
    const minSize = 0.85, maxSize = 2.6;

    function fontSize(count) {
        if (maxCount === minCount) return (minSize + maxSize) / 2;
        return minSize + ((count - minCount) / (maxCount - minCount)) * (maxSize - minSize);
    }

    // Opaklık: düşük frekanslı etiketler bile okunaklı kalsın
    function opacity(count) {
        if (maxCount === minCount) return 0.85;
        return 0.65 + ((count - minCount) / (maxCount - minCount)) * 0.35;
    }

    container.innerHTML = '';
    for (const [tag, count] of tagEntries) {
        const a = document.createElement('a');
        a.className = 'tag-cloud-word';
        a.href = `index.html?tag=${encodeURIComponent(tag)}`;
        a.textContent = tag;
        a.title = `${count} kartpostal`;
        a.style.fontSize = `${fontSize(count).toFixed(2)}rem`;
        a.style.opacity = `${opacity(count).toFixed(2)}`;
        a.dataset.count = count;
        container.appendChild(a);
        container.appendChild(document.createTextNode(' '));
    }

    // İstatistik
    statsEl.style.display = '';
    countText.textContent = `${tagEntries.length} etiket · ${postcards.length} kartpostal`;
})();
