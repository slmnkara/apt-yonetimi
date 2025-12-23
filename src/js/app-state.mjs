import { authBus } from "./eventBus.mjs";
import { loadAdminDashboard, loadResidentData } from "./app-db.mjs";

const views = {
    loading: document.getElementById('loadingScreen'),
    login: document.getElementById('loginView'),
    admin: document.getElementById('adminView'),
    resident: document.getElementById('residentView')
};

// showView fonksiyonuna ikinci bir parametre (data) ekledik
function showView(view, data = null) {
    Object.values(views).forEach(el => el.classList.add('hidden-view'));
    views[view].classList.remove('hidden-view');

    if (view === 'admin') {
        loadAdminDashboard();
    }
    else if (view === 'resident') {
        // BURASI DEĞİŞTİ: URL'den gelen ID'yi (data) fonksiyona iletiyoruz
        if (data) {
            loadResidentData(data);
        } else {
            alert("Kimlik bilgisi bulunamadı!");
            showView('login');
        }
    }
}

authBus.addEventListener('auth-change', (e) => {
    const { isLoggedIn, user } = e.detail;

    showView('loading');
    if (isLoggedIn) {
        showView('admin');
    } else {
        const params = new URLSearchParams(window.location.search);
        const residentId = params.get('id');
        
        if (residentId) {
            // BURASI DEĞİŞTİ: residentId'yi ikinci parametre olarak gönderiyoruz
            showView('resident', residentId);
        }
        else {
            showView('login');
        }
    }
});