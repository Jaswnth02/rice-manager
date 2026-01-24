import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyDww2ybSU8eU_FPyuhP--Nt3pPir6W8PMY",
    authDomain: "rice-manager.firebaseapp.com",
    projectId: "rice-manager",
    storageBucket: "rice-manager.firebasestorage.app",
    messagingSenderId: "294174167230",
    appId: "1:294174167230:web:b3acf00a988bbf204d8eef",
    measurementId: "G-BZ0BS10NBJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
