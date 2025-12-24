import { db, auth } from "../firebase-config.js";
import { doc, runTransaction, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class PayDebtCommand {
    /**
     * @param {string} residentId - Dairenin ID'si
     * @param {Object} debtObject - Ödenen borç objesi (id, tutar, aciklama vs.)
     */
    constructor(residentId, debtObject) {
        this.residentId = residentId;
        this.debtObject = debtObject;
        this.safeTransactionId = null; // Kasa hareketi ID'sini saklayacağız
    }

    // TAHSİLAT YAP
    async execute() {
        const userId = auth.currentUser.uid;
        const residentRef = doc(db, `yoneticiler/${userId}/meskenler`, this.residentId);
        const safeRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);
        const safeHistoryRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`, "temp_ref"); // Referans için

        // Bu işlem atomik olmalı (Ya hepsi olur ya hiçbiri)
        await runTransaction(db, async (transaction) => {
            // 1. Sakin ve Kasa verisini oku
            const resDoc = await transaction.get(residentRef);
            const safeDoc = await transaction.get(safeRef);
            
            if (!resDoc.exists()) throw new Error("Sakin bulunamadı");
            
            // 2. Borç Kontrolü
            const borclar = resDoc.data().borclar || [];
            // ID'ye göre borcu bul (Objeler referans olarak farklı olabilir, ID ile bulmak en garantisi)
            const targetDebt = borclar.find(b => b.id === this.debtObject.id);
            if (!targetDebt) throw new Error("Bu borç zaten ödenmiş veya silinmiş.");

            // 3. ÖDEME OBJESİ HAZIRLA
            const paymentObj = {
                ...targetDebt,
                odeme_tarihi: new Date().toLocaleDateString('tr-TR'),
                islem_id: Date.now() // Unique ID
            };

            // 4. KASA HAREKETİ HAZIRLA
            const newSafeBalance = (safeDoc.data()?.toplam_bakiye || 0) + parseFloat(targetDebt.tutar);
            
            // Transaction içinde yeni döküman referansı oluştur
            // Not: JS SDK'da transaction içinde collection().doc() çalışır.
            // Ama burada manuel ID üretip set etmek daha kolay.
            const safeTxId = "tx_" + Date.now();
            this.safeTransactionId = safeTxId;
            const newTxRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`, safeTxId);

            // --- YAZMA İŞLEMLERİ ---
            
            // A) Sakinden borcu sil, ödemelere ekle
            transaction.update(residentRef, {
                borclar: arrayRemove(targetDebt),
                odemeler: arrayUnion(paymentObj)
            });

            // B) Kasayı güncelle
            transaction.update(safeRef, { toplam_bakiye: newSafeBalance });

            // C) Kasa hareketini kaydet
            transaction.set(newTxRef, {
                tur: 'gelir',
                aciklama: `TAHSİLAT: ${resDoc.data().kod} - ${targetDebt.aciklama}`,
                tutar: parseFloat(targetDebt.tutar),
                tarih: new Date().toLocaleDateString('tr-TR'),
                timestamp: serverTimestamp(),
                is_correction: false,
                related_debt_id: targetDebt.id
            });
        });
    }

    // İŞLEMİ GERİ AL (YANLIŞLIKLA ÖDENDİ İŞARETLENDİYSE)
    async undo() {
        const userId = auth.currentUser.uid;
        const residentRef = doc(db, `yoneticiler/${userId}/meskenler`, this.residentId);
        const safeRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);
        const safeTxRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`, this.safeTransactionId);

        await runTransaction(db, async (transaction) => {
            const resDoc = await transaction.get(residentRef);
            const safeDoc = await transaction.get(safeRef);

            // Ödemeyi bul (Geri almak için)
            const odemeler = resDoc.data().odemeler || [];
            // Borç ID'si eşleşen ödemeyi bul
            const targetPayment = odemeler.find(p => p.id === this.debtObject.id);
            
            if (!targetPayment) throw new Error("Geri alınacak ödeme bulunamadı.");

            // Kasa Bakiyesi Düzelt
            const newSafeBalance = (safeDoc.data()?.toplam_bakiye || 0) - parseFloat(this.debtObject.tutar);

            // --- YAZMA İŞLEMLERİ ---

            // A) Ödemeyi sil, borcu geri koy
            transaction.update(residentRef, {
                odemeler: arrayRemove(targetPayment),
                borclar: arrayUnion(this.debtObject)
            });

            // B) Kasayı düşür
            transaction.update(safeRef, { toplam_bakiye: newSafeBalance });

            // C) Kasa hareketine İPTAL notu düş (Silmek yerine güncellemek muhasebe için daha iyidir)
            // Ama CommandManager mantığında "Undo" işlemi kaydı yok etmeli veya ters kayıt atmalı. 
            // Burada basitlik adına kasa hareketini SİLİYORUZ.
            transaction.delete(safeTxRef);
        });
    }
}