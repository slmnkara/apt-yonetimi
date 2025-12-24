import { auth } from "../firebase-config.js"; 
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { eventBus } from "../core/EventManager.js";

class AuthService {
    constructor() {
        // this.init(); // <--- BU SATIRI SİLİYORUZ. Otomatik başlamasın.
    }

    // Bu fonksiyonu artık main.js'ten elle çağıracağız
    init() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Kullanıcı giriş yaptı:", user.email);
                eventBus.publish('AUTH_STATE_CHANGED', { user: user, isLoggedIn: true });
            } else {
                console.log("Kullanıcı çıkış yaptı");
                eventBus.publish('AUTH_STATE_CHANGED', { user: null, isLoggedIn: false });
            }
        });
    }

    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Giriş Hatası:", error);
            alert("Giriş başarısız: " + error.message);
            eventBus.publish('LOGIN_ERROR', error);
        }
    }

    async logout() {
        await signOut(auth);
    }
}

export const authService = new AuthService();