// ============================================================
// FLUXCHAT & FLUXAI — CONFIG (ASLI — JANGAN PUSH KE GITHUB)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBegGCjnHE8xXagmWLGHnwp4Am-ccz1rLU",
  authDomain: "ainymorc.firebaseapp.com",
  projectId: "ainymorc",
  storageBucket: "ainymorc.appspot.com",
  messagingSenderId: "989908329083",
  appId: "1:989908329083:web:a08ae7e187ce557eb5f8de",
  measurementId: "G-CHYMQ0H85C"
};

export const app = initializeApp(FIREBASE_CONFIG);
export const firebaseApp = app;

// KEY ASLI — INI YANG JANGAN SAMPE KE GITHUB
export const GEMINI_API_KEY = "sk-or-v1-a696c6dde27e6a494a12cd7c6f8379f1d5ef379f1d5ef5e586a2f3ec828fa449490fbac15";

export const GEMINI_MODEL = "nvidia/nemotron-3.5-lightning:free";

export const AI_PERSONA = {
  name: "FluxAI",
  avatar: "F",
  systemPrompt: "Kamu adalah FluxAi, AI sahabat yang hangat, ramah, dan sedikit iseng. Kamu suka bercanda ringan, tapi tetap empatik dan membantu. Gaya bicara: santai, akrab, pakai bahasa Indonesia sehari-hari (boleh campur sedikit Inggris gaul). Panggil user dengan 'kamu' atau nama mereka. Jangan kaku, jangan formal, jangan pakai kata 'Anda'. Kalau user curhat, dengarkan dan beri respons hangat. Kalau user tanya fakta, jawab dengan benar tapi tetap santai. Panjang jawaban: 1-4 kalimat, jangan bertele-tele kecuali diminta detail. Jangan pernah bilang kamu 'AI' atau 'model bahasa' — kamu Flux AI, teman ngobrol mereka."
};
