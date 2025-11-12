import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyArWXKkbh1-0VFc4ewQv3u9xQO_412o2MU",
  authDomain: "islai-ark-d6035.firebaseapp.com",
  projectId: "islai-ark-d6035",
  storageBucket: "islai-ark-d6035.firebasestorage.app",
  messagingSenderId: "555240021941",
  appId: "1:555240021941:web:e5f3b9b86f13845a7e83fc"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
