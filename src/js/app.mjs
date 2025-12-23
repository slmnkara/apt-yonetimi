import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.mjs";
import { globalKasaHareketler, meskenListesi } from "./app-db.mjs"; 

// --- UI YARDIMCILARI ---
window.openModal = (id) => document.getElementById(id).classList.remove('hidden-view');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden-view');

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

// Ödeme Al (Borcu sil, ödemelere ekle, kasaya ekle)
// --- DOSYA: src/js/app.mjs ---
window.payDebt = async (dbId) => {
    const m = meskenListesi.find(x => x.dbId === dbId);
    
    if (!m || !m.borclar || m.borclar.length === 0) {
        alert("Ödenecek borç bulunamadı.");
        return;
    }

    const toplamTutar = m.borclar.reduce((acc, c) => acc + parseFloat(c.tutar), 0);

    // --- YENİ EKLENEN KISIM BAŞLANGIÇ ---
    // Borçların açıklamalarını toplayıp virgülle birleştiriyoruz
    // Örnek Çıktı: "Ocak Aidat, Demirbaş, Yakıt"
    const aciklamalar = m.borclar.map(b => b.aciklama).join(', ');
    // --- YENİ EKLENEN KISIM BİTİŞ ---

    if (!confirm(`${m.sakin_adi} için ${toplamTutar} TL tahsilat yapılacak. Onaylıyor musunuz?`)) return;

    const ref = doc(db, "meskenler", dbId);
    const kasaRef = doc(db, "kasa", "ana_kasa");

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
                // ESKİSİ: aciklama: `${m.kod} nolu daire aidat ödemesi`,
                // YENİSİ: Dinamik açıklama
                aciklama: `Daire ${m.kod}: ${aciklamalar} Tahsilatı`, 
                tutar: toplamTutar,
                tarih: new Date().toLocaleDateString('tr-TR')
            })
        });
        
        alert("Ödeme başarıyla alındı.");
    } catch (err) {
        console.error(err);
        alert("Ödeme sırasında hata: " + err.message);
    }
};

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