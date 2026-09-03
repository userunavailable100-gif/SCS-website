import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCcppsuSknpMCuMvhsIqPgkjaNsB4-Ifxk",
  authDomain: "scsproject-6d469.firebaseapp.com",
  projectId: "scsproject-6d469",
  storageBucket: "scsproject-6d469.firebasestorage.app",
  messagingSenderId: "251550778528",
  appId: "1:251550778528:web:a7c74a96d68ce32e76f5c5",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STATE_DOC = doc(db, "scs", "platform-state");

export async function loadPlatformState() {
  const snap = await getDoc(STATE_DOC);
  return snap.exists() ? snap.data().value : null;
}

export async function savePlatformState(jsonString) {
  await setDoc(STATE_DOC, { value: jsonString, updatedAt: new Date().toISOString() });
}
