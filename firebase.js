import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, onSnapshot, setDoc, updateDoc,
  deleteDoc, increment, runTransaction, arrayUnion, arrayRemove,
} from "firebase/firestore";

// 1. Go to https://console.firebase.google.com
// 2. Create a free project (no credit card needed)
// 3. Inside the project: Build > Firestore Database > Create database (start in "test mode" for now)
// 4. Project settings (gear icon) > Your apps > Add app > Web (</>) > copy the config below
const firebaseConfig = {
  apiKey: "AIzaSyCcppsuSknpMCuMvhsIqPgkjaNsB4-Ifxk",
  authDomain: "scsproject-6d469.firebaseapp.com",
  projectId: "scsproject-6d469",
  storageBucket: "scsproject-6d469.firebasestorage.app",
  messagingSenderId: "251550778528",
  appId: "1:251550778528:web:a7c74a96d68ce32e76f5c5",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Each entity lives in its own collection with its own document per record.
// This means an admin adding a product and a member registering at the same
// time never overwrite each other's data (the old single-document design did).
// onSnapshot keeps every connected browser live-updated automatically.

function subscribe(collectionName, callback) {
  const ref = collection(db, collectionName);
  return onSnapshot(
    ref,
    (snap) => {
      const rows = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
      callback(rows);
    },
    (err) => console.error(`Failed to sync ${collectionName}:`, err)
  );
}

// ---- products ----
export const subscribeProducts = (cb) => subscribe("products", cb);
export const addProductDoc = (p) => setDoc(doc(db, "products", p.id), p);
export const updateProductDoc = (id, data) => updateDoc(doc(db, "products", id), data);
export const deleteProductDoc = (id) => deleteDoc(doc(db, "products", id));

// ---- users (doc id = username, so it's unique automatically) ----
export const subscribeUsers = (cb) => subscribe("users", cb);
export const addUserDoc = (u) => setDoc(doc(db, "users", u.username), u);
export const updateUserDoc = (username, data) => updateDoc(doc(db, "users", username), data);
// Atomically add/subtract wallet balance and points without needing to know
// the current value first — this is what prevents the "double points" and
// "changes get overwritten" bugs.
export const creditUserWallet = (username, walletDelta, pointsDelta) =>
  updateDoc(doc(db, "users", username), {
    walletBalance: increment(walletDelta),
    points: increment(pointsDelta),
  });

// Adds to the member's lifetime withdrawn total (only called once a
// withdrawal is actually marked "paid" — not at request time).
export const addToTotalEarning = (username, amount) =>
  updateDoc(doc(db, "users", username), { totalEarning: increment(amount) });

// Records that a member has reached a new rank, queues its gift for
// claiming, and stores the announcement so the admin panel can show the
// same congratulations card.
export const setUserRankProgress = (username, rankIndex, newGiftIndices, rankInfo) => {
  const updates = {
    rankIndex,
    lastRankUp: { ...rankInfo, date: new Date().toISOString() },
  };
  if (newGiftIndices.length) updates.unclaimedGifts = arrayUnion(...newGiftIndices);
  return updateDoc(doc(db, "users", username), updates);
};

// Claims one rank's gift: removes it from the pending list and, for cash
// gifts, credits the amount straight to cashback (wallet balance).
export const claimGiftDoc = (username, rankIndex, cashAmount) => {
  const updates = { unclaimedGifts: arrayRemove(rankIndex) };
  if (typeof cashAmount === "number") updates.walletBalance = increment(cashAmount);
  return updateDoc(doc(db, "users", username), updates);
};

// ---- orders ----
export const subscribeOrders = (cb) => subscribe("orders", cb);
export const addOrderDoc = (o) => setDoc(doc(db, "orders", o.id), o);
export const updateOrderDoc = (id, data) => updateDoc(doc(db, "orders", id), data);

// ---- withdrawals ----
export const subscribeWithdrawals = (cb) => subscribe("withdrawals", cb);
export const addWithdrawalDoc = (w) => setDoc(doc(db, "withdrawals", w.id), w);
export const updateWithdrawalDoc = (id, data) => updateDoc(doc(db, "withdrawals", id), data);

// ---- member ID counter (transaction-safe so two people registering at the
// exact same second never get the same ID) ----
export async function getNextMemberId() {
  const counterRef = doc(db, "counters", "members");
  const memberId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().next : 100001;
    tx.set(counterRef, { next: current + 1 }, { merge: true });
    return `SCS-${current}`;
  });
  return memberId;
}
