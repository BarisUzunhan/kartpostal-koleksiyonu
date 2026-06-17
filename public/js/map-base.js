/* ========================================
   MapBase — MapLibre GL + OpenFreeMap vektör döşeme
   Dile göre (TR/EN/ZH) harita etiketlerini değiştirir.
   Leaflet marker/cluster kodu aynen çalışır.
   ======================================== */

const MapBase = (function () {
    const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

    // Kayıtlı tüm MapLibre instance'ları
    const mlInstances = [];

    // Dil → MapLibre text-field ifadesi
    function langField(lang) {
        const L = lang === 'tr' ? 'tr'
                : lang === 'zh' ? 'zh'
                : 'en';
        return ['coalesce', ['get', 'name:' + L], ['get', 'name:latin'], ['get', 'name']];
    }

    function applyLang(ml, lang) {
        if (!ml || !ml.isStyleLoaded()) return;
        const field = langField(lang);
        ml.getStyle().layers.forEach(layer => {
            if (layer.type !== 'symbol') return;
            const tf = ml.getLayoutProperty(layer.id, 'text-field');
            if (tf === undefined || tf === null || tf === '') return;
            try { ml.setLayoutProperty(layer.id, 'text-field', field); } catch (_) {}
        });
    }

    /**
     * Leaflet haritasına MapLibre vektör taban katmanı ekler.
     * Leaflet CDN'de L.maplibreGL eklentisi yüklü olmalı.
     */
    function addBaseLayer(leafletMap) {
        if (typeof L === 'undefined' || typeof L.maplibreGL === 'undefined') {
            console.warn('MapBase: L.maplibreGL bulunamadı, taban katman eklenmedi.');
            return null;
        }
        const lang = (typeof I18n !== 'undefined') ? I18n.getLang() : 'en';
        const glLayer = L.maplibreGL({ style: STYLE_URL, attribution: '© OpenFreeMap, © OpenStreetMap' });
        glLayer.addTo(leafletMap);

        const ml = glLayer.getMaplibreMap();

        // styledata: her stil güncellemesinde dili uygula (koşullu)
        ml.on('styledata', () => {
            applyLang(ml, lang);
        });

        // idle: ilk tam yükleme sonrası bir kez daha uygula (çift-dil sorununu giderir)
        ml.once('idle', () => {
            applyLang(ml, lang);
            if (!mlInstances.includes(ml)) mlInstances.push(ml);
        });

        return glLayer;
    }

    /** Kayıtlı tüm haritaların dilini değiştirir. */
    function setLanguage(lang) {
        mlInstances.forEach(ml => applyLang(ml, lang));
    }

    return { addBaseLayer, setLanguage };
})();
