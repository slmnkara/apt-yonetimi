import { db, auth } from "../firebase-config.js";
import { doc, collection, addDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class TransactionCommand {
    /**
     * @param {Object} payload { tur: 'gelir'|'gider', aciklama: '...', tutar: 100 }
     */
    constructor(payload) {
        this.payload = payload;
        this.createdDocId = null; // İşlem yapıldığında oluşan ID
    }

    // 1. İŞLEMİ YAP
    async execute() {
        const userId = auth.currentUser.uid;
        const kasaRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);
        const hareketlerRef = collection(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`);

        await runTransaction(db, async (transaction) => {
            // A) Güncel bakiyeyi oku
            const kasaDoc = await transaction.get(kasaRef);
            if (!kasaDoc.exists()) throw "Kasa bulunamadı!";
            
            const currentBalance = kasaDoc.data().toplam_bakiye || 0;
            const amount = parseFloat(this.payload.tutar);

            // B) Yeni bakiyeyi hesapla
            let newBalance = currentBalance;
            if (this.payload.tur === 'gelir') newBalance += amount;
            else newBalance -= amount;

            // C) Bakiyeyi güncelle
            transaction.update(kasaRef, { toplam_bakiye: newBalance });

            // D) Hareketi YENİ BİR DOKÜMAN olarak ekle (Array değil!)
            // Not: Transaction içinde addDoc doğrudan çalışmaz, referans alırız.
            const newDocRef = doc(hareketlerRef); 
            this.createdDocId = newDocRef.id; // ID'yi sakla (belki lazım olur)

            transaction.set(newDocRef, {
                tur: this.payload.tur,
                aciklama: this.payload.aciklama,
                tutar: amount,
                tarih: new Date().toLocaleDateString('tr-TR'),
                timestamp: serverTimestamp(), // Sıralama için
                is_correction: false // Bu normal bir işlem
            });
        });
    }

    // 2. İŞLEMİ GERİ AL (UNDO - MUHASEBE USULÜ)
    async undo() {
        const userId = auth.currentUser.uid;
        const kasaRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);
        const hareketlerRef = collection(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`);

        // TERS İŞLEM MANTIĞI:
        // Eğer orijinal işlem GELİR ise, GİDER (Ters Kayıt) ekleriz.
        // Eğer orijinal işlem GİDER ise, GELİR (Ters Kayıt) ekleriz.
        
        const reverseType = this.payload.tur === 'gelir' ? 'gider' : 'gelir';
        const correctionDesc = `DÜZELTME: ${this.payload.aciklama}`; // Açıklamaya not düş
        const amount = parseFloat(this.payload.tutar);

        await runTransaction(db, async (transaction) => {
            // A) Bakiyeyi oku
            const kasaDoc = await transaction.get(kasaRef);
            const currentBalance = kasaDoc.data().toplam_bakiye || 0;

            // B) TERS bakiyeyi hesapla
            let newBalance = currentBalance;
            if (reverseType === 'gelir') newBalance += amount;
            else newBalance -= amount;

            // C) Bakiyeyi güncelle
            transaction.update(kasaRef, { toplam_bakiye: newBalance });

            // D) TERS KAYIT (Contra Entry) ekle
            const undoDocRef = doc(hareketlerRef);
            transaction.set(undoDocRef, {
                tur: reverseType,
                aciklama: correctionDesc,
                tutar: amount,
                tarih: new Date().toLocaleDateString('tr-TR'),
                timestamp: serverTimestamp(),
                is_correction: true, // Bunun bir düzeltme olduğunu belirtiyoruz
                original_ref: this.createdDocId // Hangi işlemi düzelttiğini referans gösteriyoruz (Audit Log için mükemmel)
            });
        });
    }
}