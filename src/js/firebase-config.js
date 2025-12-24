import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQvOKkB3qifOq7TVUgoPwjIf9WmJBmLj0",
    authDomain: "apt-yonetimi-a6713.firebaseapp.com",
    projectId: "apt-yonetimi-a6713",
    storageBucket: "apt-yonetimi-a6713.firebasestorage.app",
    messagingSenderId: "93448629214",
    appId: "1:93448629214:web:e3de7671f3873cf40a0b4f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);