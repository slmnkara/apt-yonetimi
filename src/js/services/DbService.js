import { db, auth } from "../firebase-config.js";
import { 
    collection, doc, addDoc, getDoc, updateDoc, 
    onSnapshot, runTransaction, serverTimestamp, setDoc,
    query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { eventBus } from "../core/EventManager.js";

class DbService {
    constructor() {
        this.unsubKasa = null;
        this.unsubMeskenler = null;
    }

    getUserPath() {
        if (!auth.currentUser) throw new Error("Giriş yapılmadı!");
        return `yoneticiler/${auth.currentUser.uid}`;
    }

    listenData() {
        if (!auth.currentUser) return;
        const userPath = this.getUserPath();

        // 1. Kasa Bakiyesi
        this.unsubKasa = onSnapshot(doc(db, `${userPath}/kasa/ana_kasa`), (docSnap) => {
            if (docSnap.exists()) {
                eventBus.publish('BALANCE_UPDATED', docSnap.data().toplam_bakiye || 0);
            } else {
                setDoc(doc(db, `${userPath}/kasa/ana_kasa`), { toplam_bakiye: 0 });
            }
        });

        // 2. Kasa Hareketleri
        onSnapshot(collection(db, `${userPath}/kasa/ana_kasa/hareketler`), (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            list.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            eventBus.publish('TRANSACTIONS_UPDATED', list);
        });

        // 3. Meskenler (EKLENDİ)
        this.unsubMeskenler = onSnapshot(collection(db, `${userPath}/meskenler`), (snap) => {
            const list = [];
            snap.forEach(d => list.push({ dbId: d.id, ...d.data() }));
            // Daire numarasına göre sırala
            list.sort((a,b) => parseInt(a.kod) - parseInt(b.kod));
            eventBus.publish('RESIDENTS_UPDATED', list);
        });
    }

    // Daire Ekleme Fonksiyonu
    async addResident(ad, no) {
        const userPath = this.getUserPath();
        const uniqueUrl = Math.random().toString(36).substring(2, 12); // Kısa link için
        await addDoc(collection(db, `${userPath}/meskenler`), {
            sakin_adi: ad,
            kod: no,
            mesken_url: uniqueUrl,
            borclar: [],
            odemeler: []
        });
    }

    // Sakin Güncelleme
    async updateResident(dbId, newData) {
        const userPath = this.getUserPath();
        await updateDoc(doc(db, `${userPath}/meskenler`, dbId), newData);
    }

    // SAKİN GÖRÜNÜMÜ İÇİN VERİ ÇEKME (Collection Group Query)
    async getResidentByUrl(uniqueUrl) {
        // 'meskenler' adındaki TÜM alt koleksiyonlarda arama yapar
        const { collectionGroup, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const meskenlerQuery = query(collectionGroup(db, 'meskenler'), where('mesken_url', '==', uniqueUrl));
        const snapshot = await getDocs(meskenlerQuery);

        if (snapshot.empty) return null;

        // İlk eşleşen dökümanı döndür
        const docData = snapshot.docs[0].data();
        return { id: snapshot.docs[0].id, ...docData };
    }

    listenTransactions() {
        if (!auth.currentUser) return;
        const userPath = this.getUserPath();
        const transactionsRef = collection(db, `${userPath}/kasa/ana_kasa/hareketler`);
        
        // SORGULAMA: Tarihe göre tersten sırala ve sadece son 20 taneyi al
        const q = query(transactionsRef, orderBy("timestamp", "desc"), limit(20)); // <--- DEĞİŞİKLİK BURADA

        onSnapshot(q, (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            // Frontend'de tekrar sıralamaya gerek kalmadı, sorgu sıralı geliyor
            eventBus.publish('TRANSACTIONS_UPDATED', list);
        });
    }

    // Tarih aralığına göre rapor verisi çekme (ON-DEMAND)
    async getTransactionsByDate(startStr, endStr) {
        // startStr: "2023-10-01", endStr: "2023-10-31"
        const { getDocs, query, where, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const userPath = this.getUserPath();
        const transactionsRef = collection(db, `${userPath}/kasa/ana_kasa/hareketler`);

        // String tarihleri Firestore formatına uygun karşılaştırmak zor olabilir.
        // En sağlıklısı: Client tarafında filtrelemektir (Eğer veri aşırı büyük değilse).
        // Veya "tarih" alanını string olarak "YYYY-MM-DD" formatında da saklamalıydık.
        // Mevcut yapıda "DD.MM.YYYY" saklıyoruz, bu sorgulanamaz.
        // Çözüm: Tüm hareketleri çekip JS ile filtrelemek (şimdilik en kolayı).
        
        const snap = await getDocs(query(transactionsRef, orderBy("timestamp", "desc")));
        
        const startDate = new Date(startStr); startDate.setHours(0,0,0,0);
        const endDate = new Date(endStr); endDate.setHours(23,59,59,999);

        const list = [];
        snap.forEach(d => {
            const data = d.data();
            // Tarih parse et (DD.MM.YYYY -> Date Object)
            const parts = data.tarih.split('.');
            const hDate = new Date(parts[2], parts[1]-1, parts[0]);
            
            if (hDate >= startDate && hDate <= endDate) {
                list.push(data);
            }
        });
        return list;
    }

    // Daire Silme
    async deleteResident(dbId) {
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const userPath = this.getUserPath();
        await deleteDoc(doc(db, `${userPath}/meskenler`, dbId));
    }
}

export const dbService = new DbService();