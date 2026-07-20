/* ========================================
   Admin Paneli — Supabase Auth + CRUD + Etiket
   ======================================== */

(async function () {
    const loginSection = document.getElementById('login-section');
    const adminPanel   = document.getElementById('admin-panel');
    const logoutBtn    = document.getElementById('logout-btn');
    const editorLink   = document.getElementById('editor-link');
    const loginForm    = document.getElementById('login-form');
    const loginError   = document.getElementById('login-error');
    const postcardForm = document.getElementById('postcard-form');
    const formTitle    = document.getElementById('form-title');
    const formSubmitBtn = document.getElementById('form-submit-btn');
    const formCancelBtn = document.getElementById('form-cancel-btn');
    const editIdField  = document.getElementById('edit-id');
    const tbody        = document.getElementById('postcards-tbody');
    const tableEmpty   = document.getElementById('table-empty');
    const tableSearch  = document.getElementById('table-search');

    const imageThumbInput  = document.getElementById('form-image-thumb');
    const previewThumb     = document.getElementById('image-preview-thumb');
    const placeholderThumb = document.getElementById('upload-placeholder-thumb');
    const uploadAreaThumb  = document.getElementById('image-upload-thumb');
    const tagsInput  = document.getElementById('form-tags');
    const tagsChips  = document.getElementById('form-tags-chips');

    let adminMap = null;
    let adminMarker = null;
    let currentThumbFile = null;
    let currentTags = [];
    let tableAllPostcards = [];

    // Birleşik, sıralanabilir görsel listesi (ön + arka + ek)
    const imageList = new ImageListEditor(document.getElementById('form-image-list'), {
        idProvider: () => editIdField.value || Date.now()
    });
    document.getElementById('form-image-add-btn').addEventListener('click', () => imageList.addSlot());

    // ── Oturum kontrolü ─────────────────────────────────────────────────
    const session = await Auth.getSession();
    if (session) showAdmin();

    Auth.onAuthChange((event, session) => {
        if (session) showAdmin();
        else showLogin();
    });

    // ── Giriş ────────────────────────────────────────────────────────────
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        formSubmitBtn && (formSubmitBtn.disabled = true);
        const result = await Auth.login(email, password);
        if (result.success) {
            loginError.style.display = 'none';
            showAdmin();
        } else {
            loginError.style.display = 'block';
            loginError.textContent = result.message || 'E-posta veya şifre hatalı.';
        }
        formSubmitBtn && (formSubmitBtn.disabled = false);
    });

    logoutBtn.addEventListener('click', async () => { await Auth.logout(); showLogin(); });

    function showLogin() {
        loginSection.style.display = 'flex';
        adminPanel.style.display   = 'none';
        logoutBtn.style.display    = 'none';
        if (editorLink) editorLink.style.display = 'none';
    }

    async function showAdmin() {
        loginSection.style.display = 'none';
        adminPanel.style.display   = 'block';
        logoutBtn.style.display    = 'inline-flex';
        if (editorLink) editorLink.style.display = 'inline';
        initAdminMap();
        await loadTable();
    }

    // ── Admin Haritası ───────────────────────────────────────────────────
    function initAdminMap() {
        if (adminMap) return;
        adminMap = L.map('admin-map', { minZoom: 2, maxZoom: 19 }).setView([39.9, 32.8], 3);
        if (typeof MapBase !== 'undefined') {
            MapBase.addBaseLayer(adminMap);
        } else {
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap', maxZoom: 18
            }).addTo(adminMap);
        }
        adminMap.on('click', (e) => setMapMarker(e.latlng.lat, e.latlng.lng));
        setTimeout(() => adminMap.invalidateSize(), 200);
    }

    function setMapMarker(lat, lng) {
        document.getElementById('form-lat').value = lat.toFixed(6);
        document.getElementById('form-lng').value = lng.toFixed(6);
        if (adminMarker) adminMarker.setLatLng([lat, lng]);
        else adminMarker = L.marker([lat, lng]).addTo(adminMap);
    }

    document.getElementById('form-lat').addEventListener('change', updateMarkerFromInputs);
    document.getElementById('form-lng').addEventListener('change', updateMarkerFromInputs);

    function updateMarkerFromInputs() {
        const lat = parseFloat(document.getElementById('form-lat').value);
        const lng = parseFloat(document.getElementById('form-lng').value);
        if (!isNaN(lat) && !isNaN(lng)) { setMapMarker(lat, lng); adminMap.setView([lat, lng], 8); }
    }

    // ── Konum Arama (Nominatim) ──────────────────────────────────────────
    const mapSearchInput   = document.getElementById('map-search-input');
    const mapSearchBtn     = document.getElementById('map-search-btn');
    const mapSearchResults = document.getElementById('map-search-results');

    async function searchLocation() {
        const query = mapSearchInput.value.trim();
        if (!query) return;
        mapSearchBtn.disabled = true;
        mapSearchBtn.textContent = '...';
        mapSearchResults.style.display = 'none';
        mapSearchResults.innerHTML = '';
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'tr,en' } });
            const items = await res.json();
            if (!items.length) {
                mapSearchResults.innerHTML = '<div class="map-search-no-result">Sonuç bulunamadı.</div>';
                mapSearchResults.style.display = 'block';
                return;
            }
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'map-search-result-item';
                div.textContent = item.display_name;
                div.addEventListener('click', () => {
                    const lat = parseFloat(item.lat);
                    const lng = parseFloat(item.lon);
                    setMapMarker(lat, lng);
                    adminMap.setView([lat, lng], 10);
                    mapSearchResults.style.display = 'none';
                    mapSearchInput.value = '';
                });
                mapSearchResults.appendChild(div);
            });
            mapSearchResults.style.display = 'block';
        } catch (err) {
            mapSearchResults.innerHTML = '<div class="map-search-no-result">Arama hatası, tekrar deneyin.</div>';
            mapSearchResults.style.display = 'block';
        } finally {
            mapSearchBtn.disabled = false;
            mapSearchBtn.textContent = 'Ara';
        }
    }

    mapSearchBtn.addEventListener('click', searchLocation);
    mapSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchLocation(); } });
    document.addEventListener('click', (e) => {
        if (!mapSearchResults.contains(e.target) && e.target !== mapSearchInput && e.target !== mapSearchBtn) {
            mapSearchResults.style.display = 'none';
        }
    });

    // ── Etiket alanı ─────────────────────────────────────────────────────
    function setupTagInput() {
        function addTag(raw) {
            const tag = raw.trim();
            if (!tag || currentTags.includes(tag)) return;
            currentTags.push(tag);
            renderTagChips();
        }
        tagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = tagsInput.value.replace(/,+$/, '').trim();
                if (val) { addTag(val); tagsInput.value = ''; }
            }
        });
        tagsInput.addEventListener('blur', () => {
            const val = tagsInput.value.replace(/,+$/, '').trim();
            if (val) { addTag(val); tagsInput.value = ''; }
        });
        tagsInput.addEventListener('paste', () => {
            setTimeout(() => {
                const parts = tagsInput.value.split(',');
                parts.forEach(p => { if (p.trim()) addTag(p.trim()); });
                tagsInput.value = '';
            }, 50);
        });
    }
    setupTagInput();

    function renderTagChips() {
        tagsChips.innerHTML = '';
        currentTags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'admin-tag-chip';
            chip.textContent = tag;
            chip.title = 'Kaldırmak için tıkla';
            chip.addEventListener('click', () => {
                currentTags = currentTags.filter(t => t !== tag);
                renderTagChips();
            });
            tagsChips.appendChild(chip);
        });
    }

    // ── Görsel yükleme ────────────────────────────────────────────────────
    setupImageUpload(imageThumbInput, uploadAreaThumb, previewThumb, placeholderThumb);

    function setupImageUpload(input, area, preview, placeholder) {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) { currentThumbFile = file; showPreview(file, preview, placeholder); }
        });
        area.addEventListener('dragover',  (e) => { e.preventDefault(); area.classList.add('dragover'); });
        area.addEventListener('dragleave', () => area.classList.remove('dragover'));
        area.addEventListener('drop', (e) => {
            e.preventDefault(); area.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('image/')) { currentThumbFile = file; showPreview(file, preview, placeholder); }
        });
    }

    function showPreview(file, preview, placeholder) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    async function uploadToStorage(file, path) {
        const { error } = await SupabaseClient.storage.from('postcards').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
        if (error) throw new Error(`Görsel yükleme hatası: ${error.message}`);
        const { data } = SupabaseClient.storage.from('postcards').getPublicUrl(path);
        return data.publicUrl;
    }

    // ── Form gönderimi ───────────────────────────────────────────────────
    postcardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId     = editIdField.value;
        const city       = document.getElementById('form-city').value.trim();
        const country    = document.getElementById('form-country').value.trim();
        const date       = document.getElementById('form-date').value;
        const description    = document.getElementById('form-description').value.trim();
        const description_en = document.getElementById('form-description-en').value.trim();
        const lat = parseFloat(document.getElementById('form-lat').value);
        const lng = parseFloat(document.getElementById('form-lng').value);

        if (!city || !country || !date || isNaN(lat) || isNaN(lng)) {
            alert('Lütfen tüm zorunlu alanları doldurun.');
            return;
        }
        if (!imageList.hasAny()) {
            alert('Lütfen en az bir görsel ekleyin.');
            return;
        }

        formSubmitBtn.disabled = true;
        formSubmitBtn.textContent = 'Yükleniyor...';

        try {
            const record = { city, country, date, description, description_en, lat, lng, tags: currentTags };
            const safeName = `${Date.now()}-${city.toLowerCase().replace(/[^a-z0-9]/gi, '-')}`;

            // Ön/arka/ek görseller — birleşik listeden kolonlara serileştir
            // (kullanılmayan alanlar açıkça null/[] yazılır)
            Object.assign(record, await imageList.toRecord());

            if (currentThumbFile) {
                const resized = await ImageUtils.resizeImage(currentThumbFile, 600, 0.82);
                record.image_thumbnail = await uploadToStorage(resized, `optimized/${safeName}-thumb.jpg`);
            }

            if (editId) await PostcardData.update(editId, record);
            else await PostcardData.add(record);

            PostcardData.invalidateCache();
            resetForm();
            await loadTable();
        } catch (err) {
            alert(`Hata: ${err.message}`);
        } finally {
            formSubmitBtn.disabled = false;
            formSubmitBtn.textContent = editIdField.value ? 'Güncelle' : 'Kartpostal Ekle';
        }
    });

    formCancelBtn.addEventListener('click', resetForm);

    function resetForm() {
        postcardForm.reset();
        editIdField.value = '';
        currentThumbFile = null;
        currentTags = [];
        renderTagChips();
        imageList.clear();
        previewThumb.style.display = 'none';
        placeholderThumb.style.display = '';
        formTitle.textContent     = 'Yeni Kartpostal Ekle';
        formSubmitBtn.textContent = 'Kartpostal Ekle';
        formCancelBtn.style.display = 'none';
        if (adminMarker) { adminMap.removeLayer(adminMarker); adminMarker = null; }
    }

    // ── Tablo + Arama ─────────────────────────────────────────────────────
    tableSearch.addEventListener('input', () => renderTable(tableAllPostcards));

    async function loadTable() {
        tableAllPostcards = await PostcardData.getAll();
        tableSearch.value = '';
        renderTable(tableAllPostcards);
    }

    function renderTable(postcards) {
        const q = tableSearch.value.toLowerCase().trim();
        const filtered = q ? postcards.filter(pc =>
            (pc.city    || '').toLowerCase().includes(q) ||
            (pc.country || '').toLowerCase().includes(q) ||
            (pc.tags    || []).some(t => t.toLowerCase().includes(q))
        ) : postcards;

        tbody.innerHTML = '';
        if (!filtered.length) { tableEmpty.style.display = 'block'; return; }
        tableEmpty.style.display = 'none';
        filtered.forEach(pc => renderRow(pc));
    }

    function renderRow(pc) {
        const tr = document.createElement('tr');
        const imgSrc = pc.image_thumbnail || pc.image_front || pc.imageFront || pc.image || '';
        const formattedDate = pc.date ? new Date(pc.date).toLocaleDateString('tr-TR', {
            year: 'numeric', month: 'short', day: 'numeric'
        }) : '';
        const tagHtml = (pc.tags || []).map(t => `<span class="table-tag">${escapeHtml(t)}</span>`).join(' ');

        tr.innerHTML = `
            <td><img class="table-thumb" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(pc.city)}" onerror="this.style.display='none'"></td>
            <td>${escapeHtml(pc.city)}</td>
            <td>${escapeHtml(pc.country)}</td>
            <td>${formattedDate}</td>
            <td class="table-tags-cell">${tagHtml || '<span class="no-tags">—</span>'}</td>
            <td class="table-actions">
                <button class="btn btn-edit">Düzenle</button>
                <button class="btn btn-danger">Sil</button>
            </td>
        `;
        tr.querySelector('.btn-edit').addEventListener('click', () => editPostcard(pc));
        tr.querySelector('.btn-danger').addEventListener('click', async () => {
            if (confirm(`"${pc.city}, ${pc.country}" kartpostalını silmek istediğinize emin misiniz?`)) {
                await PostcardData.remove(pc.id);
                PostcardData.invalidateCache();
                tableAllPostcards = tableAllPostcards.filter(p => p.id !== pc.id);
                renderTable(tableAllPostcards);
            }
        });
        tbody.appendChild(tr);
    }

    function editPostcard(pc) {
        editIdField.value = pc.id;
        document.getElementById('form-city').value       = pc.city;
        document.getElementById('form-country').value    = pc.country;
        document.getElementById('form-date').value       = pc.date || '';
        document.getElementById('form-description').value    = pc.description    || '';
        document.getElementById('form-description-en').value = pc.description_en || '';
        document.getElementById('form-lat').value = pc.lat || '';
        document.getElementById('form-lng').value = pc.lng || '';

        currentTags = [...(pc.tags || [])];
        renderTagChips();

        currentThumbFile = null;
        imageList.fromPostcard(pc);
        const thumbSrc = pc.image_thumbnail || '';
        if (thumbSrc) { previewThumb.src = thumbSrc; previewThumb.style.display = 'block'; placeholderThumb.style.display = 'none'; }
        else { previewThumb.style.display = 'none'; placeholderThumb.style.display = ''; }

        if (pc.lat && pc.lng) { setMapMarker(pc.lat, pc.lng); adminMap.setView([pc.lat, pc.lng], 6); }

        formTitle.textContent     = 'Kartpostal Düzenle';
        formSubmitBtn.textContent = 'Güncelle';
        formCancelBtn.style.display = 'inline-flex';
        postcardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
})();
