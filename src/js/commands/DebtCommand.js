import { db, auth } from "../firebase-config.js";
import { doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class DebtCommand {
    /**
     * @param {Array} targetIds - Borçlandırılacak dairelerin ID listesi (['id1', 'id2'])
     * @param {Object} debtData - { aciklama: "Mart Aidatı", tutar: 500 }
     */
    constructor(targetIds, debtData) {
        this.targetIds = targetIds;
        // Borç objesini burada oluşturuyoruz ki hem eklerken hem silerken AYNI referansı kullanalım.
        this.debtObject = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Unique ID
            tarih: new Date().toLocaleDateString('tr-TR'),
            aciklama: debtData.aciklama,
            tutar: parseFloat(debtData.tutar)
        };
    }

    // 1. BORÇ EKLE
    async execute() {
        const userId = auth.currentUser.uid;
        
        // Promise.all ile tüm dairelere paralel işlem yapıyoruz (Hızlıdır)
        const promises = this.targetIds.map(dbId => {
            const ref = doc(db, `yoneticiler/${userId}/meskenler`, dbId);
            return updateDoc(ref, {
                borclar: arrayUnion(this.debtObject)
            });
        });

        await Promise.all(promises);
    }

    // 2. BORCU GERİ AL (SİL)
    async undo() {
        const userId = auth.currentUser.uid;

        const promises = this.targetIds.map(dbId => {
            const ref = doc(db, `yoneticiler/${userId}/meskenler`, dbId);
            return updateDoc(ref, {
                // arrayRemove, objenin tamamen aynısıysa siler. 
                // Constructor'da this.debtObject oluşturduğumuz için aynısıdır.
                borclar: arrayRemove(this.debtObject) 
            });
        });

        await Promise.all(promises);
    }
}