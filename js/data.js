/* ========================================
   Veri Katmanı — localStorage + JSON CRUD
   ======================================== */

const PostcardData = (function () {
    const STORAGE_KEY = 'postcards_collection_v3';

    // Basit renk üreteci: ülke adından sabit renk
    function colorFromString(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash * 31) | 0);
        }
        var h = Math.abs(hash) % 360;
        return 'hsl(' + h + ',55%,40%)';
    }

    function makePlaceholder(city, country) {
        var color = colorFromString(country);
        var canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 533;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 800, 533);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(city, 400, 250);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '22px sans-serif';
        ctx.fillText(country, 400, 295);
        return canvas.toDataURL();
    }

    const DEFAULT_POSTCARDS = [
        // --- Fransa (4) ---
        {"id":"pc-001","imageFront":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/800px-Tour_Eiffel_Wikimedia_Commons.jpg","imageBack":"","city":"Paris","country":"Fransa","lat":48.8566,"lng":2.3522,"date":"2024-06-15","description":"Eyfel Kulesi'nin muhteşem manzarası.","description_en":"A magnificent view of the Eiffel Tower.","originalText":"La Tour Eiffel, Paris — Carte Postale"},
        {"id":"pc-007","imageFront":"","city":"Lyon","country":"Fransa","lat":45.7640,"lng":4.8357,"date":"2024-07-20","description":"Lyon'un tarihi merkezinden selamlar.","description_en":"","originalText":"Salutations de Lyon"},
        {"id":"pc-008","imageFront":"","city":"Marsilya","country":"Fransa","lat":43.2965,"lng":5.3698,"date":"2024-08-05","description":"Akdeniz kıyısından kartpostal.","description_en":"","originalText":"Bonjour de Marseille"},
        {"id":"pc-009","imageFront":"","city":"Nice","country":"Fransa","lat":43.7102,"lng":7.2620,"date":"2025-02-14","description":"Cote d'Azur'un incisi.","description_en":"","originalText":"Nice, Côte d'Azur"},

        // --- ABD (4) ---
        {"id":"pc-002","imageFront":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Empire_State_Building_%28aerial_view%29.jpg/800px-Empire_State_Building_%28aerial_view%29.jpg","imageBack":"","city":"New York","country":"ABD","lat":40.7484,"lng":-73.9857,"date":"2024-03-22","description":"Empire State Binası ve Manhattan silueti.","description_en":"Empire State Building and Manhattan skyline.","originalText":"Greetings from New York City!"},
        {"id":"pc-010","imageFront":"","city":"Los Angeles","country":"ABD","lat":34.0522,"lng":-118.2437,"date":"2024-05-10","description":"Hollywood'dan selamlar.","description_en":"","originalText":"Greetings from LA!"},
        {"id":"pc-011","imageFront":"","city":"Chicago","country":"ABD","lat":41.8781,"lng":-87.6298,"date":"2024-09-01","description":"Rüzgarlı şehirden bir manzara.","description_en":"","originalText":"Greetings from the Windy City"},
        {"id":"pc-012","imageFront":"","city":"San Francisco","country":"ABD","lat":37.7749,"lng":-122.4194,"date":"2025-01-20","description":"Golden Gate Köprüsü sisler arasında.","description_en":"","originalText":"San Francisco, CA"},

        // --- İtalya (4) ---
        {"id":"pc-003","imageFront":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Colosseum_in_Rome-April_2007-1-_copie_2B.jpg/800px-Colosseum_in_Rome-April_2007-1-_copie_2B.jpg","imageBack":"","city":"Roma","country":"İtalya","lat":41.8902,"lng":12.4922,"date":"2024-09-10","description":"Kolezyum'un etkileyici görüntüsü.","description_en":"An impressive view of the Colosseum.","originalText":"Saluti da Roma — Il Colosseo"},
        {"id":"pc-013","imageFront":"","city":"Venedik","country":"İtalya","lat":45.4408,"lng":12.3155,"date":"2024-04-18","description":"Gondollarla dolu kanallar.","description_en":"","originalText":"Saluti da Venezia"},
        {"id":"pc-014","imageFront":"","city":"Floransa","country":"İtalya","lat":43.7696,"lng":11.2558,"date":"2024-10-25","description":"Rönesans'ın başkenti.","description_en":"","originalText":"Saluti da Firenze"},
        {"id":"pc-015","imageFront":"","city":"Milano","country":"İtalya","lat":45.4642,"lng":9.1900,"date":"2025-03-08","description":"Moda ve tasarım şehri.","description_en":"","originalText":"Saluti da Milano"},

        // --- Türkiye (4) ---
        {"id":"pc-004","imageFront":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Hagia_Sophia_Mars_2013.jpg/800px-Hagia_Sophia_Mars_2013.jpg","imageBack":"","city":"İstanbul","country":"Türkiye","lat":41.0082,"lng":28.9784,"date":"2025-01-05","description":"Ayasofya'nın görkemli silueti.","description_en":"The majestic silhouette of Hagia Sophia.","originalText":"İstanbul'dan selamlar — Ayasofya"},
        {"id":"pc-016","imageFront":"","city":"Ankara","country":"Türkiye","lat":39.9334,"lng":32.8597,"date":"2024-12-01","description":"Başkentin kalbi, Anıtkabir.","description_en":"","originalText":"Ankara'dan selamlar"},
        {"id":"pc-017","imageFront":"","city":"İzmir","country":"Türkiye","lat":38.4237,"lng":27.1428,"date":"2024-08-15","description":"Ege'nin incisi İzmir.","description_en":"","originalText":"İzmir'den sevgiler"},
        {"id":"pc-018","imageFront":"","city":"Antalya","country":"Türkiye","lat":36.8969,"lng":30.7133,"date":"2025-04-01","description":"Turkuaz kıyılardan selamlar.","description_en":"","originalText":"Antalya'dan selamlar"},

        // --- Japonya (3) ---
        {"id":"pc-005","imageFront":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Mount_Fuji_from_Hotel_Mt_Fuji_1995-2-7.jpg/800px-Mount_Fuji_from_Hotel_Mt_Fuji_1995-2-7.jpg","imageBack":"","city":"Tokyo","country":"Japonya","lat":35.6762,"lng":139.6503,"date":"2024-11-18","description":"Fuji Dağı manzarası.","description_en":"A view of Mount Fuji.","originalText":"富士山からの挨拶"},
        {"id":"pc-019","imageFront":"","city":"Kyoto","country":"Japonya","lat":35.0116,"lng":135.7681,"date":"2024-10-05","description":"Tapınaklar şehri Kyoto.","description_en":"","originalText":"京都からの挨拶"},
        {"id":"pc-020","imageFront":"","city":"Osaka","country":"Japonya","lat":34.6937,"lng":135.5023,"date":"2025-02-28","description":"Osaka'nın neon ışıkları.","description_en":"","originalText":"大阪からの挨拶"},

        // --- Mısır (3) ---
        {"id":"pc-006","imageFront":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Pyramid_of_Khufu%2C_Giza%2C_Greater_Cairo%2C_Egypt.jpg/800px-Pyramid_of_Khufu%2C_Giza%2C_Greater_Cairo%2C_Egypt.jpg","imageBack":"","city":"Kahire","country":"Mısır","lat":30.0444,"lng":31.2357,"date":"2024-04-02","description":"Giza Piramitleri.","description_en":"The Pyramids of Giza.","originalText":"تحيات من القاهرة"},
        {"id":"pc-021","imageFront":"","city":"Luksor","country":"Mısır","lat":25.6872,"lng":32.6396,"date":"2024-05-20","description":"Karnak Tapınağı'ndan selamlar.","description_en":"","originalText":"تحيات من الأقصر"},
        {"id":"pc-022","imageFront":"","city":"İskenderiye","country":"Mısır","lat":31.2001,"lng":29.9187,"date":"2025-01-15","description":"Akdeniz kıyısındaki antik liman.","description_en":"","originalText":"تحيات من الإسكندرية"},

        // --- İspanya (3) ---
        {"id":"pc-023","imageFront":"","city":"Madrid","country":"İspanya","lat":40.4168,"lng":-3.7038,"date":"2024-06-01","description":"İspanya'nın kalbinden selamlar.","description_en":"","originalText":"Saludos desde Madrid"},
        {"id":"pc-024","imageFront":"","city":"Barselona","country":"İspanya","lat":41.3874,"lng":2.1686,"date":"2024-07-15","description":"Gaudi'nin şehri Barselona.","description_en":"","originalText":"Saludos desde Barcelona"},
        {"id":"pc-025","imageFront":"","city":"Sevilla","country":"İspanya","lat":37.3891,"lng":-5.9845,"date":"2025-03-20","description":"Endülüs'ün başkenti.","description_en":"","originalText":"Saludos desde Sevilla"},

        // --- Almanya (3) ---
        {"id":"pc-026","imageFront":"","city":"Berlin","country":"Almanya","lat":52.5200,"lng":13.4050,"date":"2024-08-20","description":"Berlin Duvarı'nın izleri.","description_en":"","originalText":"Grüße aus Berlin"},
        {"id":"pc-027","imageFront":"","city":"Münih","country":"Almanya","lat":48.1351,"lng":11.5820,"date":"2024-12-15","description":"Bavyera'nın başkenti.","description_en":"","originalText":"Grüße aus München"},
        {"id":"pc-028","imageFront":"","city":"Hamburg","country":"Almanya","lat":53.5511,"lng":9.9937,"date":"2025-02-10","description":"Kuzey'in kapısı Hamburg.","description_en":"","originalText":"Grüße aus Hamburg"},

        // --- İngiltere (3) ---
        {"id":"pc-029","imageFront":"","city":"Londra","country":"İngiltere","lat":51.5074,"lng":-0.1278,"date":"2024-03-10","description":"Big Ben ve Thames Nehri.","description_en":"","originalText":"Greetings from London"},
        {"id":"pc-030","imageFront":"","city":"Edinburgh","country":"İngiltere","lat":55.9533,"lng":-3.1883,"date":"2024-09-25","description":"İskoçya'nın tarihi başkenti.","description_en":"","originalText":"Greetings from Edinburgh"},
        {"id":"pc-031","imageFront":"","city":"Manchester","country":"İngiltere","lat":53.4808,"lng":-2.2426,"date":"2025-01-30","description":"Endüstri devriminin doğduğu şehir.","description_en":"","originalText":"Greetings from Manchester"},

        // --- Brezilya (3) ---
        {"id":"pc-032","imageFront":"","city":"Rio de Janeiro","country":"Brezilya","lat":-22.9068,"lng":-43.1729,"date":"2024-02-10","description":"Kurtarıcı İsa heykeli ve Copacabana.","description_en":"","originalText":"Saudações do Rio!"},
        {"id":"pc-033","imageFront":"","city":"São Paulo","country":"Brezilya","lat":-23.5505,"lng":-46.6333,"date":"2024-06-22","description":"Güney Amerika'nın en büyük şehri.","description_en":"","originalText":"Saudações de São Paulo"},
        {"id":"pc-034","imageFront":"","city":"Salvador","country":"Brezilya","lat":-12.9714,"lng":-38.5124,"date":"2025-03-15","description":"Afro-Brezilya kültürünün kalbi.","description_en":"","originalText":"Saudações de Salvador"},

        // --- Hindistan (3) ---
        {"id":"pc-035","imageFront":"","city":"Delhi","country":"Hindistan","lat":28.7041,"lng":77.1025,"date":"2024-11-05","description":"Kızıl Kale ve eski Delhi.","description_en":"","originalText":"Greetings from Delhi"},
        {"id":"pc-036","imageFront":"","city":"Mumbai","country":"Hindistan","lat":19.0760,"lng":72.8777,"date":"2024-04-12","description":"Bollywood'un şehri Mumbai.","description_en":"","originalText":"Greetings from Mumbai"},
        {"id":"pc-037","imageFront":"","city":"Agra","country":"Hindistan","lat":27.1767,"lng":78.0081,"date":"2025-02-01","description":"Tac Mahal'in gölgesinde.","description_en":"","originalText":"Greetings from Agra"},

        // --- Avustralya (3) ---
        {"id":"pc-038","imageFront":"","city":"Sydney","country":"Avustralya","lat":-33.8688,"lng":151.2093,"date":"2024-01-15","description":"Opera Binası ve liman köprüsü.","description_en":"","originalText":"G'day from Sydney!"},
        {"id":"pc-039","imageFront":"","city":"Melbourne","country":"Avustralya","lat":-37.8136,"lng":144.9631,"date":"2024-07-30","description":"Sanat ve kahve kültürünün merkezi.","description_en":"","originalText":"Greetings from Melbourne"},
        {"id":"pc-040","imageFront":"","city":"Brisbane","country":"Avustralya","lat":-27.4698,"lng":153.0251,"date":"2025-04-05","description":"Queensland'in güneşli başkenti.","description_en":"","originalText":"G'day from Brisbane!"},

        // --- Yunanistan (3) ---
        {"id":"pc-041","imageFront":"","city":"Atina","country":"Yunanistan","lat":37.9838,"lng":23.7275,"date":"2024-05-05","description":"Akropolis ve Parthenon.","description_en":"","originalText":"Χαιρετισμούς από Αθήνα"},
        {"id":"pc-042","imageFront":"","city":"Selanik","country":"Yunanistan","lat":40.6401,"lng":22.9444,"date":"2024-10-10","description":"Kuzey Yunanistan'ın incisi.","description_en":"","originalText":"Χαιρετισμούς από Θεσσαλονίκη"},
        {"id":"pc-043","imageFront":"","city":"Santorini","country":"Yunanistan","lat":36.3932,"lng":25.4615,"date":"2025-03-01","description":"Beyaz evler ve mavi kubbeler.","description_en":"","originalText":"Χαιρετισμούς από Σαντορίνη"},

        // --- Tayland (3) ---
        {"id":"pc-044","imageFront":"","city":"Bangkok","country":"Tayland","lat":13.7563,"lng":100.5018,"date":"2024-02-20","description":"Altın tapınaklar ve sokak lezzetleri.","description_en":"","originalText":"สวัสดีจากกรุงเทพ"},
        {"id":"pc-045","imageFront":"","city":"Chiang Mai","country":"Tayland","lat":18.7883,"lng":98.9853,"date":"2024-08-10","description":"Kuzey Tayland'ın huzurlu şehri.","description_en":"","originalText":"สวัสดีจากเชียงใหม่"},
        {"id":"pc-046","imageFront":"","city":"Phuket","country":"Tayland","lat":7.8804,"lng":98.3923,"date":"2025-01-25","description":"Tropikal cennet Phuket.","description_en":"","originalText":"สวัสดีจากภูเก็ต"},

        // --- Fas (3) ---
        {"id":"pc-047","imageFront":"","city":"Marakeş","country":"Fas","lat":31.6295,"lng":-7.9811,"date":"2024-03-05","description":"Jemaa el-Fna meydanının büyüsü.","description_en":"","originalText":"تحيات من مراكش"},
        {"id":"pc-048","imageFront":"","city":"Fes","country":"Fas","lat":34.0181,"lng":-5.0078,"date":"2024-09-18","description":"Dünyanın en eski üniversite şehri.","description_en":"","originalText":"تحيات من فاس"},
        {"id":"pc-049","imageFront":"","city":"Kazablanka","country":"Fas","lat":33.5731,"lng":-7.5898,"date":"2025-02-20","description":"Hassan II Camii kıyıda yükseliyor.","description_en":"","originalText":"تحيات من الدار البيضاء"},

        // --- Arjantin (2) ---
        {"id":"pc-050","imageFront":"","city":"Buenos Aires","country":"Arjantin","lat":-34.6037,"lng":-58.3816,"date":"2024-04-25","description":"Tango'nun doğduğu şehir.","description_en":"","originalText":"Saludos desde Buenos Aires"},
        {"id":"pc-051","imageFront":"","city":"Mendoza","country":"Arjantin","lat":-32.8895,"lng":-68.8458,"date":"2024-11-12","description":"And Dağları'nın eteklerinde şarap bağları.","description_en":"","originalText":"Saludos desde Mendoza"},

        // --- Güney Kore (2) ---
        {"id":"pc-052","imageFront":"","city":"Seul","country":"Güney Kore","lat":37.5665,"lng":126.9780,"date":"2024-06-08","description":"Geleneksel saraylar ve neon ışıklar.","description_en":"","originalText":"서울에서 인사드립니다"},
        {"id":"pc-053","imageFront":"","city":"Busan","country":"Güney Kore","lat":35.1796,"lng":129.0756,"date":"2025-01-10","description":"Güney kıyısının liman şehri.","description_en":"","originalText":"부산에서 인사드립니다"},

        // --- Portekiz (2) ---
        {"id":"pc-054","imageFront":"","city":"Lizbon","country":"Portekiz","lat":38.7223,"lng":-9.1393,"date":"2024-05-30","description":"Yedi tepe üzerine kurulu şehir.","description_en":"","originalText":"Saudações de Lisboa"},
        {"id":"pc-055","imageFront":"","city":"Porto","country":"Portekiz","lat":41.1579,"lng":-8.6291,"date":"2024-10-20","description":"Douro Nehri kıyısında port şarabı.","description_en":"","originalText":"Saudações do Porto"},

        // --- Çekya (2) ---
        {"id":"pc-056","imageFront":"","city":"Prag","country":"Çekya","lat":50.0755,"lng":14.4378,"date":"2024-07-04","description":"Yüz kulelerin şehri.","description_en":"","originalText":"Pozdrav z Prahy"},
        {"id":"pc-057","imageFront":"","city":"Brno","country":"Çekya","lat":49.1951,"lng":16.6068,"date":"2025-03-25","description":"Moravya'nın başkenti.","description_en":"","originalText":"Pozdrav z Brna"},

        // --- Peru (2) ---
        {"id":"pc-058","imageFront":"","city":"Lima","country":"Peru","lat":-12.0464,"lng":-77.0428,"date":"2024-08-28","description":"Pasifik kıyısında sömürge mimarisi.","description_en":"","originalText":"Saludos desde Lima"},
        {"id":"pc-059","imageFront":"","city":"Cusco","country":"Peru","lat":-13.5320,"lng":-71.9675,"date":"2025-02-05","description":"İnka İmparatorluğu'nun kalbi.","description_en":"","originalText":"Saludos desde Cusco"},

        // --- Ek ---
        {"id":"pc-060","imageFront":"","city":"Havana","country":"Küba","lat":23.1136,"lng":-82.3666,"date":"2024-12-20","description":"Eski Amerikan arabaları ve renkli sokaklar.","description_en":"","originalText":"Saludos desde La Habana"}
    ];

    function loadPostcards() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('localStorage parse hatası:', e);
            }
        }

        savePostcards(DEFAULT_POSTCARDS);
        return [...DEFAULT_POSTCARDS];
    }

    function savePostcards(postcards) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(postcards));
    }

    function getAll() {
        return loadPostcards();
    }

    function getById(id) {
        const postcards = loadPostcards();
        return postcards.find(p => p.id === id) || null;
    }

    function add(postcard) {
        const postcards = loadPostcards();
        postcard.id = crypto.randomUUID();
        postcards.push(postcard);
        savePostcards(postcards);
        return postcard;
    }

    function update(id, data) {
        const postcards = loadPostcards();
        const index = postcards.findIndex(p => p.id === id);
        if (index === -1) return null;
        postcards[index] = { ...postcards[index], ...data, id };
        savePostcards(postcards);
        return postcards[index];
    }

    function remove(id) {
        const postcards = loadPostcards();
        const filtered = postcards.filter(p => p.id !== id);
        if (filtered.length === postcards.length) return false;
        savePostcards(filtered);
        return true;
    }

    function filterPostcards(postcards, { country = '', city = '', search = '', sortBy = 'date-desc' } = {}) {
        let result = [...postcards];

        if (country) {
            result = result.filter(p => p.country === country);
        }

        if (city) {
            result = result.filter(p => p.city === city);
        }

        if (search) {
            const term = search.toLowerCase().trim();
            result = result.filter(p =>
                p.city.toLowerCase().includes(term) ||
                p.country.toLowerCase().includes(term) ||
                (p.description && p.description.toLowerCase().includes(term)) ||
                (p.description_en && p.description_en.toLowerCase().includes(term))
            );
        }

        result.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortBy === 'date-asc' ? dateA - dateB : dateB - dateA;
        });

        return result;
    }

    function getUniqueCountries(postcards) {
        return [...new Set(postcards.map(p => p.country))].sort();
    }

    function getCitiesByCountry(postcards, country) {
        const filtered = country ? postcards.filter(p => p.country === country) : postcards;
        return [...new Set(filtered.map(p => p.city))].sort();
    }

    function getSimilar(postcard, allPostcards, limit) {
        limit = limit || 4;
        return allPostcards
            .filter(p => p.id !== postcard.id && p.country === postcard.country)
            .slice(0, limit);
    }

    function getImage(postcard) {
        return postcard.imageFront || postcard.image || makePlaceholder(postcard.city, postcard.country);
    }

    return {
        getAll,
        getById,
        add,
        update,
        remove,
        filterPostcards,
        getUniqueCountries,
        getCitiesByCountry,
        getSimilar,
        getImage
    };
})();
