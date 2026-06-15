/* ========================================
   Kimlik Doğrulama — Supabase Auth
   Gerçek server-side oturum yönetimi.
   ======================================== */

const Auth = (function () {

    async function login(email, password) {
        const { data, error } = await SupabaseClient.auth.signInWithPassword({ email, password });
        if (error) return { success: false, message: error.message };
        return { success: true, user: data.user };
    }

    async function logout() {
        const { error } = await SupabaseClient.auth.signOut();
        if (error) console.error('Çıkış hatası:', error.message);
    }

    async function getSession() {
        const { data } = await SupabaseClient.auth.getSession();
        return data?.session || null;
    }

    async function isAuthenticated() {
        const session = await getSession();
        return !!session;
    }

    // Oturum değişikliklerini dinle (opsiyonel kullanım için)
    function onAuthChange(callback) {
        return SupabaseClient.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }

    return { login, logout, getSession, isAuthenticated, onAuthChange };
})();
