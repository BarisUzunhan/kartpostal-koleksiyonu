/* ========================================
   Admin Paneli — Supabase Auth + CRUD + Etiket
   ======================================== */

(async function () {
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const logoutBtn = document.getElementById('logout-btn');
    const editorLink = document.getElementById('editor-link');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const postcardForm = document.getElementById('postcard-form');
    const formTitle = document.getElementById('form-title');
    const formSubmitBtn = document.getElementById('form-submit-btn');
    const formCancelBtn = document.getElementById('form-cancel-btn');
    const editIdField = document.getElementById('edit-id');
    const tbody = document.getElementById('postcards-tbody');
    const tableEmpty = document.getElementById('table-empty');

    const imageFrontInput = document.getElementById('form-image-front');
    const imageBackInput = document.getElementById('form-image-back');
    const previewFront = document.getElementById('image-preview-front');
    const previewBack = document.getElementById('image-preview-back');
    const placeholderFront = document.getElementById('upload-placeholder-front');
    const placeholderBack = document.getElementById('upload-placeholder-back');
    const uploadAreaFront = document.getElementById('image-upload-front');
    const uploadAreaBack = document.getElementById('image-upload-back');
    const tagsInput = document.getElementById('form-tags');
    const tagsChips = document.getElementById('form-tags-chips');

    let adminMap = null;
    let adminMarker = null;
    let currentFrontFile = null;
    let currentBackFile = null;
    let currentTags = [];

    // ── Oturum kontrolü ─────────────────────────────────────────────────
    const session = await Auth.getSession();
    if (session) showAdmin();

    Auth.onAuthChange((event, session) => {
        if (session) showAdmin();
        else { showLogin(); }
    });

    // ── Giriş ────────────────────────────────────────────────────────────
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
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

    logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        showLogin();
    });

    function showLogin() {
        loginSection.style.display = 'flex';
        adminPanel.style.display = 'none';
        logoutBtn.style.display = 'none';
        if (editorLink) editorLink.style.display = 'none';
    }

    async function showAdmin() {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        logoutBtn.style.display = 'inline-flex';
        if (editorLink) editorLink.style.display = 'inline';
        initAdminMap();
        await loadTable();
    }

    // ── Admin Haritası ───────────────────────────────────────────────────
    function initAdminMap() {
        if (adminMap) return;
        adminMap = L.map('admin-map').setView([39.9, 32.8], 3);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap', maxZoom: 18
        }).addTo(adminMap);
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

        // virgülle ayrılmış toplu paste
        tagsInput.addEventListener('paste', (e) => {
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
    setupImageUpload(imageFrontInput, uploadAreaFront, previewFront, placeholderFront, 'front');
    setupImageUpload(imageBackInput, uploadAreaBack, previewBack, placeholderBack, 'back');

    function setupImageUpload(input, area, preview, placeholder, side) {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) { storeFile(file, side); showPreview(file, preview, placeholder); }
        });
        area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
        area.addEventListener('dragleave', () => area.classList.remove('dragover'));
        area.addEventListener('drop', (e) => {
            e.preventDefault(); area.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('image/')) { storeFile(file, side); showPreview(file, preview, placeholder); }
        });
    }

    function storeFile(file, side) {
        if (side === 'front') currentFrontFile = file;
        else currentBackFile = file;
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
        const { error } = await SupabaseClient.storage
            .from('postcards')
            .upload(path, file, { upsert: true });
        if (error) throw new Error(`Görsel yükleme hatası: ${error.message}`);
        const { data } = SupabaseClient.storage.from('postcards').getPublicUrl(path);
        return data.publicUrl;
    }

    // ── Form gönderimi ───────────────────────────────────────────────────
    postcardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = editIdField.value;
        const city    = document.getElementById('form-city').value.trim();
        const country = document.getElementById('form-country').value.trim();
        const date    = document.getElementById('form-date').value;
        const description    = document.getElementById('form-description').value.trim();
        const description_en = document.getElementById('form-description-en').value.trim();
        const lat = parseFloat(document.getElementById('form-lat').value);
        const lng = parseFloat(document.getElementById('form-lng').value);

        if (!city || !country || !date || isNaN(lat) || isNaN(lng)) {
            alert('Lütfen tüm zorunlu alanları doldurun.');
            return;
        }
        if (!editId && !currentFrontFile) {
            alert('Lütfen ön yüz görseli seçin.');
            return;
        }

        formSubmitBtn.disabled = true;
        formSubmitBtn.textContent = 'Yükleniyor...';

        try {
            const record = { city, country, date, description, description_en, lat, lng, tags: currentTags };
            const safeName = `${Date.now()}-${city.toLowerCase().replace(/[^a-z0-9]/gi, '-')}`;

            if (currentFrontFile) {
                record.image_front = await uploadToStorage(currentFrontFile, `optimized/${safeName}-front.jpg`);
                record.image_front_original = await uploadToStorage(currentFrontFile, `original/${safeName}-front.jpg`);
            }
            if (currentBackFile) {
                record.image_back = await uploadToStorage(currentBackFile, `optimized/${safeName}-back.jpg`);
                record.image_back_original = await uploadToStorage(currentBackFile, `original/${safeName}-back.jpg`);
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
        currentFrontFile = null;
        currentBackFile = null;
        currentTags = [];
        renderTagChips();
        previewFront.style.display = 'none';
        previewBack.style.display = 'none';
        placeholderFront.style.display = '';
        placeholderBack.style.display = '';
        formTitle.textContent = 'Yeni Kartpostal Ekle';
        formSubmitBtn.textContent = 'Kartpostal Ekle';
        formCancelBtn.style.display = 'none';
        if (adminMarker) { adminMap.removeLayer(adminMarker); adminMarker = null; }
    }

    // ── Tablo ─────────────────────────────────────────────────────────────
    async function loadTable() {
        const postcards = await PostcardData.getAll();
        tbody.innerHTML = '';

        if (!postcards.length) { tableEmpty.style.display = 'block'; return; }
        tableEmpty.style.display = 'none';

        postcards.forEach(pc => {
            const tr = document.createElement('tr');
            const imgSrc = pc.image_front || pc.imageFront || pc.image || '';
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
                    await loadTable();
                }
            });
            tbody.appendChild(tr);
        });
    }

    function editPostcard(pc) {
        editIdField.value = pc.id;
        document.getElementById('form-city').value = pc.city;
        document.getElementById('form-country').value = pc.country;
        document.getElementById('form-date').value = pc.date || '';
        document.getElementById('form-description').value = pc.description || '';
        document.getElementById('form-description-en').value = pc.description_en || '';
        document.getElementById('form-lat').value = pc.lat || '';
        document.getElementById('form-lng').value = pc.lng || '';

        currentTags = [...(pc.tags || [])];
        renderTagChips();

        currentFrontFile = null; currentBackFile = null;
        const frontSrc = pc.image_front || pc.imageFront || pc.image || '';
        if (frontSrc) { previewFront.src = frontSrc; previewFront.style.display = 'block'; placeholderFront.style.display = 'none'; }
        const backSrc = pc.image_back || pc.imageBack || '';
        if (backSrc) { previewBack.src = backSrc; previewBack.style.display = 'block'; placeholderBack.style.display = 'none'; }

        if (pc.lat && pc.lng) { setMapMarker(pc.lat, pc.lng); adminMap.setView([pc.lat, pc.lng], 6); }

        formTitle.textContent = 'Kartpostal Düzenle';
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
