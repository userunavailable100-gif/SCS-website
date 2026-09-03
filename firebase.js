import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// 1. Go to https://console.firebase.google.com
// 2. Create a free project (no credit card needed)
// 3. Inside the project: Build > Firestore Database > Create database (start in "test mode" for now)
// 4. Project settings (gear icon) > Your apps > Add app > Web (</>) > copy the config below
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// The whole SCS platform (users, products, orders, withdrawals) is stored
// as one JSON document. This keeps things simple for a first launch.
const STATE_DOC = doc(db, "scs", "platform-state");

export async function loadPlatformState() {
  const snap = await getDoc(STATE_DOC);
  return snap.exists() ? snap.data().value : null;
}

export async function savePlatformState(jsonString) {
  await setDoc(STATE_DOC, { value: jsonString, updatedAt: new Date().toISOString() });
}
