/* ========================================
   Veri Katmanı — localStorage + JSON CRUD
   ======================================== */

const PostcardData = (function () {
    const STORAGE_KEY = 'postcards_collection_v2';

    const DEFAULT_POSTCARDS = [
        {
            "id": "pc-001",
            "imageFront": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/800px-Tour_Eiffel_Wikimedia_Commons.jpg",
            "imageBack": "",
            "city": "Paris",
            "country": "Fransa",
            "lat": 48.8566,
            "lng": 2.3522,
            "date": "2024-06-15",
            "description": "Eyfel Kulesi'nin muhteşem manzarası. Bahar aylarında Paris'in en güzel kartpostalı.",
            "description_en": "A magnificent view of the Eiffel Tower. The most beautiful postcard of Paris in spring.",
            "originalText": "La Tour Eiffel, Paris — Carte Postale"
        },
        {
            "id": "pc-002",
            "imageFront": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Empire_State_Building_%28aerial_view%29.jpg/800px-Empire_State_Building_%28aerial_view%29.jpg",
            "imageBack": "",
            "city": "New York",
            "country": "ABD",
            "lat": 40.7484,
            "lng": -73.9857,
            "date": "2024-03-22",
            "description": "Empire State Binası ve Manhattan silueti. Klasik bir Amerikan kartpostalı.",
            "description_en": "Empire State Building and Manhattan skyline. A classic American postcard.",
            "originalText": "Greetings from New York City!"
        },
        {
            "id": "pc-003",
            "imageFront": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Colosseum_in_Rome-April_2007-1-_copie_2B.jpg/800px-Colosseum_in_Rome-April_2007-1-_copie_2B.jpg",
            "imageBack": "",
            "city": "Roma",
            "country": "İtalya",
            "lat": 41.8902,
            "lng": 12.4922,
            "date": "2024-09-10",
            "description": "Kolezyum'un etkileyici görüntüsü. Antik Roma'nın en ikonik yapısı.",
            "description_en": "An impressive view of the Colosseum. The most iconic structure of ancient Rome.",
            "originalText": "Saluti da Roma — Il Colosseo"
        },
        {
            "id": "pc-004",
            "imageFront": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Hagia_Sophia_Mars_2013.jpg/800px-Hagia_Sophia_Mars_2013.jpg",
            "imageBack": "",
            "city": "İstanbul",
            "country": "Türkiye",
            "lat": 41.0082,
            "lng": 28.9784,
            "date": "2025-01-05",
            "description": "Ayasofya'nın görkemli silueti. Doğu ile Batı'nın buluştuğu şehirden selamlar.",
            "description_en": "The majestic silhouette of Hagia Sophia. Greetings from the city where East meets West.",
            "originalText": "İstanbul'dan selamlar — Ayasofya"
        },
        {
            "id": "pc-005",
            "imageFront": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Mount_Fuji_from_Hotel_Mt_Fuji_1995-2-7.jpg/800px-Mount_Fuji_from_Hotel_Mt_Fuji_1995-2-7.jpg",
            "imageBack": "",
            "city": "Tokyo",
            "country": "Japonya",
            "lat": 35.6762,
            "lng": 139.6503,
            "date": "2024-11-18",
            "description": "Fuji Dağı manzarası. Japonya'nın kutsal dağından bir kış kartpostalı.",
            "description_en": "A view of Mount Fuji. A winter postcard from Japan's sacred mountain.",
            "originalText": "\u5bcc\u58eb\u5c71\u304b\u3089\u306e\u6328\u62f6 — Fuji-san kara no aisatsu"
        },
        {
            "id": "pc-006",
            "imageFront": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Pyramid_of_Khufu%2C_Giza%2C_Greater_Cairo%2C_Egypt.jpg/800px-Pyramid_of_Khufu%2C_Giza%2C_Greater_Cairo%2C_Egypt.jpg",
            "imageBack": "",
            "city": "Kahire",
            "country": "Mısır",
            "lat": 30.0444,
            "lng": 31.2357,
            "date": "2024-04-02",
            "description": "Giza Piramitleri. Binlerce yıllık tarihin kartpostala yansıması.",
            "description_en": "The Pyramids of Giza. Thousands of years of history captured in a postcard.",
            "originalText": "\u062a\u062d\u064a\u0627\u062a \u0645\u0646 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 — Greetings from Cairo"
        }
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
        return postcard.imageFront || postcard.image || '';
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
