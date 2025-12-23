import { collection, addDoc, doc, getDocs, updateDoc, arrayUnion, setDoc, onSnapshot, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.mjs";
import { auth } from "./firebase-config.mjs"; // Auth eklendi

// Değişkenleri export ediyoruz ki app.mjs erişebilsin
export let meskenListesi = [];
export let globalKasaHareketler = []; 

// Admin Verilerini Yükle
export function loadAdminDashboard() {
    // Login olan kullanıcının mailini gösterelim (README maddesi)
    if(auth.currentUser) {
        // Yeni eklediğimiz ID'yi seçiyoruz
        const mailDisplay = document.getElementById("adminEmailLabel");
        
        if(mailDisplay) {
            mailDisplay.innerText = auth.currentUser.email;
            // Opsiyonel: Title özelliğine de ekleyerek üzerine gelince tam maili gösterelim
            mailDisplay.title = auth.currentUser.email; 
        }
    }

    // Kasa Dinle
    const kasaRef = doc(db, "kasa", "ana_kasa");
    onSnapshot(kasaRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            globalKasaHareketler = data.hareketler || [];
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

// ... Mevcut importlar ve kodlar ...

function renderKasaList(hareketler) {
    const list = document.getElementById('kasaList');
    if (!list) return;

    list.innerHTML = '';
    // Sondan başa (yeniler üstte), son 50 hareketi gösterelim (scroll olduğu için sayıyı artırabiliriz)
    // slice(0,4) yerine daha fazla göstermek kullanıcı için daha iyidir, css'de zaten overflow-y-auto var.
    hareketler.slice().reverse().forEach(h => {
        const color = h.tur === 'gelir' ? 'text-green-500' : 'text-red-500';
        const icon = h.tur === 'gelir' ? '+' : '-';
        
        // Hareketi silme butonu eklendi (window.deleteKasaHareket)
        list.innerHTML += `
            <li class="flex justify-between items-center border-b border-gray-700 pb-2 last:border-0 hover:bg-white/5 p-1 rounded transition">
                <div class="flex flex-col overflow-hidden">
                    <span class="text-gray-300 text-sm truncate" title="${h.aciklama}">${h.aciklama}</span>
                    <span class="text-xs text-gray-500">${h.tarih}</span>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <span class="${color} font-bold text-sm">${icon}${h.tutar} ₺</span>
                    <button onclick="window.deleteKasaHareket('${h.id}')" 
                        class="text-gray-600 hover:text-red-500 transition-colors p-1" 
                        title="İşlemi Geri Al / Sil">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </li>
        `;
    });
}

// ... Diğer kodlar ...

// Mesken Ekle Listener
const addMeskenForm = document.getElementById('addMeskenForm');
if(addMeskenForm) {
    addMeskenForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adi = document.getElementById('yeniSakinAdi').value;
        const daire = document.getElementById('yeniDaireNo').value;

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
}

// Mesken Tablosu Render
function renderMeskenTable() {
    const tbody = document.getElementById('meskenTableBody');
    if(!tbody) return;

    tbody.innerHTML = '';
    meskenListesi.sort((a, b) => parseInt(a.kod) - parseInt(b.kod)).forEach(m => {
        const toplamBorc = m.borclar ? m.borclar.reduce((acc, curr) => acc + parseFloat(curr.tutar), 0) : 0;
        const fullUrl = `${window.location.origin}${window.location.pathname}?id=${m.mesken_url}`;

        tbody.innerHTML += `
            <tr class="hover:bg-gray-800 border-b border-gray-700">
                <td class="p-3"><input type="checkbox" class="mesken-check accent-indigo-500" value="${m.dbId}"></td>
                <td class="p-3"><span class="bg-gray-700 px-2 py-1 rounded font-bold text-white">${m.kod}</span></td>
                <td class="p-3 text-gray-300">${m.sakin_adi}</td>
                <td class="p-3">
                    ${toplamBorc > 0
                    ? `<div class="flex items-center gap-2">
                         <span class="text-red-400 font-bold">-${toplamBorc} ₺</span> 
                         <button onclick="window.payDebt('${m.dbId}')" class="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition">Öde</button>
                       </div>`
                    : '<span class="text-green-400 flex items-center gap-1"><i class="fas fa-check-circle"></i> Temiz</span>'}
                </td>
                <td class="p-3">
                    <button onclick="navigator.clipboard.writeText('${fullUrl}'); alert('Link Kopyalandı!')" class="text-indigo-400 text-sm hover:text-indigo-300 transition"><i class="fas fa-link"></i> Link</button>
                </td>
                <td class="p-3 flex gap-2">
                    <button onclick="window.openEditMesken('${m.dbId}')" class="text-gray-500 hover:text-blue-500 transition" title="Düzenle">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button onclick="window.deleteMesken('${m.dbId}')" class="text-gray-500 hover:text-red-500 transition" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// --- TOPLU İŞLEMLER ---
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

const btnTopluBorc = document.getElementById('btnTopluBorc');
if(btnTopluBorc) {
    btnTopluBorc.addEventListener('click', async () => {
        const aciklama = document.getElementById('borcAciklama').value;
        const miktar = document.getElementById('borcMiktar').value;
        if (!aciklama || !miktar) return alert("Bilgileri giriniz");

        if (confirm("Tüm dairelere borç eklenecek. Onaylıyor musunuz?")) {
            // Promise.all kullanarak paralel işlem yapıyoruz (daha hızlı)
            await Promise.all(meskenListesi.map(m => addDebtToMesken(m.dbId, aciklama, miktar)));
            alert("İşlem tamam.");
            document.getElementById('borcAciklama').value = "";
            document.getElementById('borcMiktar').value = "";
        }
    });
}

const btnSeciliBorc = document.getElementById('btnSeciliBorc');
if(btnSeciliBorc) {
    btnSeciliBorc.addEventListener('click', async () => {
        const aciklama = document.getElementById('borcAciklama').value;
        const miktar = document.getElementById('borcMiktar').value;
        const selected = Array.from(document.querySelectorAll('.mesken-check:checked')).map(cb => cb.value);

        if (selected.length === 0) return alert("Daire seçmediniz.");
        if (!aciklama || !miktar) return alert("Bilgileri giriniz");

        await Promise.all(selected.map(dbId => addDebtToMesken(dbId, aciklama, miktar)));
        alert(`${selected.length} daireye borç eklendi.`);
        
        // Checkboxları temizle
        document.querySelectorAll('.mesken-check:checked').forEach(cb => cb.checked = false);
    });
}

// --- SAKİN GÖRÜNÜMÜ LOGIC (GÜVENLİ HALE GETİRİLDİ) ---
export async function loadResidentData(uniqueId) {
    // ARTIK SADECE İLGİLİ DAİREYİ ÇEKİYORUZ (Client-Side Filtering değil!)
    const q = query(collection(db, "meskenler"), where("mesken_url", "==", uniqueId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        // İlk bulunan dökümanı al
        const found = snapshot.docs[0].data();
        
        document.getElementById('resSakinAdi').innerText = found.sakin_adi;
        document.getElementById('resDaireNo').innerText = `Daire No: ${found.kod}`;

        const unpaidDiv = document.getElementById('resUnpaidList');
        unpaidDiv.innerHTML = '';
        
        if (found.borclar && found.borclar.length > 0) {
            found.borclar.forEach(b => {
                unpaidDiv.innerHTML += `
                    <div class="flex justify-between items-center bg-red-900/20 p-3 rounded border border-red-900/50 mb-2">
                        <div>
                            <div class="font-bold text-gray-200">${b.aciklama}</div>
                            <div class="text-xs text-gray-500">${b.tarih}</div>
                        </div>
                        <div class="font-bold text-red-400">${b.tutar} ₺</div>
                    </div>
                `;
            });
        } else {
             unpaidDiv.innerHTML = '<p class="text-gray-500 italic">Ödenmemiş borcunuz bulunmamaktadır.</p>';
        }

        const historyBody = document.getElementById('resHistoryBody');
        historyBody.innerHTML = '';
        if(found.odemeler) {
            found.odemeler.reverse().forEach(o => {
                historyBody.innerHTML += `
                    <tr class="border-b border-gray-700">
                        <td class="p-2 text-gray-400">${o.odeme_tarihi}</td>
                        <td class="p-2 text-gray-300">${o.aciklama}</td>
                        <td class="p-2 text-right font-bold text-gray-300">${o.tutar} ₺</td>
                    </tr>
                `;
            });
        }
        
        // Gösterme işlemi app-state tarafından yönetiliyor ama burada çağırmamıza gerek yok,
        // app-state zaten authBus dinleyip showView çağırıyor.
    } else {
        alert("Geçersiz veya silinmiş daire linki!");
        // Login ekranına yönlendirilebilir
    }
}