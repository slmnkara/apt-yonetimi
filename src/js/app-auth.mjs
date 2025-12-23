// --- DOSYA: src/js/app-auth.mjs ---

import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.mjs";
import { authBus } from "./eventBus.mjs";

// --- YARDIMCI: Loading Ekranı Kontrolü ---
// Bu dosya içinde hızlıca kullanmak için basit bir yardımcı
const toggleLoading = (show) => {
    const loader = document.getElementById('loadingScreen');
    if (show) loader.classList.remove('hidden-view');
    else loader.classList.add('hidden-view');
};

// --- 1. AUTH FONKSİYONLARI ---
export async function SignIn(email, password) {
    try {
        // Başarılı olursa zaten onAuthStateChanged tetiklenir ve app-state.mjs loading'i yönetir.
        // O yüzden burada "başarılı" durum için bir şey yapmaya gerek yok.
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        // HATA DURUMU: Loading ekranını kapatmalıyız ki kullanıcı tekrar deneyebilsin.
        console.log("Hata: " + err.message);
        toggleLoading(false); // <--- EKLENDİ: Hata varsa loading'i kapat

        let errorMessage = "";
        switch (err.code) {
            case 'auth/invalid-email':
                errorMessage = "Lütfen geçerli bir e-posta adresi giriniz.";
                break;
            case 'auth/user-not-found':
            case 'auth/invalid-credential':
                errorMessage = "E-posta veya şifre hatalı.";
                break;
            case 'auth/wrong-password':
                errorMessage = "Hatalı şifre girdiniz.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Çok fazla deneme yaptınız. Biraz bekleyin.";
                break;
            case 'auth/network-request-failed':
                errorMessage = "İnternet bağlantınızı kontrol edin.";
                break;
            default:
                errorMessage = "Bir hata oluştu: " + err.message;
                break;
        }
        alert(errorMessage);
    }
}

export function SignOut() {
    signOut(auth).then(() => {
        console.log("Çıkış yapıldı");
    }).catch((error) => {
        console.error("Çıkış hatası", error);
        toggleLoading(false); // Hata olursa loading'i kapat
    });
}

// Uygulama Başlatıcı
export function initAuth() {
    onAuthStateChanged(auth, (user) => {
        console.log("Auth Durumu Değişti:", user ? "Giriş Yapıldı" : "Çıkış Yapıldı");
        
        const event = new CustomEvent('auth-change', {
            detail: { 
                isLoggedIn: !!user, 
                user: user 
            }
        });

        authBus.dispatchEvent(event);
    });
}

// --- 2. BAŞLANGIÇ VE EVENT LISTENERLAR ---

initAuth();

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // 1. İŞLEM BAŞLADI: Loading'i hemen göster
        toggleLoading(true); // <--- EKLENDİ

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        SignIn(email, password);
    });
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        // 2. ÇIKIŞ BAŞLADI: Loading'i hemen göster
        toggleLoading(true); // <--- EKLENDİ
        
        SignOut();
    });
}