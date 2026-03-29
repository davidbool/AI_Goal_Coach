import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? ""
};

const requiredFirebaseConfigEntries = [
  ["EXPO_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["EXPO_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", firebaseConfig.storageBucket],
  ["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", firebaseConfig.messagingSenderId],
  ["EXPO_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId]
];

let authInstance = null;

export function getMissingFirebaseConfig() {
  return requiredFirebaseConfigEntries
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => key);
}

export function isFirebaseConfigured() {
  return getMissingFirebaseConfig().length === 0;
}

export function getFirebaseApp() {
  const missingConfig = getMissingFirebaseConfig();

  if (missingConfig.length > 0) {
    throw new Error(
      `Firebase is not fully configured. Missing: ${missingConfig.join(", ")}. ` +
        "Add the Firebase Web App values to mobile/.env before using auth."
    );
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  if (authInstance) {
    return authInstance;
  }

  const app = getFirebaseApp();

  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    if (error?.code === "auth/already-initialized") {
      authInstance = getAuth(app);
    } else {
      throw error;
    }
  }

  return authInstance;
}
