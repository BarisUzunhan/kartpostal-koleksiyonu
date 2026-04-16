/* ========================================
   Admin Paneli — Form İşleme, CRUD
   ======================================== */

(function () {
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const logoutBtn = document.getElementById('logout-btn');
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

    let adminMap = null;
    let adminMarker = null;
    let currentFrontData = '';
    let currentBackData = '';

    if (Auth.isAuthenticated()) showAdmin();

    // --- Giriş ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const success = await Auth.login(username, password);
        if (success) {
            loginError.style.display = 'none';
            showAdmin();
        } else {
            loginError.style.display = 'block';
        }
    });

    logoutBtn.addEventListener('click', () => {
        Auth.logout();
        loginSection.style.display = 'flex';
        adminPanel.style.display = 'none';
        logoutBtn.style.display = 'none';
    });

    function showAdmin() {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        logoutBtn.style.display = 'inline-flex';
        initAdminMap();
        loadTable();
    }

    // --- Admin Haritası ---
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
        if (adminMarker) {
            adminMarker.setLatLng([lat, lng]);
        } else {
            adminMarker = L.marker([lat, lng]).addTo(adminMap);
        }
    }

    document.getElementById('form-lat').addEventListener('change', updateMarkerFromInputs);
    document.getElementById('form-lng').addEventListener('change', updateMarkerFromInputs);

    function updateMarkerFromInputs() {
        const lat = parseFloat(document.getElementById('form-lat').value);
        const lng = parseFloat(document.getElementById('form-lng').value);
        if (!isNaN(lat) && !isNaN(lng)) {
            setMapMarker(lat, lng);
            adminMap.setView([lat, lng], 8);
        }
    }

    // --- Görsel yükleme (ön + arka) ---
    setupImageUpload(imageFrontInput, uploadAreaFront, previewFront, placeholderFront, 'front');
    setupImageUpload(imageBackInput, uploadAreaBack, previewBack, placeholderBack, 'back');

    function setupImageUpload(input, area, preview, placeholder, side) {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) processImage(file, preview, placeholder, side);
        });
        area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
        area.addEventListener('dragleave', () => area.classList.remove('dragover'));
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) processImage(file, preview, placeholder, side);
        });
    }

    function processImage(file, preview, placeholder, side) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            if (side === 'front') currentFrontData = data;
            else currentBackData = data;
            preview.src = data;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // --- Form gönderimi ---
    postcardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = editIdField.value;
        const city = document.getElementById('form-city').value.trim();
        const country = document.getElementById('form-country').value.trim();
        const date = document.getElementById('form-date').value;
        const description = document.getElementById('form-description').value.trim();
        const description_en = document.getElementById('form-description-en').value.trim();
        const originalText = document.getElementById('form-original-text').value.trim();
        const lat = parseFloat(document.getElementById('form-lat').value);
        const lng = parseFloat(document.getElementById('form-lng').value);

        if (!city || !country || !date || isNaN(lat) || isNaN(lng)) {
            alert('Lutfen tum zorunlu alanlari doldurun.');
            return;
        }
        if (!editId && !currentFrontData) {
            alert('Lutfen on yuz gorseli secin.');
            return;
        }

        const data = { city, country, date, description, description_en, originalText, lat, lng };
        if (currentFrontData) data.imageFront = currentFrontData;
        if (currentBackData) data.imageBack = currentBackData;

        if (editId) {
            PostcardData.update(editId, data);
        } else {
            PostcardData.add(data);
        }

        resetForm();
        loadTable();
    });

    formCancelBtn.addEventListener('click', resetForm);

    function resetForm() {
        postcardForm.reset();
        editIdField.value = '';
        currentFrontData = '';
        currentBackData = '';
        previewFront.style.display = 'none';
        previewBack.style.display = 'none';
        placeholderFront.style.display = '';
        placeholderBack.style.display = '';
        formTitle.textContent = 'Yeni Kartpostal Ekle';
        formSubmitBtn.textContent = 'Kartpostal Ekle';
        formCancelBtn.style.display = 'none';
        if (adminMarker) { adminMap.removeLayer(adminMarker); adminMarker = null; }
    }

    // --- Tablo ---
    function loadTable() {
        const postcards = PostcardData.getAll();
        tbody.innerHTML = '';

        if (postcards.length === 0) { tableEmpty.style.display = 'block'; return; }
        tableEmpty.style.display = 'none';

        postcards.forEach(pc => {
            const tr = document.createElement('tr');
            const imgSrc = pc.imageFront || pc.image || '';
            const formattedDate = formatDate(pc.date);

            tr.innerHTML = `
                <td><img class="table-thumb" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(pc.city)}" onerror="this.style.display='none'"></td>
                <td>${escapeHtml(pc.city)}</td>
                <td>${escapeHtml(pc.country)}</td>
                <td>${formattedDate}</td>
                <td class="table-actions">
                    <button class="btn btn-edit">Duzenle</button>
                    <button class="btn btn-danger">Sil</button>
                </td>
            `;

            tr.querySelector('.btn-edit').addEventListener('click', () => editPostcard(pc));
            tr.querySelector('.btn-danger').addEventListener('click', () => {
                if (confirm(`"${pc.city}, ${pc.country}" kartpostalini silmek istediginize emin misiniz?`)) {
                    PostcardData.remove(pc.id);
                    loadTable();
                }
            });

            tbody.appendChild(tr);
        });
    }

    function editPostcard(pc) {
        editIdField.value = pc.id;
        document.getElementById('form-city').value = pc.city;
        document.getElementById('form-country').value = pc.country;
        document.getElementById('form-date').value = pc.date;
        document.getElementById('form-description').value = pc.description || '';
        document.getElementById('form-description-en').value = pc.description_en || '';
        document.getElementById('form-original-text').value = pc.originalText || '';
        document.getElementById('form-lat').value = pc.lat;
        document.getElementById('form-lng').value = pc.lng;

        currentFrontData = '';
        currentBackData = '';
        const frontSrc = pc.imageFront || pc.image || '';
        if (frontSrc) { previewFront.src = frontSrc; previewFront.style.display = 'block'; placeholderFront.style.display = 'none'; }
        if (pc.imageBack) { previewBack.src = pc.imageBack; previewBack.style.display = 'block'; placeholderBack.style.display = 'none'; }

        if (pc.lat && pc.lng) { setMapMarker(pc.lat, pc.lng); adminMap.setView([pc.lat, pc.lng], 6); }

        formTitle.textContent = 'Kartpostal Duzenle';
        formSubmitBtn.textContent = 'Guncelle';
        formCancelBtn.style.display = 'inline-flex';
        postcardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
})();
