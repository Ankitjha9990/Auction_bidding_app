import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCf_GcrjGsi8rMUX9k07PodHikkO7bL39Y",
  authDomain: "auction-app-bidding.firebaseapp.com",
  projectId: "auction-app-bidding",
  storageBucket: "auction-app-bidding.firebasestorage.app",
  messagingSenderId: "860602686192",
  appId: "1:860602686192:web:8caa9c20ffdd0beffb0035"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
