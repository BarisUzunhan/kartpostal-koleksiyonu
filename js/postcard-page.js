/* ========================================
   Tekil Kartpostal Detay Sayfası
   ======================================== */

(function () {
    const container = document.getElementById('detail-content');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        showNotFound();
        return;
    }

    const postcard = PostcardData.getById(id);

    if (!postcard) {
        showNotFound();
        return;
    }

    document.title = `${postcard.city}, ${postcard.country} — Kartpostal Koleksiyonu`;

    const formattedDate = formatDate(postcard.date);

    container.innerHTML = `
        <div class="detail-card fade-in">
            <div class="detail-image-wrapper">
                <img src="${escapeHtml(postcard.image)}" alt="${escapeHtml(postcard.city)}"
                     onerror="this.parentElement.innerHTML='<p style=&quot;padding:3rem;color:var(--color-text-muted)&quot;>Gorsel yuklenemedi</p>'">
            </div>
            <div class="detail-info">
                <h2 class="detail-city">${escapeHtml(postcard.city)}</h2>
                <p class="detail-country">${escapeHtml(postcard.country)}</p>
                <p class="detail-date">${formattedDate}</p>
                <p class="detail-description">${escapeHtml(postcard.description)}</p>
            </div>
        </div>
    `;

    function showNotFound() {
        container.innerHTML = `
            <div class="detail-not-found">
                <h2>Kartpostal bulunamadi</h2>
                <p>Aradiginiz kartpostal mevcut degil veya kaldirilmis olabilir.</p>
                <a href="index.html" class="back-link" style="margin-top:1rem;display:inline-flex;">Koleksiyona don</a>
            </div>
        `;
    }

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
})();
