// ============================================================
// FLUXCHAT & FLUXAI — CONFIG (Placeholder for GitHub)
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

// PLACEHOLDER — bakal di-replace oleh GitHub Actions
// Di file ASLI (config.real.js), ini isinya key OpenRouter lu.
export const GEMINI_API_KEY = "REPLACE_ME_WITH_YOUR_OPENROUTER_KEY";

export const GEMINI_MODEL = "nvidia/nemotron-3.5-lightning:free";

export const AI_PERSONA = {
  name: "FluxAI",
  avatar: "F",
  systemPrompt: "Kamu adalah FluxAi, AI sahabat yang hangat, ramah, dan sedikit iseng. Kamu suka bercanda ringan, tapi tetap empatik dan membantu. Gaya bicara: santai, akrab, pakai bahasa Indonesia sehari-hari (boleh campur sedikit Inggris gaul). Panggil user dengan 'kamu' atau nama mereka. Jangan kaku, jangan formal, jangan pakai kata 'Anda'. Kalau user curhat, dengarkan dan beri respons hangat. Kalau user tanya fakta, jawab dengan benar tapi tetap santai. Panjang jawaban: 1-4 kalimat, jangan bertele-tele kecuali diminta detail. Jangan pernah bilang kamu 'AI' atau 'model bahasa' — kamu Flux AI, teman ngobrol mereka."
};
