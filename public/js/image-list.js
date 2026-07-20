/* ========================================
   ImageListEditor — Birleşik, sıralanabilir görsel listesi
   Hem yönetici (admin.js) hem editör (editor.js) kullanır.

   Bir kartpostalın tüm görsellerini (ön + arka + ek) tek bir
   sıralanabilir liste olarak yönetir. Kaydederken mevcut şema
   kolonlarına serileştirir:
     - 0. görsel  → image_front (+ image_front_original)
     - 1. görsel  → image_back  (+ image_back_original)
     - 2.+ görseller → extra_images[] (+ extra_images_original[])
   Kullanılmayan alanlar açıkça null/[] yazılır (kalıntı kalmasın).

   Thumbnail bu listenin parçası DEĞİLDİR; ilgili sayfa ayrıca yönetir.
   ======================================== */

(function () {
    // Stil bir kez enjekte edilir (iki sayfada da aynı görünüm)
    function injectStyles() {
        if (document.getElementById('img-list-styles')) return;
        const style = document.createElement('style');
        style.id = 'img-list-styles';
        style.textContent = `
        .btn-sm { padding: 0.2rem 0.6rem; font-size: 0.78rem; }
        .img-list { display:flex; flex-direction:column; gap:0.75rem; margin-bottom:0.75rem; }
        .img-list-empty { font-size:0.85rem; color:#999; padding:0.5rem 0; }
        .img-list-slot { display:flex; gap:0.75rem; border:1px solid #e0ddd8; border-radius:8px; padding:0.6rem; background:#fafaf8; }
        .img-list-preview { width:110px; height:90px; flex:0 0 110px; object-fit:cover; border-radius:6px; border:1px solid #e0ddd8; background:#eee; }
        .img-list-body { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:0.4rem; }
        .img-list-head { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; }
        .img-list-role { font-size:0.85rem; font-weight:600; }
        .img-list-reorder { display:flex; gap:0.3rem; }
        .img-list-url { width:100%; padding:0.3rem 0.5rem; border:1px solid #ddd; border-radius:6px; font-size:0.8rem; font-family:inherit; box-sizing:border-box; }
        .img-list-actions { display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center; }
        .img-list-file { display:none; }
        .img-list .img-move-up[disabled], .img-list .img-move-down[disabled] { opacity:0.4; cursor:default; }
        .img-list .img-remove { color:#b23b3b; border-color:#e6b8b8; }
        .img-list .img-thumb-toggle { color:#9a7a2a; border-color:#e6d7a8; }
        .img-list .img-thumb-toggle.active { background:#f6e7b8; border-color:#d9c377; color:#7a5f18; font-weight:600; }
        `;
        document.head.appendChild(style);
    }

    function roleLabel(i) {
        if (i === 0) return 'Ön yüz';
        if (i === 1) return 'Arka yüz';
        return 'Ek görsel ' + (i - 1);
    }

    class ImageListEditor {
        // container: liste öğelerinin render edileceği DOM elemanı
        // opts.idProvider: () => string  — yükleme dosya adı için temel (kartpostal id'si veya timestamp)
        constructor(container, opts) {
            injectStyles();
            this.container   = container;
            this.idProvider  = (opts && opts.idProvider) || (() => Date.now());
            this.uid         = Math.random().toString(36).slice(2, 8);
            this.slots       = []; // { optimizedUrl, originalUrl, file, _previewData }
            this.render();
        }

        // ── Yükleme (Supabase Storage: optimized/ + original/) ──────────────
        async _upload(file, pathBase) {
            const bucket = SupabaseClient.storage.from('postcards');
            const ct = { upsert: true, contentType: file.type || 'image/jpeg' };
            const opt = await bucket.upload(`optimized/${pathBase}`, file, ct);
            if (opt.error) throw new Error(`Görsel yükleme hatası: ${opt.error.message}`);
            const optimizedUrl = bucket.getPublicUrl(`optimized/${pathBase}`).data.publicUrl;
            const org = await bucket.upload(`original/${pathBase}`, file, ct);
            if (org.error) throw new Error(`Görsel yükleme hatası: ${org.error.message}`);
            const originalUrl = bucket.getPublicUrl(`original/${pathBase}`).data.publicUrl;
            return { optimizedUrl, originalUrl };
        }

        // ── State ────────────────────────────────────────────────────────
        fromPostcard(pc) {
            const slots = [];
            const front = pc.image_front || pc.imageFront || '';
            if (front) slots.push({ optimizedUrl: front, originalUrl: pc.image_front_original || front, file: null });
            const back = pc.image_back || pc.imageBack || '';
            if (back) slots.push({ optimizedUrl: back, originalUrl: pc.image_back_original || back, file: null });
            const extras     = Array.isArray(pc.extra_images)          ? pc.extra_images          : [];
            const extrasOrig = Array.isArray(pc.extra_images_original) ? pc.extra_images_original : [];
            extras.forEach((url, i) => {
                if (url) slots.push({ optimizedUrl: url, originalUrl: extrasOrig[i] || url, file: null });
            });
            // Thumbnail görsellerden biriyse ilgili slotu ★ ile işaretle
            const thumb = pc.image_thumbnail || '';
            if (thumb) {
                const m = slots.find(s => s.optimizedUrl === thumb);
                if (m) m.isThumb = true;
            }
            this.slots = slots;
            this.render();
        }

        // Slotlardan birini küçük resim (thumbnail) yap; tekrar tıklanırsa "yok"
        setThumb(i) {
            const wasThumb = this.slots[i] && this.slots[i].isThumb;
            this.slots.forEach(s => { s.isThumb = false; });
            if (this.slots[i]) this.slots[i].isThumb = !wasThumb;
            this.render();
        }

        clear() { this.slots = []; this.render(); }

        addSlot() { this.slots.push({ optimizedUrl: '', originalUrl: '', file: null }); this.render(); }

        removeAt(i) { this.slots.splice(i, 1); this.render(); }

        move(i, dir) {
            const j = i + dir;
            if (j < 0 || j >= this.slots.length) return;
            const t = this.slots[i]; this.slots[i] = this.slots[j]; this.slots[j] = t;
            this.render();
        }

        hasAny() { return this.slots.some(s => s.file || (s.optimizedUrl && s.optimizedUrl.trim())); }

        // ── Kayda serileştirme ───────────────────────────────────────────
        async toRecord() {
            const idBase = this.idProvider();
            const stamp  = Date.now();
            const resolved = [];
            let thumbUrl = null;   // ★ işaretli slotun çözümlenmiş optimize URL'i
            for (let i = 0; i < this.slots.length; i++) {
                const s = this.slots[i];
                let entry = null;
                if (s.file) {
                    const { optimizedUrl, originalUrl } = await this._upload(s.file, `${idBase}-img-${i}-${stamp}.jpg`);
                    entry = { optimizedUrl, originalUrl };
                } else if (s.optimizedUrl && s.optimizedUrl.trim()) {
                    entry = { optimizedUrl: s.optimizedUrl.trim(), originalUrl: (s.originalUrl || s.optimizedUrl).trim() };
                }
                // içeriksiz slot atlanır
                if (entry) {
                    resolved.push(entry);
                    if (s.isThumb) thumbUrl = entry.optimizedUrl;
                }
            }

            const rec = {};
            const front = resolved[0] || null;
            rec.image_front          = front ? front.optimizedUrl : null;
            rec.image_front_original = front ? front.originalUrl  : null;

            const back = resolved[1] || null;
            rec.image_back           = back ? back.optimizedUrl : null;
            rec.image_back_original  = back ? back.originalUrl  : null;

            const extras = resolved.slice(2);
            rec.extra_images          = extras.map(r => r.optimizedUrl);
            rec.extra_images_original = extras.map(r => r.originalUrl);

            // Liste seçimi öncelikli; yalnızca bir slot ★ ise thumbnail'i yaz.
            // Seçim yoksa anahtar hiç eklenmez → sayfanın özel-thumbnail mantığı çalışır.
            if (thumbUrl) rec.image_thumbnail = thumbUrl;
            return rec;
        }

        // ── Render ───────────────────────────────────────────────────────
        render() {
            this.container.innerHTML = '';
            this.container.classList.add('img-list');

            if (this.slots.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'img-list-empty';
                empty.textContent = 'Henüz görsel yok. "+ Görsel Ekle" ile başlayın.';
                this.container.appendChild(empty);
                return;
            }

            this.slots.forEach((slot, i) => {
                const role = roleLabel(i);
                const previewSrc = slot.file ? (slot._previewData || '') : (slot.optimizedUrl || '');
                const urlVal     = slot.file ? '(yeni dosya: ' + slot.file.name + ')' : (slot.optimizedUrl || '');
                const fileId     = `img-list-file-${this.uid}-${i}`;

                const wrap = document.createElement('div');
                wrap.className = 'img-list-slot';
                wrap.innerHTML = `
                    <img class="img-list-preview" ${previewSrc ? `src="${previewSrc}"` : ''}
                         alt="${role}" style="${previewSrc ? '' : 'display:none;'}"
                         onerror="this.style.display='none'">
                    <div class="img-list-body">
                        <div class="img-list-head">
                            <span class="img-list-role">${role}</span>
                            <div class="img-list-reorder">
                                <button type="button" class="btn btn-sm img-move-up" title="Yukarı taşı" ${i === 0 ? 'disabled' : ''}>↑</button>
                                <button type="button" class="btn btn-sm img-move-down" title="Aşağı taşı" ${i === this.slots.length - 1 ? 'disabled' : ''}>↓</button>
                            </div>
                        </div>
                        <input type="url" class="img-list-url" placeholder="Görsel URL">
                        <div class="img-list-actions">
                            <input type="file" class="img-list-file" accept="image/*" id="${fileId}">
                            <label for="${fileId}" class="btn btn-secondary btn-sm">Dosya Yükle</label>
                            <button type="button" class="btn btn-sm img-thumb-toggle${slot.isThumb ? ' active' : ''}" title="Küçük resim (thumbnail) olarak kullan">${slot.isThumb ? '★ Küçük resim' : '☆ Küçük resim'}</button>
                            <button type="button" class="btn btn-sm img-remove">Kaldır</button>
                        </div>
                    </div>
                `;

                const img       = wrap.querySelector('.img-list-preview');
                const urlInput  = wrap.querySelector('.img-list-url');
                const fileInput = wrap.querySelector('.img-list-file');
                urlInput.value = urlVal;

                urlInput.addEventListener('input', () => {
                    slot.optimizedUrl = urlInput.value.trim();
                    slot.originalUrl  = '';
                    slot.file = null;
                    slot._previewData = null;
                    img.src = slot.optimizedUrl;
                    img.style.display = slot.optimizedUrl ? '' : 'none';
                });

                fileInput.addEventListener('change', (e) => {
                    const f = e.target.files[0] || null;
                    slot.file = f;
                    if (f) {
                        urlInput.value = '(yeni dosya: ' + f.name + ')';
                        const r = new FileReader();
                        r.onload = ev => { slot._previewData = ev.target.result; img.src = ev.target.result; img.style.display = ''; };
                        r.readAsDataURL(f);
                    }
                });

                wrap.querySelector('.img-move-up').addEventListener('click', () => this.move(i, -1));
                wrap.querySelector('.img-move-down').addEventListener('click', () => this.move(i, +1));
                wrap.querySelector('.img-thumb-toggle').addEventListener('click', () => this.setThumb(i));
                wrap.querySelector('.img-remove').addEventListener('click', () => this.removeAt(i));

                this.container.appendChild(wrap);
            });
        }
    }

    window.ImageListEditor = ImageListEditor;
})();
