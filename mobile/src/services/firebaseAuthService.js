import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import { getFirebaseAuth } from "./firebaseApp.js";

function toFirebaseAuthError(error) {
  switch (error?.code) {
    case "auth/operation-not-allowed":
      return new Error("Email/password sign-in is not enabled yet in Firebase Console.");
    case "auth/email-already-in-use":
      return new Error("An account with this email already exists. Try Sign in instead.");
    case "auth/invalid-email":
      return new Error("Enter a valid email address.");
    case "auth/weak-password":
      return new Error("Password must be at least 6 characters.");
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return new Error("Incorrect email or password.");
    case "auth/too-many-requests":
      return new Error("Too many sign-in attempts. Try again in a few minutes.");
    default:
      return error instanceof Error ? error : new Error("Firebase authentication failed.");
  }
}

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
  try {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw toFirebaseAuthError(error);
  }
}

export async function signInWithEmailPassword(email, password) {
  try {
    const auth = getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw toFirebaseAuthError(error);
  }
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
