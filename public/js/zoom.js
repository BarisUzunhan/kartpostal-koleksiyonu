/* ========================================
   ImageZoom — Tam Ekran Görsel Büyütme
   Tekerlek/pinch ile ölçek, sürükle ile kaydır
   ======================================== */

const ImageZoom = (function () {
    let overlay = null;
    let img     = null;
    let closeBtn = null;

    // Dönüşüm durumu
    let scale   = 1;
    let tx      = 0, ty = 0;   // translate px
    let dragging = false;
    let dragStartX = 0, dragStartY = 0, dragStartTx = 0, dragStartTy = 0;

    // Pinch durumu
    let pinchDist = null;
    let pinchScale = 1;

    const MIN_SCALE = 1;
    const MAX_SCALE = 5;

    function build() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'zoom-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        img = document.createElement('img');
        img.className = 'zoom-img';
        img.alt = '';

        closeBtn = document.createElement('button');
        closeBtn.className = 'zoom-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Kapat';

        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        // ── Olaylar ──────────────────────────────────────────────────────
        closeBtn.addEventListener('click', close);

        // Overlay'e tık (görsel dışına)
        overlay.addEventListener('click', e => {
            if (e.target === overlay) close();
        });

        // Klavye
        document.addEventListener('keydown', e => {
            if (!overlay.classList.contains('open')) return;
            if (e.key === 'Escape') close();
        });

        // Çift tık → sıfırla
        img.addEventListener('dblclick', resetTransform);

        // Fare tekerleği ile zoom
        overlay.addEventListener('wheel', onWheel, { passive: false });

        // Fare sürükle
        img.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup',   onMouseUp);

        // Dokunmatik pinch + sürükle
        overlay.addEventListener('touchstart', onTouchStart, { passive: false });
        overlay.addEventListener('touchmove',  onTouchMove,  { passive: false });
        overlay.addEventListener('touchend',   onTouchEnd);
    }

    // ── Zoom aç/kapat ───────────────────────────────────────────────────────
    function open(url) {
        build();
        scale = 1; tx = 0; ty = 0;
        applyTransform();
        img.src = url;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        if (!overlay) return;
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        img.src = '';
    }

    // ── Dönüşüm ────────────────────────────────────────────────────────────
    function applyTransform() {
        img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
        img.style.cursor = scale > 1 ? 'grab' : 'zoom-out';
    }

    function clampTranslate(nx, ny) {
        if (scale <= 1) return { x: 0, y: 0 };
        const w = img.offsetWidth  * (scale - 1) / 2;
        const h = img.offsetHeight * (scale - 1) / 2;
        return { x: Math.max(-w, Math.min(w, nx)), y: Math.max(-h, Math.min(h, ny)) };
    }

    function resetTransform() {
        scale = 1; tx = 0; ty = 0;
        applyTransform();
    }

    // ── Tekerlek zoom ───────────────────────────────────────────────────────
    function onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.15 : 0.87;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * delta));
        const clamped = clampTranslate(tx, ty);
        tx = clamped.x; ty = clamped.y;
        applyTransform();
    }

    // ── Fare sürükle ────────────────────────────────────────────────────────
    function onMouseDown(e) {
        if (e.button !== 0) return;
        dragging = true;
        dragStartX = e.clientX; dragStartY = e.clientY;
        dragStartTx = tx; dragStartTy = ty;
        img.style.cursor = 'grabbing';
        e.preventDefault();
    }

    function onMouseMove(e) {
        if (!dragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        const clamped = clampTranslate(dragStartTx + dx, dragStartTy + dy);
        tx = clamped.x; ty = clamped.y;
        applyTransform();
    }

    function onMouseUp() {
        dragging = false;
        img.style.cursor = scale > 1 ? 'grab' : 'zoom-out';
    }

    // ── Dokunmatik ─────────────────────────────────────────────────────────
    function getTouchDist(e) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        return Math.hypot(dx, dy);
    }

    function onTouchStart(e) {
        if (e.touches.length === 2) {
            pinchDist  = getTouchDist(e);
            pinchScale = scale;
            e.preventDefault();
        } else if (e.touches.length === 1) {
            dragging = true;
            dragStartX = e.touches[0].clientX;
            dragStartY = e.touches[0].clientY;
            dragStartTx = tx; dragStartTy = ty;
        }
    }

    function onTouchMove(e) {
        if (e.touches.length === 2 && pinchDist !== null) {
            e.preventDefault();
            const newDist = getTouchDist(e);
            scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchScale * (newDist / pinchDist)));
            const clamped = clampTranslate(tx, ty);
            tx = clamped.x; ty = clamped.y;
            applyTransform();
        } else if (e.touches.length === 1 && dragging) {
            e.preventDefault();
            const dx = e.touches[0].clientX - dragStartX;
            const dy = e.touches[0].clientY - dragStartY;
            const clamped = clampTranslate(dragStartTx + dx, dragStartTy + dy);
            tx = clamped.x; ty = clamped.y;
            applyTransform();
        }
    }

    function onTouchEnd() {
        pinchDist = null;
        dragging  = false;
    }

    return { open, close };
})();
