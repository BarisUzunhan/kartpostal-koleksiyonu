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
    const imageInput = document.getElementById('form-image');
    const imagePreview = document.getElementById('image-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const uploadArea = document.getElementById('image-upload-area');

    let adminMap = null;
    let adminMarker = null;
    let currentImageData = '';

    // --- Oturum kontrolü ---
    if (Auth.isAuthenticated()) {
        showAdmin();
    }

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

    // --- Çıkış ---
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

    // --- Admin Haritası (konum seçimi) ---
    function initAdminMap() {
        if (adminMap) return;

        adminMap = L.map('admin-map').setView([39.9, 32.8], 3);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 18
        }).addTo(adminMap);

        adminMap.on('click', (e) => {
            setMapMarker(e.latlng.lat, e.latlng.lng);
        });

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

    // Koordinat inputları değişince marker'ı güncelle
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

    // --- Görsel yükleme ---
    imageInput.addEventListener('change', handleImageSelect);

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processImageFile(file);
        }
    });

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (file) processImageFile(file);
    }

    function processImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageData = e.target.result;
            imagePreview.src = currentImageData;
            imagePreview.style.display = 'block';
            uploadPlaceholder.style.display = 'none';
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
        const lat = parseFloat(document.getElementById('form-lat').value);
        const lng = parseFloat(document.getElementById('form-lng').value);

        if (!city || !country || !date || isNaN(lat) || isNaN(lng)) {
            alert('Lutfen tum zorunlu alanlari doldurun.');
            return;
        }

        if (!editId && !currentImageData) {
            alert('Lutfen bir gorsel secin.');
            return;
        }

        const postcardData = {
            city,
            country,
            date,
            description,
            lat,
            lng
        };

        if (currentImageData) {
            postcardData.image = currentImageData;
        }

        if (editId) {
            PostcardData.update(editId, postcardData);
        } else {
            PostcardData.add(postcardData);
        }

        resetForm();
        loadTable();
    });

    // --- İptal ---
    formCancelBtn.addEventListener('click', resetForm);

    function resetForm() {
        postcardForm.reset();
        editIdField.value = '';
        currentImageData = '';
        imagePreview.style.display = 'none';
        uploadPlaceholder.style.display = '';
        formTitle.textContent = 'Yeni Kartpostal Ekle';
        formSubmitBtn.textContent = 'Kartpostal Ekle';
        formCancelBtn.style.display = 'none';

        if (adminMarker) {
            adminMap.removeLayer(adminMarker);
            adminMarker = null;
        }
    }

    // --- Tablo yükleme ---
    function loadTable() {
        const postcards = PostcardData.getAll();
        tbody.innerHTML = '';

        if (postcards.length === 0) {
            tableEmpty.style.display = 'block';
            return;
        }

        tableEmpty.style.display = 'none';

        postcards.forEach(pc => {
            const tr = document.createElement('tr');
            const formattedDate = formatDate(pc.date);

            tr.innerHTML = `
                <td><img class="table-thumb" src="${escapeHtml(pc.image)}" alt="${escapeHtml(pc.city)}"
                    onerror="this.src='data:image/svg+xml,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"60\" height=\"40\" fill=\"%23EDE7DB\"><rect width=\"60\" height=\"40\"/></svg>')}'"></td>
                <td>${escapeHtml(pc.city)}</td>
                <td>${escapeHtml(pc.country)}</td>
                <td>${formattedDate}</td>
                <td class="table-actions">
                    <button class="btn btn-edit" data-id="${pc.id}">Duzenle</button>
                    <button class="btn btn-danger" data-id="${pc.id}">Sil</button>
                </td>
            `;

            // Düzenle butonu
            tr.querySelector('.btn-edit').addEventListener('click', () => editPostcard(pc));

            // Sil butonu
            tr.querySelector('.btn-danger').addEventListener('click', () => {
                if (confirm(`"${pc.city}, ${pc.country}" kartpostalini silmek istediginize emin misiniz?`)) {
                    PostcardData.remove(pc.id);
                    loadTable();
                }
            });

            tbody.appendChild(tr);
        });
    }

    // --- Düzenleme ---
    function editPostcard(pc) {
        editIdField.value = pc.id;
        document.getElementById('form-city').value = pc.city;
        document.getElementById('form-country').value = pc.country;
        document.getElementById('form-date').value = pc.date;
        document.getElementById('form-description').value = pc.description || '';
        document.getElementById('form-lat').value = pc.lat;
        document.getElementById('form-lng').value = pc.lng;

        // Görseli göster
        currentImageData = '';
        imagePreview.src = pc.image;
        imagePreview.style.display = 'block';
        uploadPlaceholder.style.display = 'none';

        // Haritada marker
        if (pc.lat && pc.lng) {
            setMapMarker(pc.lat, pc.lng);
            adminMap.setView([pc.lat, pc.lng], 6);
        }

        formTitle.textContent = 'Kartpostal Duzenle';
        formSubmitBtn.textContent = 'Guncelle';
        formCancelBtn.style.display = 'inline-flex';

        // Forma scroll
        document.getElementById('postcard-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // --- Yardımcılar ---
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
})();
