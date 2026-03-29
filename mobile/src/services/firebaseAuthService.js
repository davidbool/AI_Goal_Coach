import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import { getFirebaseAuth } from "./firebaseApp.js";

export async function waitForFirebaseAuthRestore() {
  const auth = getFirebaseAuth();

  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
    return auth.currentUser;
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject
    );
  });
}

export async function registerWithEmailAndPassword(email, password) {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithEmailPassword(email, password) {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOutFromFirebase() {
  await signOut(getFirebaseAuth());
}

export async function getCurrentFirebaseIdToken(forceRefresh = false) {
  const user = getFirebaseAuth().currentUser;

  if (!user) {
    throw new Error("No signed-in Firebase user is available.");
  }

  return user.getIdToken(forceRefresh);
}
