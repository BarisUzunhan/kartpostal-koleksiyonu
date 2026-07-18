/* ========================================
   Ziyaretçi Analitiği — Beacon (first-party, kütüphanesiz)
   Sayfa yükünde bir kez "collect" Edge Function'ına ziyaret kaydı gönderir.
   Doğrudan Supabase'e YAZMAZ; geçit fonksiyonu doğrular ve service_role ile yazar.
   Toplanan veri anonimdir; çerez kullanılmaz (localStorage/sessionStorage).
   ======================================== */
(function () {
    'use strict';

    // Public değerler (supabaseClient.js ile aynı — bu dosya bağımsız çalışsın diye burada da tanımlı)
    var SUPABASE_URL = 'https://eyapkqmmagzstdoxprnp.supabase.co';
    var ANON_KEY     = 'sb_publishable_RUi-Qk_i4Cy0Q22JifYLnA_4Hx_PzvO';
    var ENDPOINT     = SUPABASE_URL + '/functions/v1/collect';

    try {
        var payload = buildPayload();
        send(payload);
    } catch (e) {
        // Analitik asla sayfayı etkilemesin
    }

    // ── Kimlikler (çerezsiz) ──────────────────────────────────────────────
    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    function persistentId(store, key) {
        try {
            var v = store.getItem(key);
            if (!v) { v = uuid(); store.setItem(key, v); }
            return v;
        } catch (e) { return null; }
    }

    // ── Sayfa tipi ────────────────────────────────────────────────────────
    function pageType(path) {
        if (path === '/' || /\/index\.html$/.test(path)) return 'gallery';
        if (/\/postcard\.html$/.test(path))    return 'postcard';
        if (/\/tags\.html$/.test(path))        return 'tags';
        if (/\/about\.html$/.test(path))       return 'about';
        if (/\/what-to-do\.html$/.test(path))  return 'what-to-do';
        return 'other';
    }

    // ── Referrer → host + kaynak kovası ───────────────────────────────────
    var SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|qwant)\./i;
    var SOCIAL = /(^|\.)(facebook|instagram|twitter|x\.com|t\.co|linkedin|pinterest|reddit|youtube|tiktok|whatsapp|telegram|vk)\.?/i;

    function classifyReferrer(ref, utmSource) {
        var host = '';
        try { host = ref ? new URL(ref).hostname : ''; } catch (e) { host = ''; }
        var internal = host && host === location.hostname;
        var source;
        if (utmSource) source = 'campaign';
        else if (!ref) source = 'direct';
        else if (internal) source = 'internal';
        else if (SEARCH.test(host)) source = 'search';
        else if (SOCIAL.test(host)) source = 'social';
        else source = 'referral';
        return { host: internal ? '' : host, source: source };
    }

    // ── Hafif UA ayrıştırma ───────────────────────────────────────────────
    function parseUA(ua) {
        var browser = 'Diğer';
        if (/Edg\//.test(ua)) browser = 'Edge';
        else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
        else if (/SamsungBrowser/.test(ua)) browser = 'Samsung';
        else if (/Firefox\//.test(ua)) browser = 'Firefox';
        else if (/Chrome\//.test(ua)) browser = 'Chrome';
        else if (/Safari\//.test(ua)) browser = 'Safari';

        var os = 'Diğer';
        if (/Windows/.test(ua)) os = 'Windows';
        else if (/Android/.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
        else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
        else if (/Linux/.test(ua)) os = 'Linux';

        var device = 'desktop';
        if (/iPad|Tablet|(Android(?!.*Mobile))/.test(ua)) device = 'tablet';
        else if (/Mobi|iPhone|iPod|Android.*Mobile/.test(ua)) device = 'mobile';

        return { browser: browser, os: os, device_type: device };
    }

    // ── Payload ───────────────────────────────────────────────────────────
    function buildPayload() {
        var path = location.pathname;
        var type = pageType(path);
        var params = new URLSearchParams(location.search);
        // Postcard sayfasında hangi kartın görüntülendiğini ayırt et
        if (type === 'postcard' && params.get('id')) path = path + '?id=' + params.get('id');

        var ref = document.referrer || '';
        var utmSource = params.get('utm_source');
        var rc = classifyReferrer(ref, utmSource);
        var ua = parseUA(navigator.userAgent || '');

        return {
            path: path,
            page_type: type,
            referrer: ref,
            referrer_host: rc.host,
            source: rc.source,
            utm_source: utmSource,
            utm_medium: params.get('utm_medium'),
            utm_campaign: params.get('utm_campaign'),
            browser: ua.browser,
            os: ua.os,
            device_type: ua.device_type,
            language: (navigator.language || '').slice(0, 20),
            screen_w: window.screen ? screen.width : null,
            screen_h: window.screen ? screen.height : null,
            visitor_id: persistentId(localStorage, 'cor_vid'),
            session_id: persistentId(sessionStorage, 'cor_sid')
        };
    }

    // ── Gönderim ──────────────────────────────────────────────────────────
    function send(payload) {
        fetch(ENDPOINT, {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
                'Authorization': 'Bearer ' + ANON_KEY
            },
            body: JSON.stringify(payload)
        }).catch(function () { /* sessiz */ });
    }
})();
