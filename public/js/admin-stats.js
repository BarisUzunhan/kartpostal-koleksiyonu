/* ========================================
   İstatistikler — Ziyaretçi analitiği paneli (admin)
   Veri: Supabase 'stats' RPC (yalnız authenticated). Grafikler bağımlılıksız CSS/SVG.
   ======================================== */
(function () {
    'use strict';

    const tabs = document.querySelectorAll('.admin-tab');
    const panes = {
        postcards: document.getElementById('pane-postcards'),
        stats: document.getElementById('pane-stats')
    };
    if (!tabs.length || !panes.stats) return;

    let currentRange = 7;   // gün; 0 = bugün
    let loadedOnce = false;

    // ── Sekme geçişi ──────────────────────────────────────────────────────
    tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.toggle('active', x === t));
        const pane = t.dataset.pane;
        Object.keys(panes).forEach(k => { if (panes[k]) panes[k].style.display = (k === pane) ? '' : 'none'; });
        if (pane === 'stats' && !loadedOnce) load();
    }));

    // ── Aralık / bot / yenile ────────────────────────────────────────────
    const rangeBtns = document.querySelectorAll('.range-btn');
    rangeBtns.forEach(b => b.addEventListener('click', () => {
        rangeBtns.forEach(x => x.classList.toggle('active', x === b));
        currentRange = parseInt(b.dataset.range, 10);
        load();
    }));
    const refreshBtn = document.getElementById('stats-refresh');
    const botCb = document.getElementById('stats-exclude-bots');
    if (refreshBtn) refreshBtn.addEventListener('click', load);
    if (botCb) botCb.addEventListener('change', load);

    // ── Yükleme ───────────────────────────────────────────────────────────
    async function load() {
        loadedOnce = true;
        const status = document.getElementById('stats-status');
        const content = document.getElementById('stats-content');
        status.style.display = ''; status.textContent = 'Yükleniyor…';
        content.style.display = 'none';

        const to = new Date();
        const from = new Date();
        if (currentRange === 0) from.setHours(0, 0, 0, 0);
        else from.setDate(from.getDate() - currentRange);

        try {
            const { data, error } = await SupabaseClient.rpc('stats', {
                from_ts: from.toISOString(),
                to_ts: to.toISOString(),
                exclude_bots: botCb ? botCb.checked : true
            });
            if (error) throw error;
            render(data || {});
            status.style.display = 'none';
            content.style.display = '';
        } catch (e) {
            status.textContent = 'İstatistik yüklenemedi: ' + (e.message || e);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────
    function render(d) {
        const s = d.summary || {};
        setNum('sc-views', s.views || 0);
        setNum('sc-visitors', s.visitors || 0);
        setNum('sc-sessions', s.sessions || 0);

        renderDaily(d.timeseries || []);
        renderHours(d.by_hour || []);

        topTable('top-pages', d.top_pages);
        topTable('top-sources', d.top_sources);
        topTable('top-referrers', d.top_referrers);
        topTable('top-countries', d.top_countries);
        topTable('top-cities', d.top_cities);
        topTable('top-browsers', d.browsers);
        topTable('top-os', d.os);
        topTable('top-devices', d.devices);
        topTable('top-languages', d.languages);
    }

    function renderDaily(series) {
        const el = document.getElementById('chart-daily');
        if (!series.length) { el.innerHTML = '<p class="stats-empty">Veri yok.</p>'; return; }
        const max = Math.max.apply(null, series.map(x => x.views)) || 1;
        el.innerHTML = series.map(x => {
            const h = Math.max(2, Math.round(x.views / max * 100));
            const label = shortDay(x.day);
            return `<div class="stat-bar" title="${escapeHtml(x.day)}: ${x.views} görüntüleme, ${x.visitors} ziyaretçi">`
                 + `<span class="stat-bar-fill" style="height:${h}%"></span>`
                 + `<span class="stat-bar-x">${escapeHtml(label)}</span></div>`;
        }).join('');
    }

    function renderHours(byHour) {
        const el = document.getElementById('chart-hours');
        const map = {};
        byHour.forEach(x => { map[x.hour] = x.views; });
        const vals = [];
        for (let h = 0; h < 24; h++) vals.push({ hour: h, views: map[h] || 0 });
        const max = Math.max.apply(null, vals.map(x => x.views)) || 1;
        el.innerHTML = vals.map(x => {
            const hgt = Math.max(2, Math.round(x.views / max * 100));
            return `<div class="stat-bar" title="${x.hour}:00 — ${x.views} görüntüleme">`
                 + `<span class="stat-bar-fill" style="height:${hgt}%"></span>`
                 + `<span class="stat-bar-x">${x.hour}</span></div>`;
        }).join('');
    }

    function topTable(id, rows) {
        const el = document.getElementById(id);
        if (!el) return;
        rows = rows || [];
        if (!rows.length) { el.innerHTML = '<p class="stats-empty">Veri yok.</p>'; return; }
        const max = Math.max.apply(null, rows.map(r => r.views)) || 1;
        el.innerHTML = rows.map(r => {
            const w = Math.round(r.views / max * 100);
            return `<div class="stat-row">`
                 + `<span class="stat-row-bar" style="width:${w}%"></span>`
                 + `<span class="stat-row-key" title="${escapeHtml(String(r.key))}">${escapeHtml(String(r.key))}</span>`
                 + `<span class="stat-row-val">${r.views}</span></div>`;
        }).join('');
    }

    // ── Yardımcılar ───────────────────────────────────────────────────────
    function setNum(id, n) {
        const el = document.getElementById(id);
        if (el) el.textContent = Number(n).toLocaleString('tr-TR');
    }
    function shortDay(iso) {
        // '2026-07-18' → '18.07'
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
        return m ? (m[3] + '.' + m[2]) : (iso || '');
    }
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str == null ? '' : String(str);
        return d.innerHTML;
    }
})();
