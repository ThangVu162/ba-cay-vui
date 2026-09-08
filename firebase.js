import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, onValue, ref, runTransaction, set } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export const isFirebaseConfigured = Boolean(firebaseConfig?.apiKey && firebaseConfig?.databaseURL);
export const db = isFirebaseConfigured ? getDatabase(initializeApp(firebaseConfig)) : null;
export { onValue, ref, runTransaction, set };
