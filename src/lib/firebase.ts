import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBJZuqiCP19k0eE57wu5s0JZn04Y0R9hBw",
  authDomain: "roomix-2f734.firebaseapp.com",
  projectId: "roomix-2f734",
  storageBucket: "roomix-2f734.firebasestorage.app",
  messagingSenderId: "857963052155",
  appId: "1:857963052155:web:ef7390c7da4cb47788f6de",
  measurementId: "G-V4BEJRSF6F"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
