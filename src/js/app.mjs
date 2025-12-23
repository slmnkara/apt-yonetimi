import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.mjs";
import { globalKasaHareketler, meskenListesi } from "./app-db.mjs"; 

// --- UI YARDIMCILARI ---
window.openModal = (id) => document.getElementById(id).classList.remove('hidden-view');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden-view');

// --- MANUEL GELİR / GİDER EKLEME ---
window.saveKasaIslem = async () => {
    const type = document.getElementById('kasaType').value;
    const desc = document.getElementById('kasaDesc').value;
    const amountVal = document.getElementById('kasaAmount').value;

    if(!desc || !amountVal) return alert("Lütfen alanları doldurun.");

    const amount = parseFloat(amountVal);
    const kasaRef = doc(db, "kasa", "ana_kasa");
    
    try {
        const kasaDoc = await getDoc(kasaRef);
        let currentBalance = kasaDoc.exists() ? (kasaDoc.data().toplam_bakiye || 0) : 0;

        if (type === 'gelir') currentBalance += amount;
        else currentBalance -= amount;

        await updateDoc(kasaRef, {
            toplam_bakiye: currentBalance,
            hareketler: arrayUnion({
                id: Date.now(),
                tur: type,
                aciklama: desc,
                tutar: amount,
                tarih: new Date().toLocaleDateString('tr-TR')
            })
        });
        
        window.closeModal('modalIncome');
        document.getElementById('kasaDesc').value = "";
        document.getElementById('kasaAmount').value = "";
    } catch (error) {
        console.error("Kasa hatası:", error);
        alert("İşlem sırasında bir hata oluştu: " + error.message);
    }
};

// --- RAPORLAMA ---
window.printKasaReport = () => {
    const startVal = document.getElementById('reportStartDate').value;
    const endVal = document.getElementById('reportEndDate').value;

    if (!startVal || !endVal) {
        alert("Lütfen başlangıç ve bitiş tarihlerini seçiniz.");
        return;
    }

    const startDate = new Date(startVal);
    const endDate = new Date(endVal);
    
    const filtered = globalKasaHareketler.filter(h => {
        const parts = h.tarih.split('.');
        const hDate = new Date(parts[2], parts[1] - 1, parts[0]); 
        
        hDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        return hDate >= startDate && hDate <= endDate;
    });

    if (filtered.length === 0) {
        alert("Seçilen tarih aralığında kayıt bulunamadı.");
        return;
    }

    let toplamGelir = 0;
    let toplamGider = 0;

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
        const tutar = parseFloat(item.tutar);
        if (item.tur === 'gelir') toplamGelir += tutar;
        else toplamGider += tutar;

        const rowColor = item.tur === 'gelir' ? 'text-green-700' : 'text-red-700';
        const turYazi = item.tur === 'gelir' ? 'GELİR' : 'GİDER';

        htmlContent += `
            <tr>
                <td class="border border-gray-300 p-2">${item.tarih}</td>
                <td class="border border-gray-300 p-2">${item.aciklama}</td>
                <td class="border border-gray-300 p-2 font-bold ${rowColor}">${turYazi}</td>
                <td class="border border-gray-300 p-2 text-right font-mono">${tutar} ₺</td>
            </tr>
        `;
    });

    htmlContent += `
            </tbody>
        </table>
        <div class="mt-6 flex justify-end">
            <table class="w-1/2 text-right border border-gray-300">
                <tr><td class="p-2 border-b">Toplam Gelir:</td><td class="p-2 border-b font-bold text-green-700">+${toplamGelir} ₺</td></tr>
                <tr><td class="p-2 border-b">Toplam Gider:</td><td class="p-2 border-b font-bold text-red-700">-${toplamGider} ₺</td></tr>
                <tr class="bg-gray-100"><td class="p-2 font-bold">Dönem Bakiyesi:</td><td class="p-2 font-bold text-blue-800">${toplamGelir - toplamGider} ₺</td></tr>
            </table>
        </div>
    `;

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = htmlContent;
    window.print();
};

// --- BORÇ ÖDEME (GÜNCELLENDİ: METADATA EKLENDİ) ---
window.payDebt = async (dbId) => {
    const m = meskenListesi.find(x => x.dbId === dbId);
    
    if (!m || !m.borclar || m.borclar.length === 0) {
        alert("Ödenecek borç bulunamadı.");
        return;
    }

    const toplamTutar = m.borclar.reduce((acc, c) => acc + parseFloat(c.tutar), 0);
    const aciklamalar = m.borclar.map(b => b.aciklama).join(', ');

    if (!confirm(`${m.sakin_adi} için ${toplamTutar} TL tahsilat yapılacak. Onaylıyor musunuz?`)) return;

    const ref = doc(db, "meskenler", dbId);
    const kasaRef = doc(db, "kasa", "ana_kasa");

    // Borçları ödemeler listesine taşırken tarih ekliyoruz
    const yeniOdemeler = m.borclar.map(b => ({
        ...b,
        odeme_tarihi: new Date().toLocaleDateString('tr-TR')
    }));

    try {
        // 1. Mesken Güncelle (Borçları sil, ödemelere ekle)
        await updateDoc(ref, {
            borclar: [], 
            odemeler: arrayUnion(...yeniOdemeler)
        });

        // 2. Kasayı Güncelle
        const kasaDoc = await getDoc(kasaRef);
        let mevcutBakiye = kasaDoc.exists() ? (kasaDoc.data().toplam_bakiye || 0) : 0;
        
        await updateDoc(kasaRef, {
            toplam_bakiye: mevcutBakiye + toplamTutar,
            hareketler: arrayUnion({
                id: Date.now(),
                tur: 'gelir',
                aciklama: `${m.kod}: ${aciklamalar} Tahsilatı`, 
                tutar: toplamTutar,
                tarih: new Date().toLocaleDateString('tr-TR'),
                // --- İZ BIRAKMA (METADATA) ---
                meta: {
                    tip: 'aidat_tahsilati',
                    sakinId: dbId,
                    silinenBorclar: m.borclar,     // Geri yükleme için
                    eklenenOdemeler: yeniOdemeler  // Silme için
                }
            })
        });
        
        alert("Ödeme başarıyla alındı.");
    } catch (err) {
        console.error(err);
        alert("Ödeme sırasında hata: " + err.message);
    }
};

// --- DAİRE SİLME ---
window.deleteMesken = async (dbId) => {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    if (confirm("Bu daire kalıcı olarak silinecek. Onaylıyor musunuz?")) {
        try {
            await deleteDoc(doc(db, "meskenler", dbId));
            alert("Daire silindi.");
        } catch (err) {
            alert("Silme hatası: " + err.message);
        }
    }
};

// --- HAREKETİ GERİ AL / SİL (YENİ ÖZELLİK) ---
window.deleteKasaHareket = async (hareketId) => {
    const id = String(hareketId);

    if (!confirm("Bu işlemi geri almak (silmek) istediğinize emin misiniz?")) {
        return;
    }

    const kasaRef = doc(db, "kasa", "ana_kasa");

    try {
        // 1. Kasa verisini çek
        const docSnap = await getDoc(kasaRef);
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const hareketler = data.hareketler || [];
        const targetItem = hareketler.find(h => String(h.id) === id);

        if (!targetItem) {
            alert("İşlem bulunamadı veya daha önce silinmiş.");
            return;
        }

        // --- BORÇLARI GERİ YÜKLEME MANTIĞI ---
        if (targetItem.meta && targetItem.meta.tip === 'aidat_tahsilati') {
            const sakinId = targetItem.meta.sakinId;
            const eskiBorclar = targetItem.meta.silinenBorclar;
            const eklenenOdemeler = targetItem.meta.eklenenOdemeler;

            const sakinRef = doc(db, "meskenler", sakinId);
            const sakinSnap = await getDoc(sakinRef);
            
            if (sakinSnap.exists()) {
                const sakinData = sakinSnap.data();
                
                // A) Borçları geri yükle
                const guncelBorclar = sakinData.borclar || [];
                const restoreEdilmisBorclar = [...guncelBorclar, ...eskiBorclar];

                // B) Ödeme geçmişinden sil
                const guncelOdemeler = sakinData.odemeler || [];
                const silinecekOdemeIdleri = eklenenOdemeler.map(x => x.id);
                
                const temizlenmisOdemeler = guncelOdemeler.filter(odeme => 
                    !silinecekOdemeIdleri.includes(odeme.id)
                );

                await updateDoc(sakinRef, {
                    borclar: restoreEdilmisBorclar,
                    odemeler: temizlenmisOdemeler
                });
                console.log("Borçlar ve ödeme geçmişi geri alındı.");
            } else {
                alert("Uyarı: İlgili daire veritabanında bulunamadı, sadece kasa düzeltilecek.");
            }
        }

        // 2. Kasa Bakiyesini Düzelt
        let yeniBakiye = parseFloat(data.toplam_bakiye);
        const tutar = parseFloat(targetItem.tutar);

        if (targetItem.tur === 'gelir') {
            yeniBakiye -= tutar; // Gelir siliniyorsa düş
        } else {
            yeniBakiye += tutar; // Gider siliniyorsa ekle
        }

        // 3. Listeden Çıkar ve Kaydet
        const yeniHareketler = hareketler.filter(h => String(h.id) !== id);

        await updateDoc(kasaRef, {
            toplam_bakiye: yeniBakiye,
            hareketler: yeniHareketler
        });

        alert("İşlem başarıyla geri alındı.");

    } catch (error) {
        console.error("Silme hatası:", error);
        alert("Bir hata oluştu: " + error.message);
    }
};

// DOSYA: src/js/app.mjs (Dosyanın en altına veya uygun bir yere ekleyin)

// --- SAKİN DÜZENLEME & BORÇ SİLME ---

// 1. Modalı Aç ve Verileri Doldur
window.openEditMesken = (dbId) => {
    const m = meskenListesi.find(x => x.dbId === dbId);
    if (!m) return;

    // Formu doldur
    document.getElementById('editMeskenId').value = dbId;
    document.getElementById('editSakinAdi').value = m.sakin_adi;
    document.getElementById('editDaireNo').value = m.kod;

    // Borç listesini doldur
    renderEditBorcList(m);

    window.openModal('modalEditMesken');
};

// Yardımcı Fonksiyon: Modal içindeki borç listesini çiz
function renderEditBorcList(meskenData) {
    const listDiv = document.getElementById('editBorcList');
    listDiv.innerHTML = '';

    if (!meskenData.borclar || meskenData.borclar.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500 text-sm italic">Kayıtlı borç yok.</p>';
        return;
    }

    meskenData.borclar.forEach(borc => {
        listDiv.innerHTML += `
            <div class="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700 text-sm">
                <div>
                    <div class="text-gray-300">${borc.aciklama}</div>
                    <div class="text-xs text-gray-500">${borc.tarih} - ${borc.tutar} ₺</div>
                </div>
                <button onclick="window.deleteSpecificDebt('${meskenData.dbId}', '${borc.id}')" 
                        class="text-red-400 hover:text-red-300 p-1" title="Borcu Sil">
                    <i class="fas fa-times-circle"></i>
                </button>
            </div>
        `;
    });
}

// 2. Sakin Bilgilerini Güncelle (İsim / Daire No)
window.saveMeskenEdit = async () => {
    const dbId = document.getElementById('editMeskenId').value;
    const yeniAd = document.getElementById('editSakinAdi').value;
    const yeniKod = document.getElementById('editDaireNo').value;

    if (!yeniAd || !yeniKod) return alert("Bilgiler boş olamaz.");

    try {
        const ref = doc(db, "meskenler", dbId);
        await updateDoc(ref, {
            sakin_adi: yeniAd,
            kod: yeniKod
        });
        alert("Bilgiler güncellendi.");
        window.closeModal('modalEditMesken');
    } catch (err) {
        console.error(err);
        alert("Güncelleme hatası: " + err.message);
    }
};

// 3. Tekil Borç Silme
window.deleteSpecificDebt = async (meskenId, borcId) => {
    if (!confirm("Bu borç kaydı silinecek. Emin misiniz?")) return;

    try {
        const ref = doc(db, "meskenler", meskenId);
        
        // Mevcut veriyi al (meskenListesi global değişkeninden hızlıca alıyoruz, 
        // ama güncel olduğundan emin olmak için snapshot zaten çalışıyor)
        const m = meskenListesi.find(x => x.dbId === meskenId);
        if(!m) return;

        // Silinecek borcu filtrele
        const yeniBorclar = m.borclar.filter(b => b.id !== borcId);

        // Firestore'a yaz
        await updateDoc(ref, {
            borclar: yeniBorclar
        });

        // Modaldaki listeyi anlık güncelle (kullanıcı kapattıp açmak zorunda kalmasın)
        // Not: updateDoc çalıştığında onSnapshot tetiklenir ve meskenListesi güncellenir.
        // Ancak biz UI'ı hemen güncellemek için manuel bir obje oluşturup listeyi yeniden çizdirebiliriz.
        const updatedMesken = { ...m, borclar: yeniBorclar };
        renderEditBorcList(updatedMesken);

    } catch (err) {
        console.error(err);
        alert("Borç silinemedi: " + err.message);
    }
};