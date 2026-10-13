// ============================================================
// FLUXAI — AI CLIENT (OpenRouter & Multimodal Support)
// ============================================================
import { GEMINI_API_KEY as OPENROUTER_KEY, GEMINI_MODEL, AI_PERSONA } from "./config.js";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

let chatHistory = [];
let currentPersonaKey = "assistant";

const PERSONAS = {
  assistant: AI_PERSONA?.systemPrompt || "Kamu adalah FluxAI, asisten cerdas, ramah, dan sangat membantu dalam bahasa Indonesia.",
  friend: "Kamu adalah teman curhat yang asyik, santai, gaul, dan menggunakan bahasa sehari-hari yang akrab.",
  dosen: "Kamu adalah dosen pintar yang bijaksana, analitis, memberikan penjelasan akademis namun mudah dipahami.",
  motivator: "Kamu adalah pemberi motivasi yang penuh semangat, energetik, dan selalu memberikan kata-kata inspiratif."
};

export function setAIPersona(personaKey) {
  if (PERSONAS[personaKey]) {
    currentPersonaKey = personaKey;
    chatHistory = []; // Reset history agar persona baru diterapkan dari awal
  }
}

export function resetAIChat() {
  chatHistory = [];
}

export function getAIChatHistory() {
  return [...chatHistory];
}

export async function sendToAI(userMessage, onChunk, imageBase64 = null) {
  if (!OPENROUTER_KEY || OPENROUTER_KEY.includes("PASTE")) {
    throw new Error("API key OpenRouter belum diisi di config.js");
  }
  if ((!userMessage || userMessage.trim() === "") && !imageBase64) {
    throw new Error("Pesan kosong");
  }
  
  // Format pesan untuk mendukung teks atau multimodal (gambar)
  let userContent = userMessage || "Analisis gambar ini secara detail.";
  if (imageBase64) {
    userContent = [
      { type: "text", text: userMessage || "Analisis gambar ini secara detail." },
      { type: "image_url", image_url: { url: imageBase64 } }
    ];
  }

  chatHistory.push({ role: "user", content: userContent });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
  
  const messages = [
    { role: "system", content: PERSONAS[currentPersonaKey] },
    ...chatHistory,
  ];
  
  const body = {
    model: GEMINI_MODEL || "google/gemini-2.0-flash-exp:free",
    messages,
    temperature: 0.8,
    max_tokens: 800,
    stream: true,
  };
  
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENROUTER_KEY,
        "HTTP-Referer": location.origin,
        "X-Title": "FluxChat & FluxAI",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    chatHistory.pop();
    throw new Error("Koneksi ke FluxAI gagal. Cek internet kamu.");
  }
  
  if (!response.ok) {
    chatHistory.pop();
    let errText = "";
    try { errText = await response.text(); } catch (e) {}
    console.error("OpenRouter error:", response.status, errText);
    
    if (response.status === 401) {
      throw new Error("API key OpenRouter salah. Cek config.js");
    }
    if (response.status === 402) {
      throw new Error("Saldo OpenRouter habis. Top up dulu.");
    }
    if (response.status === 429) {
      throw new Error("Terlalu banyak request. Tunggu sebentar.");
    }
    if (response.status === 404 || response.status === 400) {
      throw new Error("Model tidak tersedia. Coba lagi.");
    }
    throw new Error("FluxAI error (" + response.status + ")");
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          if (onChunk) onChunk(delta, fullText);
        }
      } catch (e) {}
    }
  }
  
  if (!fullText.trim()) {
    chatHistory.pop();
    throw new Error("FluxAI tidak memberi respons. Coba lagi.");
  }
  
  chatHistory.push({ role: "assistant", content: fullText });
  return fullText;
}

// Text-to-Speech untuk membacakan pesan AI
export function speakText(text) {
  if (!("speechSynthesis" in window)) {
    alert("Browser tidak mendukung Text-to-Speech");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
