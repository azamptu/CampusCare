
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";


const firebaseConfig = {
    apiKey: "AIzaSyBh1M8xkHC4vHnW1NVJXeAIJAeO6pOb-pM",
    authDomain: "campuscare-97013.firebaseapp.com",
    projectId: "campuscare-97013",
    storageBucket: "campuscare-97013.firebasestorage.app",
    messagingSenderId: "345965860464",
    appId: "1:345965860464:web:de7c20b5849f8a2f2cc6b5"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Firestore Database
export const db = getFirestore(app);


// Firebase Authentication
export const auth = getAuth(app);


console.log("CampusCare Firebase Connected!");
console.log("Firebase Authentication Ready!");
