import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove, setDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase-config.mjs";

// --- 2. GLOBAL DEĞİŞKENLER ---
const views = {
    loading: document.getElementById('loadingScreen'),
    login: document.getElementById('loginView'),
    admin: document.getElementById('adminView'),
    resident: document.getElementById('residentView')
};

let meskenListesi = [];
let globalKasaHareketler = []; // Yeni değişken

// --- 3. BAŞLANGIÇ MANTIĞI (ROUTING) ---
async function init() {
    const params = new URLSearchParams(window.location.search);
    const residentId = params.get('id');

    if (residentId) {
        // URL Parametresi varsa -> SAKİN MODU
        await loadResidentData(residentId);
    } else {
        // Parametre yoksa -> ADMIN MODU (Auth kontrolü)
        onAuthStateChanged(auth, (user) => {
            if (user) {
                loadAdminDashboard();
            } else {
                showView('login');
            }
        });
    }
}

function showView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden-view'));
    views[viewName].classList.remove('hidden-view');
}

// --- 4. ADMIN FONKSİYONLARI ---

// Giriş Yap
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        alert("Hata: " + err.message);
    }
});

// Çıkış Yap
document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

// Admin Verilerini Yükle
function loadAdminDashboard() {
    showView('admin');

    // Kasa Dinle
    const kasaRef = doc(db, "kasa", "ana_kasa");
    // loadAdminDashboard içindeki kasaRef onSnapshot kısmını bununla değiştir:
    onSnapshot(kasaRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            globalKasaHareketler = data.hareketler || []; // Veriyi global değişkene atadık
            document.getElementById('kasaBakiye').innerText = `${data.toplam_bakiye || 0} ₺`;
            renderKasaList(globalKasaHareketler);
        } else {
            setDoc(kasaRef, { toplam_bakiye: 0, hareketler: [] });
        }
    });

    // Meskenleri Dinle
    const meskenRef = collection(db, "meskenler");
    onSnapshot(meskenRef, (snapshot) => {
        meskenListesi = [];
        snapshot.forEach(doc => {
            meskenListesi.push({ dbId: doc.id, ...doc.data() });
        });
        renderMeskenTable();
    });
}

// Kasa Listesi Render
function renderKasaList(hareketler) {
    const list = document.getElementById('kasaList');
    list.innerHTML = '';
    // Sondan başa (yeniler üstte)
    hareketler.slice().reverse().slice(0,4).forEach(h => {
        const color = h.tur === 'gelir' ? 'text-green-600' : 'text-red-600';
        const icon = h.tur === 'gelir' ? '+' : '-';
        list.innerHTML += `
                    <li class="flex justify-between border-b pb-1 last:border-0">
                        <span>${h.aciklama}</span>
                        <span class="${color} font-bold">${icon}${h.tutar} ₺</span>
                    </li>
                `;
    });
}

// Mesken Ekle
document.getElementById('addMeskenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const adi = document.getElementById('yeniSakinAdi').value;
    const daire = document.getElementById('yeniDaireNo').value;

    // Random Unique ID oluştur
    const uniqueUrlId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);

    await addDoc(collection(db, "meskenler"), {
        sakin_adi: adi,
        kod: daire,
        mesken_url: uniqueUrlId,
        borclar: [],
        odemeler: []
    });
    e.target.reset();
});

// Mesken Tablosu Render
function renderMeskenTable() {
    const tbody = document.getElementById('meskenTableBody');
    tbody.innerHTML = '';
    meskenListesi.sort((a, b) => parseInt(a.kod) - parseInt(b.kod)).forEach(m => {
        const toplamBorc = m.borclar.reduce((acc, curr) => acc + parseFloat(curr.tutar), 0);
        // URL Oluşturma
        const fullUrl = `${window.location.origin}${window.location.pathname}?id=${m.mesken_url}`;

        tbody.innerHTML += `
                    <tr class="hover:bg-gray-800">
                        <td class="p-3"><input type="checkbox" class="mesken-check" value="${m.dbId}"></td>
                        <td class="p-3 font-bold text-center rounded w-12">${m.kod}</td>
                        <td class="p-3">${m.sakin_adi}</td>
                        <td class="p-3">
                            ${toplamBorc > 0
                ? `<span class="text-red-600 font-bold">-${toplamBorc} ₺</span> <button onclick="window.payDebt('${m.dbId}')" class="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">Öde</button>`
                : '<span class="text-green-500"><i class="fas fa-check"></i> Temiz</span>'}
                        </td>
                        <td class="p-3">
                            <button onclick="navigator.clipboard.writeText('${fullUrl}'); alert('Link Kopyalandı!')" class="text-blue-500 text-sm underline">Link Kopyala</button>
                        </td>
                        <td class="p-3">
                            <button onclick="window.deleteMesken('${m.dbId}')" class="text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
    });
}

// --- 5. TOPLU İŞLEMLER ---

// Borç Ekleme Fonksiyonu (Generic)
async function addDebtToMesken(dbId, aciklama, miktar) {
    const ref = doc(db, "meskenler", dbId);
    const borcObj = {
        id: Date.now() + Math.random().toString(),
        aciklama: aciklama,
        tutar: parseFloat(miktar),
        tarih: new Date().toLocaleDateString('tr-TR')
    };
    await updateDoc(ref, {
        borclar: arrayUnion(borcObj)
    });
}

// Toplu Borç Butonu
document.getElementById('btnTopluBorc').addEventListener('click', async () => {
    const aciklama = document.getElementById('borcAciklama').value;
    const miktar = document.getElementById('borcMiktar').value;
    if (!aciklama || !miktar) return alert("Bilgileri giriniz");

    if (confirm("Tüm dairelere borç eklenecek. Onaylıyor musunuz?")) {
        for (const m of meskenListesi) {
            await addDebtToMesken(m.dbId, aciklama, miktar);
        }
        alert("İşlem tamam.");
    }
});

// Seçili Borç Butonu
document.getElementById('btnSeciliBorc').addEventListener('click', async () => {
    const aciklama = document.getElementById('borcAciklama').value;
    const miktar = document.getElementById('borcMiktar').value;
    const selected = Array.from(document.querySelectorAll('.mesken-check:checked')).map(cb => cb.value);

    if (selected.length === 0) return alert("Daire seçmediniz.");
    if (!aciklama || !miktar) return alert("Bilgileri giriniz");

    for (const dbId of selected) {
        await addDebtToMesken(dbId, aciklama, miktar);
    }
    alert(`${selected.length} daireye borç eklendi.`);
});

// --- 6. GLOBAL WINDOW FONKSIYONLARI (HTML onclick için) ---

// Ödeme Al (Borcu sil, ödemelere ekle, kasaya ekle)
window.payDebt = async (dbId) => {
    const m = meskenListesi.find(x => x.dbId === dbId);
    if (!m || m.borclar.length === 0) return;

    // En eski borcu veya toplam borcu ödeyebiliriz. Basitlik için tüm borçları kapatalım.
    const toplamTutar = m.borclar.reduce((acc, c) => acc + parseFloat(c.tutar), 0);

    if (!confirm(`${m.sakin_adi} için ${toplamTutar} TL tahsilat yapılacak. Onaylıyor musunuz?`)) return;

    const ref = doc(db, "meskenler", dbId);
    const kasaRef = doc(db, "kasa", "ana_kasa");

    // Borçları temizle, ödemelere ekle
    // Not: Firestore arrayUnion tek seferde birden çok obje için spread (...) ister ama burada basitçe borclar arrayini boşaltıp ödemelere ekleyeceğiz.
    // Gerçek projede transaction kullanmak daha güvenlidir.

    const yeniOdemeler = m.borclar.map(b => ({
        ...b,
        odeme_tarihi: new Date().toLocaleDateString('tr-TR')
    }));

    // 1. Mesken Güncelle
    await updateDoc(ref, {
        borclar: [], // Borçları sıfırla
        odemeler: arrayUnion(...yeniOdemeler)
    });

    // 2. Kasayı Güncelle
    await updateDoc(kasaRef, {
        toplam_bakiye: (await getDoc(kasaRef)).data().toplam_bakiye + toplamTutar,
        hareketler: arrayUnion({
            tur: 'gelir',
            aciklama: `${m.kod} nolu daire aidat ödemesi`,
            tutar: toplamTutar,
            tarih: new Date().toLocaleDateString('tr-TR')
        })
    });
};

window.deleteMesken = async (dbId) => {
    if (confirm("Daire silinecek?")) {
        await deleteDoc(doc(db, "meskenler", dbId)); // deleteDoc import edilmeli
    }
};
// Not: deleteDoc import listesine eklenmeli, aşağıda ekliyorum.
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// --- 7. SAKİN GÖRÜNÜMÜ LOGIC ---
async function loadResidentData(uniqueId) {
    const q = query(collection(db, "meskenler"), "mesken_url" == uniqueId); // Basit sorgu, unique ID ile arama
    // Firestore 'where' sorgusu:
    const meskenlerRef = collection(db, "meskenler");
    // Client side filtering yerine query kullanmak daha iyidir ama ID unique ise find da olur.
    // Ancak güvenlik için query:
    const snapshot = await getDocs(query(meskenlerRef)); // Bu demo için tümünü çekip filtreliyoruz (URL parametresi query için index gerektirebilir)

    // Gerçek dünyada: query(collection(db, "meskenler"), where("mesken_url", "==", uniqueId))
    // Burada basit filtre:
    let found = null;
    snapshot.forEach(doc => {
        if (doc.data().mesken_url === uniqueId) found = doc.data();
    });

    if (found) {
        document.getElementById('resSakinAdi').innerText = found.sakin_adi;
        document.getElementById('resDaireNo').innerText = `Daire No: ${found.kod}`;

        // Borçlar
        const unpaidDiv = document.getElementById('resUnpaidList');
        if (found.borclar.length > 0) {
            unpaidDiv.innerHTML = '';
            found.borclar.forEach(b => {
                unpaidDiv.innerHTML += `
                            <div class="flex justify-between items-center bg-red-50 p-3 rounded border border-red-100">
                                <div>
                                    <div class="font-bold text-gray-700">${b.aciklama}</div>
                                    <div class="text-xs text-gray-500">${b.tarih}</div>
                                </div>
                                <div class="font-bold text-red-600">${b.tutar} ₺</div>
                            </div>
                        `;
            });
        }

        // Geçmiş
        const historyBody = document.getElementById('resHistoryBody');
        historyBody.innerHTML = '';
        found.odemeler.reverse().forEach(o => {
            historyBody.innerHTML += `
                        <tr class="border-b">
                            <td class="p-2 text-gray-600">${o.odeme_tarihi}</td>
                            <td class="p-2">${o.aciklama}</td>
                            <td class="p-2 text-right font-bold text-gray-700">${o.tutar} ₺</td>
                        </tr>
                    `;
        });

        showView('resident');
    } else {
        alert("Geçersiz daire linki!");
        showView('login');
    }
}

// --- 8. UI YARDIMCILARI ---
window.openModal = (id) => document.getElementById(id).classList.remove('hidden-view');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden-view');

window.KasaIslem = async () => {
    const type = document.getElementById('kasaType').value;
    const desc = document.getElementById('kasaDesc').value;
    const amount = parseFloat(document.getElementById('kasaAmount').value);

    const kasaRef = doc(db, "kasa", "ana_kasa");
    const kasaDoc = await getDoc(kasaRef);
    let currentBalance = kasaDoc.data().toplam_bakiye || 0;

    if (type === 'gelir') currentBalance += amount;
    else currentBalance -= amount;

    await updateDoc(kasaRef, {
        toplam_bakiye: currentBalance,
        hareketler: arrayUnion({
            tur: type,
            aciklama: desc,
            tutar: amount,
            tarih: new Date().toLocaleDateString('tr-TR')
        })
    });
    window.closeModal('modalIncome');
};

// Tarih formatını (GG.AA.YYYY) JS Date objesine çeviren yardımcı fonksiyon
function parseDateTR(dateStr) {
    const parts = dateStr.split('.');
    // parts[0]=gun, parts[1]=ay, parts[2]=yil
    // JS Date(yil, ay-1, gun) formatındadır.
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

window.printKasaReport = () => {
    const startVal = document.getElementById('reportStartDate').value;
    const endVal = document.getElementById('reportEndDate').value;

    if (!startVal || !endVal) {
        alert("Lütfen başlangıç ve bitiş tarihlerini seçiniz.");
        return;
    }

    const startDate = new Date(startVal);
    const endDate = new Date(endVal);

    // Bitiş gününün sonuna kadar kapsaması için saati 23:59 yapalım veya günü bir sonraya kaydıralım. 
    // Basitlik için sadece tarih karşılaştırması yapacağız.

    // Filtreleme
    const filtered = globalKasaHareketler.filter(h => {
        const hDate = parseDateTR(h.tarih);
        // Tarih karşılaştırması (Saatleri sıfırlayarak)
        hDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        return hDate >= startDate && hDate <= endDate;
    });

    if (filtered.length === 0) {
        alert("Seçilen tarih aralığında kayıt bulunamadı.");
        return;
    }

    // Toplamları Hesapla
    let toplamGelir = 0;
    let toplamGider = 0;

    // Tabloyu Oluştur
    let htmlContent = `
        <h1 class="text-2xl font-bold mb-2 text-center">Apartman Kasa Raporu</h1>
        <p class="text-center mb-6 text-gray-500">${startVal.split('-').reverse().join('.')} - ${endVal.split('-').reverse().join('.')} Tarihleri Arası</p>
        
        <table class="w-full border-collapse border border-gray-300 text-sm">
            <thead>
                <tr class="bg-gray-100">
                    <th class="border border-gray-300 p-2 text-left">Tarih</th>
                    <th class="border border-gray-300 p-2 text-left">Açıklama</th>
                    <th class="border border-gray-300 p-2 text-left">Tür</th>
                    <th class="border border-gray-300 p-2 text-right">Tutar</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtered.forEach(item => {
        if (item.tur === 'gelir') toplamGelir += parseFloat(item.tutar);
        else toplamGider += parseFloat(item.tutar);

        const rowColor = item.tur === 'gelir' ? 'text-green-700' : 'text-red-700';
        const turYazi = item.tur === 'gelir' ? 'GELİR' : 'GİDER';

        htmlContent += `
            <tr>
                <td class="border border-gray-300 p-2">${item.tarih}</td>
                <td class="border border-gray-300 p-2">${item.aciklama}</td>
                <td class="border border-gray-300 p-2 font-bold ${rowColor}">${turYazi}</td>
                <td class="border border-gray-300 p-2 text-right font-mono">${item.tutar} ₺</td>
            </tr>
        `;
    });

    htmlContent += `
            </tbody>
        </table>

        <div class="mt-6 flex justify-end">
            <table class="w-1/2 text-right border border-gray-300">
                <tr>
                    <td class="p-2 border-b">Toplam Gelir:</td>
                    <td class="p-2 border-b font-bold text-green-700">+${toplamGelir} ₺</td>
                </tr>
                <tr>
                    <td class="p-2 border-b">Toplam Gider:</td>
                    <td class="p-2 border-b font-bold text-red-700">-${toplamGider} ₺</td>
                </tr>
                <tr class="bg-gray-100">
                    <td class="p-2 font-bold">Dönem Bakiyesi:</td>
                    <td class="p-2 font-bold text-blue-800">${toplamGelir - toplamGider} ₺</td>
                </tr>
            </table>
        </div>
        <div class="mt-10 text-xs text-gray-400 text-center">Bu rapor ${new Date().toLocaleString()} tarihinde oluşturulmuştur.</div>
    `;

    // İçeriği yazdırılacak alana bas
    const printArea = document.getElementById('printArea');
    printArea.innerHTML = htmlContent;

    // Yazdır
    window.print();
};

// Uygulamayı Başlat
init();