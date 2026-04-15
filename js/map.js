/* ========================================
   Harita Modu — Leaflet Entegrasyonu
   ======================================== */

const PostcardMap = (function () {
    let map = null;
    let markerClusterGroup = null;
    let markers = [];
    let initialized = false;

    function init() {
        // Harita henüz oluşturulmadı, ilk gösterimde oluşturulacak
    }

    function ensureMap() {
        if (initialized) return;

        map = L.map('map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([30, 20], 3);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18
        }).addTo(map);

        markerClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        map.addLayer(markerClusterGroup);
        initialized = true;
    }

    function show(postcards) {
        ensureMap();

        setTimeout(() => {
            map.invalidateSize();
            updateMarkers(postcards);
        }, 100);
    }

    function updateMarkers(postcards) {
        if (!initialized) return;

        markerClusterGroup.clearLayers();
        markers = [];

        postcards.forEach(postcard => {
            if (!postcard.lat || !postcard.lng) return;

            const marker = L.marker([postcard.lat, postcard.lng]);

            const popupContent = `
                <div class="popup-card" onclick="Modal.open(PostcardMap.getPostcardById('${postcard.id}'), PostcardMap.getCurrentPostcards())">
                    <img class="popup-image" src="${Gallery.escapeHtml(postcard.image)}" alt="${Gallery.escapeHtml(postcard.city)}" loading="lazy"
                         onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"120\" fill=\"%23EDE7DB\"><rect width=\"200\" height=\"120\"/><text x=\"100\" y=\"65\" text-anchor=\"middle\" fill=\"%238B7355\" font-size=\"12\" font-family=\"serif\">Gorsel yok</text></svg>')}'">
                    <div class="popup-info">
                        <p class="popup-city">${Gallery.escapeHtml(postcard.city)}</p>
                        <p class="popup-country">${Gallery.escapeHtml(postcard.country)}</p>
                        <span class="popup-detail-link">Detay &rarr;</span>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, {
                minWidth: 200,
                maxWidth: 280,
                className: 'postcard-popup'
            });

            marker.postcardData = postcard;
            markers.push(marker);
            markerClusterGroup.addLayer(marker);
        });

        if (markers.length > 0) {
            const group = L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    function getPostcardById(id) {
        const marker = markers.find(m => m.postcardData.id === id);
        return marker ? marker.postcardData : null;
    }

    function getCurrentPostcards() {
        return markers.map(m => m.postcardData);
    }

    function resize() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    }

    return { init, show, updateMarkers, resize, getPostcardById, getCurrentPostcards };
})();
