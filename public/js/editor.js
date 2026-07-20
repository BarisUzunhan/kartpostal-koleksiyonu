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
    const cleanAllBtn  = document.getElementById('clean-all-btn');

    let allPostcards = [];
    let editingTags  = [];
    let editingId    = null;
    let thumbFile    = null;
    // Birleşik görsel listesi (ön + arka + ek); modal açıldığında oluşturulur
    let imageList    = null;

    // ── Zararlı script tespiti & temizleme ──────────────────────────────
    // Eski WP hack'inden kalan "getCookie/document.write" enjeksiyonu. Script
    // her zaman metnin SONUNDA; öncesindeki yasal metin korunur. Anchor'lar
    // yasal kartpostal metninde asla geçmez. (dry-run ile 476 kayıtta doğrulandı)
    const MW_ANCHOR  = /function getCookie|data:text\/javascript;base64|\(time=cookie\)|void 0===time|Math\.floor\(Date\.now\(\)|document\.cookie=|document\.write\(/;
    const MW_RESIDUE = /\s*['"]*\)\}\s*$/;   // sondaki  ')} / '')}  artığı (JS gövdesi kesilmiş EN kayıtları)

    function isDirty(t) {
        return !!t && (MW_ANCHOR.test(t) || MW_RESIDUE.test(t));
    }
    function hasMalware(pc) { return isDirty(pc.description) || isDirty(pc.description_en); }

    function cleanText(t) {
        if (!t) return t;
        let s = t;
        const m = MW_ANCHOR.exec(s);          // en erken (soldaki) zararlı anchor
        if (m) s = s.slice(0, m.index);
        s = s.replace(/\s*\/\/[^\n]*$/, '');  // önünde kalan yarım '//' yorum satırı (Houston tipi)
        s = s.replace(MW_RESIDUE, '');        // JS gövdesi olmayan EN kalıntısı
        s = s.replace(/\s+$/, '');
        return s.length ? s : null;
    }

    function malwareBadge(pc) {
        const parts = [];
        if (isDirty(pc.description))    parts.push('🦠 TR script');
        if (isDirty(pc.description_en)) parts.push('EN kalıntı');
        return parts.join(' · ');
    }

    async function cleanOne(pc) {
        const updated = await PostcardData.update(pc.id, {
            description:    cleanText(pc.description),
            description_en: cleanText(pc.description_en)
        });
        const i = allPostcards.findIndex(p => p.id === pc.id);
        if (i !== -1) allPostcards[i] = updated;
    }

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

    // Toplu temizle — listelenen (aramayla da daralmış olabilir) tüm zararlı kayıtları temizle
    if (cleanAllBtn) cleanAllBtn.addEventListener('click', async () => {
        const search  = editorSearch.value.toLocaleLowerCase('tr').trim();
        const targets = allPostcards.filter(pc => hasMalware(pc) && (!search ||
            (pc.city || '').toLocaleLowerCase('tr').includes(search) ||
            (pc.country || '').toLocaleLowerCase('tr').includes(search) ||
            (pc.description || '').toLocaleLowerCase('tr').includes(search) ||
            (pc.description_en || '').toLocaleLowerCase('tr').includes(search)
        ));
        if (!targets.length) return;
        if (!confirm(`${targets.length} kartpostaldaki zararlı script temizlenecek.\nGörseller, yasal metin ve İngilizce mesajlar korunur.\n\nDevam edilsin mi?`)) return;

        cleanAllBtn.disabled = true;
        let done = 0, failed = 0;
        for (const pc of targets) {
            try { await cleanOne(pc); done++; }
            catch (err) { failed++; console.error('Temizleme hatası:', pc.id, err); }
            cleanAllBtn.textContent = `🧹 Temizleniyor… ${done + failed}/${targets.length}`;
        }
        cleanAllBtn.disabled = false;
        renderList();
        alert(`Tamamlandı.\n${done} kayıt temizlendi${failed ? `\n${failed} kayıtta hata (konsola bakın)` : ''}.`);
    });

    function renderList() {
        let postcards = [...allPostcards];
        const view   = filterView.value;
        const reason = filterReason.value;
        // toLocaleLowerCase('tr') — düz toLowerCase() Türkçe büyük "İ"yi
        // doğru küçültmüyor ("İtalya" → "italya" yerine "i̇talya" olur ve
        // "italya" yazınca eşleşmez); tr locale'i bunu doğru yapıyor.
        const search = editorSearch.value.toLocaleLowerCase('tr').trim();

        if (view === 'review')  postcards = postcards.filter(p => p.needs_review);
        if (view === 'malware') postcards = postcards.filter(hasMalware);
        if (reason) postcards = postcards.filter(p =>
            Array.isArray(p.review_reasons) && p.review_reasons.includes(reason)
        );
        if (search) postcards = postcards.filter(p =>
            (p.city            || '').toLocaleLowerCase('tr').includes(search) ||
            (p.country         || '').toLocaleLowerCase('tr').includes(search) ||
            (p.description     || '').toLocaleLowerCase('tr').includes(search) ||
            (p.description_en  || '').toLocaleLowerCase('tr').includes(search) ||
            (Array.isArray(p.tags) && p.tags.some(t => t.toLocaleLowerCase('tr').includes(search)))
        );

        editorCount.textContent = `${postcards.length} kayıt`;
        editorList.innerHTML    = '';

        // Toplu temizle butonu — sadece "Script temizliği" görünümünde ve kayıt varken
        if (cleanAllBtn) {
            const show = (view === 'malware' && postcards.length > 0);
            cleanAllBtn.style.display = show ? '' : 'none';
            cleanAllBtn.textContent   = `🧹 Tümünü Temizle (${postcards.length})`;
        }

        if (!postcards.length) {
            editorList.innerHTML = '<p class="no-results-title" style="padding:2rem;text-align:center;">Kayıt bulunamadı.</p>';
            return;
        }

        postcards.forEach(pc => {
            const row     = document.createElement('div');
            row.className = `editor-row${pc.needs_review ? ' needs-review' : ''}`;
            const imgSrc  = pc.image_thumbnail || pc.image_front || pc.imageFront || '';
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
                    ${view === 'malware' ? `<span class="malware-badge">${malwareBadge(pc)}</span>` : ''}
                    <div class="editor-row-tags">${(pc.tags || []).map(t => `<span class="table-tag">${escapeHtml(t)}</span>`).join(' ')}</div>
                </div>
                <div class="editor-row-actions">
                    ${view === 'malware' ? '<button class="btn btn-clean">🧹 Temizle</button>' : ''}
                    <button class="btn btn-edit">Düzenle</button>
                </div>
            `;
            row.querySelector('.btn-edit').addEventListener('click', () => openEditModal(pc));
            const cleanBtn = row.querySelector('.btn-clean');
            if (cleanBtn) cleanBtn.addEventListener('click', async () => {
                if (!confirm(`"${pc.city}" kaydındaki zararlı script temizlenecek.\nGörseller ve yasal metin korunur. Onaylıyor musunuz?`)) return;
                cleanBtn.disabled = true;
                try {
                    await cleanOne(pc);
                    renderList();
                } catch (err) {
                    alert(`Hata: ${err.message}`);
                    cleanBtn.disabled = false;
                }
            });
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
        thumbFile   = null;

        document.getElementById('edit-modal-title').textContent = `${pc.city}, ${pc.country}`;
        document.getElementById('edit-record-id').value         = pc.id;
        document.getElementById('edit-city').value              = pc.city           || '';
        document.getElementById('edit-country').value           = pc.country        || '';
        document.getElementById('edit-lat').value               = pc.lat            || '';
        document.getElementById('edit-lng').value               = pc.lng            || '';
        document.getElementById('edit-date').value              = pc.date           || '';
        document.getElementById('edit-description').value       = pc.description    || '';
        document.getElementById('edit-description-en').value   = pc.description_en || '';

        // Tüm görseller (ön + arka + ek) birleşik, sıralanabilir liste olarak
        imageList.fromPostcard(pc);

        // Thumbnail — boşsa ön yüz kullanılıyor, alanı boş bırakıyoruz (placeholder yok)
        const imgThumb = document.getElementById('edit-img-thumb');
        const thumbUrl = document.getElementById('edit-thumb-url');
        const tSrc = pc.image_thumbnail || '';
        imgThumb.src = tSrc; imgThumb.style.display = tSrc ? '' : 'none';
        thumbUrl.value = tSrc;

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

    // ── Görseller — birleşik, sıralanabilir liste ───────────────────────
    imageList = new ImageListEditor(document.getElementById('edit-image-list'), {
        idProvider: () => editingId || Date.now()
    });
    document.getElementById('edit-image-add-btn').addEventListener('click', () => imageList.addSlot());

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

    document.getElementById('edit-thumb-file').addEventListener('change', (e) => {
        thumbFile = e.target.files[0];
        if (thumbFile) {
            document.getElementById('edit-thumb-url').value = '(yeni dosya: ' + thumbFile.name + ')';
            const r = new FileReader();
            r.onload = ev => { const img = document.getElementById('edit-img-thumb'); img.src = ev.target.result; img.style.display = ''; };
            r.readAsDataURL(thumbFile);
        }
    });

    // ── Kaydet ──────────────────────────────────────────────────────────
    editSaveBtn.addEventListener('click', async () => {
        if (!editingId) return;
        if (!imageList.hasAny()) {
            editSaveStatus.textContent = '❌ En az bir görsel gerekli.';
            return;
        }
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

            // Ön/arka/ek görseller — birleşik listeden kolonlara serileştir
            // (kullanılmayan alanlar açıkça null/[] yazılır)
            Object.assign(record, await imageList.toRecord());

            // Thumbnail — boş bırakılırsa temizlenir (ön yüze döner), URL girilirse
            // olduğu gibi kullanılır, dosya seçilirse önce küçültülüp öyle yüklenir
            const thumbUrlVal = document.getElementById('edit-thumb-url').value.trim();
            if (thumbFile) {
                const resized = await ImageUtils.resizeImage(thumbFile, 600, 0.82);
                const path = `optimized/${editingId}-thumb-${Date.now()}.jpg`;
                const { error } = await SupabaseClient.storage.from('postcards').upload(path, resized, { upsert: true, contentType: 'image/jpeg' });
                if (error) throw error;
                record.image_thumbnail = SupabaseClient.storage.from('postcards').getPublicUrl(path).data.publicUrl;
            } else if (!thumbUrlVal.startsWith('(')) {
                record.image_thumbnail = thumbUrlVal || null;
            }

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
