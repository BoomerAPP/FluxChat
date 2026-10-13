// ============================================================
// AINY MORC AI — AUTH
// ============================================================
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app } from "./config.js"; // Diperbaiki dari firebaseApp ke app agar sesuai config.js
import { saveUserProfile } from "./chat.js";

export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export async function registerUser(email, password, name) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await saveUserProfile(cred.user, name);
    return cred.user;
  } catch (err) {
    console.error("Register Error:", err);
    throw err;
  }
}

export async function loginUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await saveUserProfile(cred.user);
    return cred.user;
  } catch (err) {
    console.error("Login Error:", err);
    throw err;
  }
}

export async function loginWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(cred.user);
    return cred.user;
  } catch (err) {
    console.error("Google Login Error:", err);
    throw err;
  }
}

export async function logoutUser() {
  await signOut(auth);
}

export function watchAuth(callback) {
  onAuthStateChanged(auth, callback);
}

export function formatAuthError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "Email sudah terdaftar.";
  if (code.includes("invalid-email")) return "Format email tidak valid.";
  if (code.includes("weak-password")) return "Sandi terlalu lemah (minimal 6 karakter).";
  if (code.includes("user-not-found") || code.includes("invalid-credential")) return "Email atau sandi salah.";
  if (code.includes("wrong-password")) return "Sandi salah.";
  if (code.includes("network-request-failed")) return "Koneksi internet bermasalah.";
  return err.message || "Terjadi kesalahan autentikasi.";
}
