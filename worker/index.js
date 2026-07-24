/* ========================================
   Cloudflare Worker — Kartpostal sayfalarına sosyal paylaşım (Open Graph)
   meta etiketlerini sunucu tarafında enjekte eder.

   Sosyal medya botları (WhatsApp, Telegram, Facebook, X...) JavaScript
   çalıştırmaz; bu yüzden client-side yüklenen kartpostal verisini göremezler.
   Bu Worker yalnız `/postcard.html?id=...` isteklerinde araya girer, static
   HTML'i alır, Supabase'den kartpostalı çeker ve HTMLRewriter ile og:/twitter:
   etiketlerini + <title>'ı kartpostala özgü değerlerle doldurur.

   Diğer tüm istekler doğrudan static assets'e (env.ASSETS) geçer.
   ======================================== */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (url.pathname === '/postcard.html' && id) {
            return handlePostcard(request, env, id);
        }
        return env.ASSETS.fetch(request);
    }
};

async function handlePostcard(request, env, id) {
    // Static HTML'i al
    const assetResp = await env.ASSETS.fetch(request);

    const ctype = assetResp.headers.get('content-type') || '';
    if (!ctype.includes('text/html')) return assetResp;

    // Kartpostalı Supabase REST'ten çek
    let card = null;
    try {
        const api = `${env.SUPABASE_URL}/rest/v1/postcards`
            + `?id=eq.${encodeURIComponent(id)}`
            + `&select=city,country,description,description_en,image_front,image_thumbnail`
            + `&limit=1`;
        const r = await fetch(api, {
            headers: {
                apikey: env.SUPABASE_ANON_KEY,
                Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`
            }
        });
        if (r.ok) {
            const rows = await r.json();
            card = Array.isArray(rows) ? rows[0] : null;
        }
    } catch (e) {
        // ağ/erişim hatası → HTML'i olduğu gibi bırak
    }

    if (!card) return assetResp;

    const city = card.city || '';
    const country = card.country || '';
    const label = [city, country].filter(Boolean).join(', ');
    const title = label ? `${label} — Başka Toprakların Renkleri` : 'Başka Toprakların Renkleri';
    const desc = (card.description || card.description_en
        || 'Başka Toprakların Renkleri — dünyanın dört bir yanından kartpostal koleksiyonu.')
        .replace(/\s+/g, ' ').trim().slice(0, 200);
    const image = card.image_thumbnail || card.image_front || '';
    const pageUrl = request.url;

    const setContent = (val) => ({
        element(el) { el.setAttribute('content', val); }
    });

    let rewriter = new HTMLRewriter()
        .on('title', { element(el) { el.setInnerContent(title); } })
        .on('meta[name="description"]', setContent(desc))
        .on('meta[property="og:type"]', setContent('article'))
        .on('meta[property="og:title"]', setContent(title))
        .on('meta[property="og:description"]', setContent(desc))
        .on('meta[property="og:url"]', setContent(pageUrl));

    if (image) {
        rewriter = rewriter
            .on('meta[property="og:image"]', setContent(image))
            .on('meta[name="twitter:image"]', setContent(image));
    }

    return rewriter.transform(assetResp);
}
