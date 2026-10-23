import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: "AIzaSyBlyb3o63189CjKU_SDwUTsg6Rl2mjDQho",
  authDomain: "yapcord.firebaseapp.com",
  databaseURL: "https://yapcord-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "yapcord",
  storageBucket: "yapcord.firebasestorage.app",
  messagingSenderId: "771117778879",
  appId: "1:771117778879:web:7b83d39ca4ee437e44430a",
  measurementId: "G-E2XV3CDJNM"
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Realtime Database ONLY (No Firestore)
export const rtdb = getDatabase(app, firebaseConfig.databaseURL);
