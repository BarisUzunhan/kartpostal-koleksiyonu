/* ========================================
   Kimlik Doğrulama — Client-side Auth
   ======================================== */

const Auth = (function () {
    const SESSION_KEY = 'postcards_auth_session';

    // Varsayılan: kullanıcı adı "admin", şifre "kartpostal2026"
    // SHA-256 hash'leri (değiştirmek için hashCredentials fonksiyonunu kullanın)
    const VALID_USERNAME_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // "admin"
    const VALID_PASSWORD_HASH = '3c8432b870909b8c05af06b66e4e6cd0af123d2524e2e325c19b01f585098d34'; // "kartpostal2026"

    async function sha256(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function login(username, password) {
        const usernameHash = await sha256(username);
        const passwordHash = await sha256(password);

        if (usernameHash === VALID_USERNAME_HASH && passwordHash === VALID_PASSWORD_HASH) {
            const token = crypto.randomUUID();
            sessionStorage.setItem(SESSION_KEY, token);
            return true;
        }

        return false;
    }

    function isAuthenticated() {
        return sessionStorage.getItem(SESSION_KEY) !== null;
    }

    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    // Yardımcı: yeni kullanıcı adı/şifre hash'i üretmek için konsol'da çalıştırılabilir
    async function hashCredentials(username, password) {
        const uh = await sha256(username);
        const ph = await sha256(password);
        console.log('Username hash:', uh);
        console.log('Password hash:', ph);
        return { usernameHash: uh, passwordHash: ph };
    }

    return { login, isAuthenticated, logout, hashCredentials };
})();
