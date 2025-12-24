import { UIManager } from "./ui/UIManager.js";
import { dbService } from "./services/DbService.js";
import { eventBus } from "./core/EventManager.js";
import { authService } from "./services/AuthService.js";

document.addEventListener('DOMContentLoaded', async () => {
    const ui = new UIManager();

    // URL Kontrolü: Sakin Linki mi?
    const params = new URLSearchParams(window.location.search);
    const residentId = params.get('id');

    if (residentId) {
        console.log("Sakin girişi algılandı, veri çekiliyor...");
        try {
            const data = await dbService.getResidentByUrl(residentId);
            if (data) {
                ui.showResidentView(data);
            } else {
                alert("Geçersiz veya silinmiş link!");
                window.location.href = window.location.pathname; // Ana sayfaya dön
            }
        } catch (error) {
            console.error(error);
            alert("Veri çekilemedi.");
        }
    } else {
        // Normal Yönetici Girişi
        eventBus.subscribe('AUTH_STATE_CHANGED', (state) => {
            if (state.isLoggedIn) {
                dbService.listenData(); 
                console.log("Yönetici girişi: Veri akışı aktif.");
            }
        });

        console.log("Sistem: Auth servisi başlatılıyor...");
        authService.init(); 
    }
});