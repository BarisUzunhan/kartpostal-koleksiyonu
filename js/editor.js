/* ========================================
   Editör — Gözden Geçirilmeli Kayıtlar
   Supabase Auth korumalı; kalıcı düzeltme.
   ======================================== */

(async function () {
    I18n.init();

    const loginSection = document.getElementById('login-section');
    const editorPanel = document.getElementById('editor-panel');
    const logoutBtn = document.getElementById('logout-btn');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const editorList = document.getElementById('editor-list');
    const editorCount = document.getElementById('editor-count');
    const filterView = document.getElementById('filter-view');
    const filterReason = document.getElementById('filter-reason');
    const editorSearch = document.getElementById('editor-search');

    let allPostcards = [];
    let editingTags = [];
    let editingId = null;
    let frontFile = null, backFile = null;

    // ── Auth ────────────────────────────────────────────────────────────
    const session = await Auth.getSession();
    if (session) await showEditor();

    Auth.onAuthChange(async (event, session) => {
        if (session) await showEditor();
        else showLogin();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const result = await Auth.login(email, password);
        if (result.success) { loginError.style.display = 'none'; await showEditor(); }
        else { loginError.style.display = 'block'; loginError.textContent = result.message || 'Hatalı giriş.'; }
    });

    logoutBtn.addEventListener('click', async () => { await Auth.logout(); showLogin(); });

    function showLogin() {
        loginSection.style.display = 'flex';
        editorPanel.style.display = 'none';
        logoutBtn.style.display = 'none';
    }

    async function showEditor() {
        loginSection.style.display = 'none';
        editorPanel.style.display = 'block';
        logoutBtn.style.display = 'inline-flex';
        allPostcards = await PostcardData.getAll();
        renderList();
    }

    // ── Filtre & liste ──────────────────────────────────────────────────
    filterView.addEventListener('change', renderList);
    filterReason.addEventListener('change', renderList);
    let debounce;
    editorSearch.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(renderList, 250); });

    function renderList() {
        let postcards = [...allPostcards];
        const view = filterView.value;
        const reason = filterReason.value;
        const search = editorSearch.value.toLowerCase().trim();

        if (view === 'review') postcards = postcards.filter(p => p.needs_review);
        if (reason) postcards = postcards.filter(p => Array.isArray(p.review_reasons) && p.review_reasons.includes(reason));
        if (search) postcards = postcards.filter(p =>
            (p.city || '').toLowerCase().includes(search) ||
            (p.country || '').toLowerCase().includes(search)
        );

        editorCount.textContent = `${postcards.length} kayıt`;
        editorList.innerHTML = '';

        if (!postcards.length) {
            editorList.innerHTML = '<p class="no-results-title" style="padding:2rem;text-align:center;">Kayıt bulunamadı.</p>';
            return;
        }

        postcards.forEach(pc => {
            const row = document.createElement('div');
            row.className = `editor-row${pc.needs_review ? ' needs-review' : ''}`;
            const imgSrc = pc.image_front || pc.imageFront || '';
            const reasons = (pc.review_reasons || []).map(r => reasonLabel(r)).join(', ');

            row.innerHTML = `
                <div class="editor-row-img">
                    ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(pc.city)}" onerror="this.style.display='none'">` : '<div class="no-img-placeholder">?</div>'}
                </div>
                <div class="editor-row-info">
                    <strong class="editor-row-title">${escapeHtml(pc.city)}, ${escapeHtml(pc.country)}</strong>
                    <span class="editor-row-date">${pc.date || ''}</span>
                    ${pc.needs_review ? `<span class="review-badge">⚠️ ${reasons}</span>` : ''}
                    <div class="editor-row-tags">${(pc.tags || []).map(t => `<span class="table-tag">${escapeHtml(t)}</span>`).join(' ')}</div>
                </div>
                <div class="editor-row-actions">
                    <button class="btn btn-edit">Düzenle</button>
                </div>
            `;
            row.querySelector('.btn-edit').addEventListener('click', () => openEditModal(pc));
            editorList.appendChild(row);
        });
    }

    function reasonLabel(r) {
        const map = {
            no_coords: 'Koordinat yok', no_image: 'Görsel yok',
            multi_postcard: 'Çok kartpostal', front_back_ambiguous: 'Ön/arka belirsiz',
            no_country: 'Ülke yok', country_mismatch: 'Ülke çakışması',
            no_text: 'Metin yok', ambiguous_country: 'Ülke belirsiz'
        };
        return map[r] || r;
    }

    // ── Düzenleme modal ──────────────────────────────────────────────────
    const editModal = document.getElementById('edit-modal');
    const editModalClose = document.getElementById('edit-modal-close');
    const editCancelBtn = document.getElementById('edit-cancel-btn');
    const editSaveBtn = document.getElementById('edit-save-btn');
    const editSaveStatus = document.getElementById('edit-save-status');
    const editTagsInput = document.getElementById('edit-tags-input');
    const editTagsChips = document.getElementById('edit-tags-chips');

    editModalClose.addEventListener('click', closeModal);
    editCancelBtn.addEventListener('click', closeModal);
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal(); });

    function openEditModal(pc) {
        editingId = pc.id;
        editingTags = [...(pc.tags || [])];
        frontFile = null; backFile = null;

        document.getElementById('edit-modal-title').textContent = `${pc.city}, ${pc.country}`;
        document.getElementById('edit-record-id').value = pc.id;
        document.getElementById('edit-city').value = pc.city || '';
        document.getElementById('edit-country').value = pc.country || '';
        document.getElementById('edit-lat').value = pc.lat || '';
        document.getElementById('edit-lng').value = pc.lng || '';
        document.getElementById('edit-date').value = pc.date || '';
        document.getElementById('edit-description').value = pc.description || '';
        document.getElementById('edit-description-en').value = pc.description_en || '';
        // Görseller
        const imgFront = document.getElementById('edit-img-front');
        const imgBack = document.getElementById('edit-img-back');
        const frontUrl = document.getElementById('edit-front-url');
        const backUrl = document.getElementById('edit-back-url');
        const frontOrig = document.getElementById('edit-front-original');
        const backOrig = document.getElementById('edit-back-original');

        const fSrc = pc.image_front || pc.imageFront || '';
        imgFront.src = fSrc; imgFront.style.display = fSrc ? '' : 'none';
        frontUrl.value = fSrc;
        if (pc.image_front_original) { frontOrig.href = pc.image_front_original; frontOrig.style.display = ''; }
        else frontOrig.style.display = 'none';

        const bSrc = pc.image_back || pc.imageBack || '';
        imgBack.src = bSrc; imgBack.style.display = bSrc ? '' : 'none';
        backUrl.value = bSrc;
        if (pc.image_back_original) { backOrig.href = pc.image_back_original; backOrig.style.display = ''; }
        else backOrig.style.display = 'none';

        // Etiketler
        renderEditTagChips();

        // Review sebepler
        const reviewSection = document.getElementById('review-reasons-section');
        const reasonsList = document.getElementById('review-reasons-list');
        const resolvedCb = document.getElementById('edit-resolved');
        if (pc.needs_review && pc.review_reasons?.length) {
            reviewSection.style.display = '';
            reasonsList.innerHTML = (pc.review_reasons || []).map(r =>
                `<span class="review-reason-tag">${reasonLabel(r)}</span>`
            ).join(' ');
            resolvedCb.checked = false;
        } else {
            reviewSection.style.display = 'none';
        }

        editSaveStatus.textContent = '';
        editModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        editModal.style.display = 'none';
        document.body.style.overflow = '';
        editingId = null;
    }

    // Etiket yönetimi
    editTagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addEditTag(editTagsInput.value.replace(/,$/, '').trim());
            editTagsInput.value = '';
        }
    });
    editTagsInput.addEventListener('blur', () => {
        const val = editTagsInput.value.replace(/,$/, '').trim();
        if (val) { addEditTag(val); editTagsInput.value = ''; }
    });

    function addEditTag(tag) {
        if (!tag || editingTags.includes(tag)) return;
        editingTags.push(tag);
        renderEditTagChips();
    }

    function renderEditTagChips() {
        editTagsChips.innerHTML = '';
        editingTags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'admin-tag-chip';
            chip.textContent = tag;
            chip.title = 'Kaldırmak için tıkla';
            chip.addEventListener('click', () => { editingTags = editingTags.filter(t => t !== tag); renderEditTagChips(); });
            editTagsChips.appendChild(chip);
        });
    }

    // Görsel dosya yükleme
    document.getElementById('edit-front-file').addEventListener('change', async (e) => {
        frontFile = e.target.files[0];
        if (frontFile) {
            document.getElementById('edit-front-url').value = '(yeni dosya seçildi: ' + frontFile.name + ')';
            const r = new FileReader();
            r.onload = ev => { const img = document.getElementById('edit-img-front'); img.src = ev.target.result; img.style.display = ''; };
            r.readAsDataURL(frontFile);
        }
    });
    document.getElementById('edit-back-file').addEventListener('change', async (e) => {
        backFile = e.target.files[0];
        if (backFile) {
            document.getElementById('edit-back-url').value = '(yeni dosya seçildi: ' + backFile.name + ')';
            const r = new FileReader();
            r.onload = ev => { const img = document.getElementById('edit-img-back'); img.src = ev.target.result; img.style.display = ''; };
            r.readAsDataURL(backFile);
        }
    });

    // Kaydet
    editSaveBtn.addEventListener('click', async () => {
        if (!editingId) return;
        editSaveBtn.disabled = true;
        editSaveStatus.textContent = 'Kaydediliyor...';

        try {
            const record = {
                city:            document.getElementById('edit-city').value.trim(),
                country:         document.getElementById('edit-country').value.trim(),
                lat:             parseFloat(document.getElementById('edit-lat').value) || null,
                lng:             parseFloat(document.getElementById('edit-lng').value) || null,
                date:            document.getElementById('edit-date').value || null,
                description:     document.getElementById('edit-description').value.trim() || null,
                description_en:  document.getElementById('edit-description-en').value.trim() || null,
                tags: editingTags
            };

            // Görsel URL'leri (elle değiştirildiyse)
            const frontUrlVal = document.getElementById('edit-front-url').value.trim();
            const backUrlVal  = document.getElementById('edit-back-url').value.trim();
            if (frontUrlVal && !frontUrlVal.startsWith('(')) record.image_front = frontUrlVal;
            if (backUrlVal && !backUrlVal.startsWith('('))  record.image_back  = backUrlVal;

            // Yeni dosya yükleme
            if (frontFile) {
                const n = `${editingId}-front-${Date.now()}.jpg`;
                const { error } = await SupabaseClient.storage.from('postcards').upload(`optimized/${n}`, frontFile, { upsert: true });
                if (!error) {
                    record.image_front = SupabaseClient.storage.from('postcards').getPublicUrl(`optimized/${n}`).data.publicUrl;
                    await SupabaseClient.storage.from('postcards').upload(`original/${n}`, frontFile, { upsert: true });
                    record.image_front_original = SupabaseClient.storage.from('postcards').getPublicUrl(`original/${n}`).data.publicUrl;
                }
            }
            if (backFile) {
                const n = `${editingId}-back-${Date.now()}.jpg`;
                const { error } = await SupabaseClient.storage.from('postcards').upload(`optimized/${n}`, backFile, { upsert: true });
                if (!error) {
                    record.image_back = SupabaseClient.storage.from('postcards').getPublicUrl(`optimized/${n}`).data.publicUrl;
                    await SupabaseClient.storage.from('postcards').upload(`original/${n}`, backFile, { upsert: true });
                    record.image_back_original = SupabaseClient.storage.from('postcards').getPublicUrl(`original/${n}`).data.publicUrl;
                }
            }

            // Review çözüldü mü?
            if (document.getElementById('edit-resolved')?.checked) {
                record.needs_review = false;
                record.review_reasons = [];
            }

            await PostcardData.update(editingId, record);
            PostcardData.invalidateCache();
            allPostcards = await PostcardData.getAll();

            editSaveStatus.textContent = '✅ Kaydedildi!';
            setTimeout(() => {
                closeModal();
                renderList();
            }, 800);
        } catch (err) {
            editSaveStatus.textContent = `❌ Hata: ${err.message}`;
        } finally {
            editSaveBtn.disabled = false;
        }
    });

    function escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
})();
