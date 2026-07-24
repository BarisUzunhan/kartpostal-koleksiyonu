/* ========================================
   Paylaşım — Web Share API + masaüstü yedeği
   Telefonda OS paylaşım menüsü (görsel dosyası → Instagram/WhatsApp);
   masaüstünde WhatsApp/Telegram/X/Facebook linkleri + linki kopyala.
   ======================================== */

const Share = (function () {
    let menuEl = null;

    function shareTitle(postcard) {
        const city = postcard.city || '';
        const country = (typeof I18n !== 'undefined')
            ? I18n.translateCountry(postcard.country)
            : (postcard.country || '');
        const parts = [city, country].filter(Boolean);
        const label = parts.join(', ');
        return label || (typeof I18n !== 'undefined' ? I18n.t('siteTitle') : 'Colors of Other Lands');
    }

    function shareUrl(postcard) {
        return `${location.origin}/postcard.html?id=${encodeURIComponent(postcard.id)}`;
    }

    async function sharePostcard(postcard) {
        if (!postcard) return;
        const url = shareUrl(postcard);
        const title = shareTitle(postcard);
        const text = title;

        // 1) Dosya paylaşımı (Instagram/WhatsApp için en iyi)
        if (navigator.share && navigator.canShare) {
            try {
                const imgUrl = (typeof PostcardData !== 'undefined')
                    ? PostcardData.getImage(postcard)
                    : postcard.image_front;
                if (imgUrl) {
                    const resp = await fetch(imgUrl, { mode: 'cors' });
                    if (resp.ok) {
                        const blob = await resp.blob();
                        const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
                        const file = new File([blob], `kartpostal.${ext}`, { type: blob.type || 'image/jpeg' });
                        if (navigator.canShare({ files: [file] })) {
                            await navigator.share({ files: [file], title, text: `${text}\n${url}` });
                            return;
                        }
                    }
                }
            } catch (e) {
                if (e && e.name === 'AbortError') return; // kullanıcı iptal etti
                // aksi halde URL paylaşımına düş
            }
        }

        // 2) URL paylaşımı (native)
        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
                return;
            } catch (e) {
                if (e && e.name === 'AbortError') return;
                // düş → masaüstü popover
            }
        }

        // 3) Masaüstü yedeği — popover
        openMenu(title, url);
    }

    function openMenu(text, url) {
        closeMenu();
        const enc = encodeURIComponent;
        const shareText = `${text} ${url}`;
        const links = [
            { label: 'WhatsApp', href: `https://wa.me/?text=${enc(shareText)}` },
            { label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
            { label: 'X', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}` },
            { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` }
        ];

        const overlay = document.createElement('div');
        overlay.className = 'share-menu-overlay';

        const menu = document.createElement('div');
        menu.className = 'share-menu';

        links.forEach(l => {
            const a = document.createElement('a');
            a.href = l.href;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = l.label;
            a.addEventListener('click', () => closeMenu());
            menu.appendChild(a);
        });

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'share-copy';
        copyBtn.textContent = (typeof I18n !== 'undefined' ? I18n.t('copyLink') : 'Copy link');
        copyBtn.addEventListener('click', async () => {
            await copyToClipboard(url);
            toast(typeof I18n !== 'undefined' ? I18n.t('linkCopied') : 'Link copied');
            closeMenu();
        });
        menu.appendChild(copyBtn);

        overlay.appendChild(menu);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMenu(); });
        document.body.appendChild(overlay);
        menuEl = overlay;
        document.addEventListener('keydown', escHandler);
    }

    async function copyToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (_) {}
            ta.remove();
        }
    }

    function escHandler(e) { if (e.key === 'Escape') closeMenu(); }

    function closeMenu() {
        if (menuEl) { menuEl.remove(); menuEl = null; }
        document.removeEventListener('keydown', escHandler);
    }

    function toast(msg) {
        const el = document.createElement('div');
        el.className = 'share-toast';
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('visible'));
        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 300);
        }, 1800);
    }

    return { sharePostcard };
})();
