import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDczXJs-kXBXTFLHLWdtoXNejUzAKX2sq8",
  authDomain: "resqnet-ba073.firebaseapp.com",
  projectId: "resqnet-ba073",
  storageBucket: "resqnet-ba073.firebasestorage.app",
  messagingSenderId: "119925068876",
  appId: "1:119925068876:web:bb2152a0f6716cef66d0e9",
  measurementId: "G-L1WZ0KMN5P"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);