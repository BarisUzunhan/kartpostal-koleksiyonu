/* ========================================
   Editör — Tüm Kartpostallar + Filtre
   Supabase Auth korumalı; kalıcı düzeltme.
   ======================================== */

(async function () {
    I18n.init();

    const loginSection = document.getElementById('login-section');
    const editorPanel  = document.getElementById('editor-panel');
    const logoutBtn    = document.getElementById('logout-btn');
    const loginForm    = document.getElementById('login-form');
    const loginError   = document.getElementById('login-error');
    const editorList   = document.getElementById('editor-list');
    const editorCount  = document.getElementById('editor-count');
    const filterView   = document.getElementById('filter-view');
    const filterReason = document.getElementById('filter-reason');
    const editorSearch = document.getElementById('editor-search');

    let allPostcards = [];
    let editingTags  = [];
    let editingId    = null;
    let frontFile    = null, backFile = null;
    // Her öğe: { optimizedUrl, originalUrl, file } — file varsa kaydette yüklenir
    let extraSlots   = [];

    // ── Auth ────────────────────────────────────────────────────────────
    const session = await Auth.getSession();
    if (session) await showEditor();

    Auth.onAuthChange(async (event, session) => {
        if (session) await showEditor();
        else showLogin();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const result   = await Auth.login(email, password);
        if (result.success) {
            loginError.style.display = 'none';
            await showEditor();
        } else {
            loginError.style.display = 'block';
            loginError.textContent = result.message || 'Hatalı giriş.';
        }
    });

    logoutBtn.addEventListener('click', async () => { await Auth.logout(); showLogin(); });

    function showLogin() {
        loginSection.style.display = 'flex';
        editorPanel.style.display  = 'none';
        logoutBtn.style.display    = 'none';
    }

    async function showEditor() {
        loginSection.style.display = 'none';
        editorPanel.style.display  = 'block';
        logoutBtn.style.display    = 'inline-flex';
        allPostcards = await PostcardData.getAll();
        renderList();
    }

    // ── Filtre & Liste ───────────────────────────────────────────────────
    filterView.addEventListener('change', renderList);
    filterReason.addEventListener('change', renderList);
    let debounce;
    editorSearch.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(renderList, 250);
    });

    function renderList() {
        let postcards = [...allPostcards];
        const view   = filterView.value;
        const reason = filterReason.value;
        const search = editorSearch.value.toLowerCase().trim();

        if (view === 'review') postcards = postcards.filter(p => p.needs_review);
        if (reason) postcards = postcards.filter(p =>
            Array.isArray(p.review_reasons) && p.review_reasons.includes(reason)
        );
        if (search) postcards = postcards.filter(p =>
            (p.city    || '').toLowerCase().includes(search) ||
            (p.country || '').toLowerCase().includes(search)
        );

        editorCount.textContent = `${postcards.length} kayıt`;
        editorList.innerHTML    = '';

        if (!postcards.length) {
            editorList.innerHTML = '<p class="no-results-title" style="padding:2rem;text-align:center;">Kayıt bulunamadı.</p>';
            return;
        }

        postcards.forEach(pc => {
            const row     = document.createElement('div');
            row.className = `editor-row${pc.needs_review ? ' needs-review' : ''}`;
            const imgSrc  = pc.image_front || pc.imageFront || '';
            const reasons = (pc.review_reasons || []).map(r => reasonLabel(r)).join(', ');

            row.innerHTML = `
                <div class="editor-row-img">
                    ${imgSrc
                        ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(pc.city)}" onerror="this.style.display='none'">`
                        : '<div class="no-img-placeholder">?</div>'}
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
            no_coords:            'Koordinat yok',
            no_image:             'Görsel yok',
            multi_image:          'Çok görsel',
            multi_postcard:       'Çok kartpostal',
            front_back_ambiguous: 'Ön/arka belirsiz',
            no_country:           'Ülke yok',
            country_mismatch:     'Ülke çakışması',
            ambiguous_country:    'Ülke belirsiz',
            no_text:              'Metin yok',
        };
        return map[r] || r;
    }

    // ── Düzenleme Modal ──────────────────────────────────────────────────
    const editModal      = document.getElementById('edit-modal');
    const editModalClose = document.getElementById('edit-modal-close');
    const editCancelBtn  = document.getElementById('edit-cancel-btn');
    const editSaveBtn    = document.getElementById('edit-save-btn');
    const editSaveStatus = document.getElementById('edit-save-status');
    const editTagsInput  = document.getElementById('edit-tags-input');
    const editTagsChips  = document.getElementById('edit-tags-chips');

    editModalClose.addEventListener('click', closeModal);
    editCancelBtn.addEventListener('click', closeModal);
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal(); });

    function openEditModal(pc) {
        editingId   = pc.id;
        editingTags = [...(pc.tags || [])];
        frontFile   = null; backFile = null;

        document.getElementById('edit-modal-title').textContent = `${pc.city}, ${pc.country}`;
        document.getElementById('edit-record-id').value         = pc.id;
        document.getElementById('edit-city').value              = pc.city           || '';
        document.getElementById('edit-country').value           = pc.country        || '';
        document.getElementById('edit-lat').value               = pc.lat            || '';
        document.getElementById('edit-lng').value               = pc.lng            || '';
        document.getElementById('edit-date').value              = pc.date           || '';
        document.getElementById('edit-description').value       = pc.description    || '';
        document.getElementById('edit-description-en').value   = pc.description_en || '';

        const imgFront  = document.getElementById('edit-img-front');
        const imgBack   = document.getElementById('edit-img-back');
        const frontUrl  = document.getElementById('edit-front-url');
        const backUrl   = document.getElementById('edit-back-url');
        const frontOrig = document.getElementById('edit-front-original');
        const backOrig  = document.getElementById('edit-back-original');

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

        // Ek görseller — mevcut extra_images/extra_images_original'dan slot listesi kur
        const extras     = pc.extra_images          || [];
        const extrasOrig = pc.extra_images_original || [];
        extraSlots = extras.map((url, i) => ({
            optimizedUrl: url || '',
            originalUrl:  extrasOrig[i] || url || '',
            file: null
        }));
        renderExtraSlots();

        const position = pc.extra_images_position || 'after_description';
        document.querySelectorAll('input[name="extra-images-position"]').forEach(r => {
            r.checked = (r.value === position);
        });

        renderEditTagChips();

        const reviewSection = document.getElementById('review-reasons-section');
        const reasonsList   = document.getElementById('review-reasons-list');
        const resolvedCb    = document.getElementById('edit-resolved');
        if (pc.needs_review && pc.review_reasons?.length) {
            reviewSection.style.display = '';
            reasonsList.innerHTML = (pc.review_reasons || []).map(r =>
                `<span class="review-reason-tag">${reasonLabel(r)}</span>`
            ).join(' ');
            resolvedCb.checked = false;
        } else {
            reviewSection.style.display = 'none';
        }

        editSaveStatus.textContent   = '';
        editModal.style.display      = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        editModal.style.display      = 'none';
        document.body.style.overflow = '';
        editingId = null;
    }

    // ── Ek Görseller — slot render/ekle/kaldır ──────────────────────────
    const extraListEl   = document.getElementById('edit-extra-images-list');
    const extraAddBtn   = document.getElementById('edit-extra-add-btn');

    function renderExtraSlots() {
        extraListEl.innerHTML = '';
        extraSlots.forEach((slot, i) => {
            const previewSrc = slot.file ? '' : slot.optimizedUrl;
            const wrap = document.createElement('div');
            wrap.className = 'edit-extra-slot';
            wrap.innerHTML = `
                <img ${previewSrc ? `src="${previewSrc}"` : ''} alt="Ek görsel ${i + 1}" style="${previewSrc ? '' : 'display:none;'}" onerror="this.style.display='none'">
                <input type="url" class="edit-extra-url" placeholder="Görsel URL" value="${slot.file ? '' : slot.optimizedUrl}">
                <div class="edit-image-actions">
                    <input type="file" class="file-input-sm edit-extra-file" accept="image/*" id="edit-extra-file-${i}">
                    <label for="edit-extra-file-${i}" class="btn btn-secondary btn-sm">Dosya Yükle</label>
                </div>
                <button type="button" class="btn btn-sm edit-extra-remove-btn">Kaldır</button>
            `;

            const img      = wrap.querySelector('img');
            const urlInput = wrap.querySelector('.edit-extra-url');
            const fileInput = wrap.querySelector('.edit-extra-file');

            urlInput.addEventListener('input', () => {
                slot.optimizedUrl = urlInput.value.trim();
                slot.file = null;
            });

            fileInput.addEventListener('change', (e) => {
                slot.file = e.target.files[0] || null;
                if (slot.file) {
                    urlInput.value = '(yeni dosya: ' + slot.file.name + ')';
                    const r = new FileReader();
                    r.onload = ev => { img.src = ev.target.result; img.style.display = ''; };
                    r.readAsDataURL(slot.file);
                }
            });

            wrap.querySelector('.edit-extra-remove-btn').addEventListener('click', () => {
                extraSlots.splice(i, 1);
                renderExtraSlots();
            });

            extraListEl.appendChild(wrap);
        });
    }

    extraAddBtn.addEventListener('click', () => {
        extraSlots.push({ optimizedUrl: '', originalUrl: '', file: null });
        renderExtraSlots();
    });

    // Ön/arka/ek görsel dosyalarını Supabase Storage'a yükleyen ortak yardımcı
    async function uploadImage(file, pathBase) {
        const { error } = await SupabaseClient.storage.from('postcards').upload(`optimized/${pathBase}`, file, { upsert: true });
        if (error) throw error;
        const optimizedUrl = SupabaseClient.storage.from('postcards').getPublicUrl(`optimized/${pathBase}`).data.publicUrl;
        await SupabaseClient.storage.from('postcards').upload(`original/${pathBase}`, file, { upsert: true });
        const originalUrl = SupabaseClient.storage.from('postcards').getPublicUrl(`original/${pathBase}`).data.publicUrl;
        return { optimizedUrl, originalUrl };
    }

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
            chip.addEventListener('click', () => {
                editingTags = editingTags.filter(t => t !== tag);
                renderEditTagChips();
            });
            editTagsChips.appendChild(chip);
        });
    }

    document.getElementById('edit-front-file').addEventListener('change', (e) => {
        frontFile = e.target.files[0];
        if (frontFile) {
            document.getElementById('edit-front-url').value = '(yeni dosya: ' + frontFile.name + ')';
            const r = new FileReader();
            r.onload = ev => { const img = document.getElementById('edit-img-front'); img.src = ev.target.result; img.style.display = ''; };
            r.readAsDataURL(frontFile);
        }
    });
    document.getElementById('edit-back-file').addEventListener('change', (e) => {
        backFile = e.target.files[0];
        if (backFile) {
            document.getElementById('edit-back-url').value = '(yeni dosya: ' + backFile.name + ')';
            const r = new FileReader();
            r.onload = ev => { const img = document.getElementById('edit-img-back'); img.src = ev.target.result; img.style.display = ''; };
            r.readAsDataURL(backFile);
        }
    });

    // ── Kaydet ──────────────────────────────────────────────────────────
    editSaveBtn.addEventListener('click', async () => {
        if (!editingId) return;
        editSaveBtn.disabled = true;
        editSaveStatus.textContent = 'Kaydediliyor...';

        try {
            const record = {
                city:           document.getElementById('edit-city').value.trim(),
                country:        document.getElementById('edit-country').value.trim(),
                lat:            parseFloat(document.getElementById('edit-lat').value) || null,
                lng:            parseFloat(document.getElementById('edit-lng').value) || null,
                date:           document.getElementById('edit-date').value || null,
                description:    document.getElementById('edit-description').value.trim()    || null,
                description_en: document.getElementById('edit-description-en').value.trim() || null,
                tags: editingTags
            };

            const frontUrlVal = document.getElementById('edit-front-url').value.trim();
            const backUrlVal  = document.getElementById('edit-back-url').value.trim();
            if (frontUrlVal && !frontUrlVal.startsWith('(')) record.image_front = frontUrlVal;
            if (backUrlVal  && !backUrlVal.startsWith('('))  record.image_back  = backUrlVal;

            if (frontFile) {
                const { optimizedUrl, originalUrl } = await uploadImage(frontFile, `${editingId}-front-${Date.now()}.jpg`);
                record.image_front = optimizedUrl;
                record.image_front_original = originalUrl;
            }
            if (backFile) {
                const { optimizedUrl, originalUrl } = await uploadImage(backFile, `${editingId}-back-${Date.now()}.jpg`);
                record.image_back = optimizedUrl;
                record.image_back_original = originalUrl;
            }

            // Ek görseller — boş slotları (ne dosya ne URL) atla, sırayı koru
            const extraImages = [];
            const extraImagesOriginal = [];
            for (let i = 0; i < extraSlots.length; i++) {
                const slot = extraSlots[i];
                if (slot.file) {
                    const { optimizedUrl, originalUrl } = await uploadImage(slot.file, `${editingId}-extra-${i}-${Date.now()}.jpg`);
                    extraImages.push(optimizedUrl);
                    extraImagesOriginal.push(originalUrl);
                } else if (slot.optimizedUrl) {
                    extraImages.push(slot.optimizedUrl);
                    extraImagesOriginal.push(slot.originalUrl || slot.optimizedUrl);
                }
            }
            record.extra_images = extraImages;
            record.extra_images_original = extraImagesOriginal;

            const positionInput = document.querySelector('input[name="extra-images-position"]:checked');
            record.extra_images_position = positionInput ? positionInput.value : 'after_description';

            if (document.getElementById('edit-resolved')?.checked) {
                record.needs_review   = false;
                record.review_reasons = [];
            }

            await PostcardData.update(editingId, record);
            PostcardData.invalidateCache();
            allPostcards = await PostcardData.getAll();

            editSaveStatus.textContent = '✅ Kaydedildi!';
            setTimeout(() => { closeModal(); renderList(); }, 800);
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
