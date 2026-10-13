// ============================================================
// FLUXCHAT & FLUXAI — APP.JS (FULL FIXED + ALL FEATURES WORK)
// ============================================================

import {
  saveUserProfile, getUserProfile, updateUserProfile,
  listenGlobalMessages, sendGlobalMessage,
  listenPrivateMessages, sendPrivateMessage,
  setTypingStatus, listenTypingStatus, markMessagesAsRead,
  sendCallSignal, listenCallSignal, clearCallSignal,
  findUserByNumericUidOrEmail,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  removeFriend, listenFriendships, searchUsers,
  getUserProfileByUid, getUsersProfiles,
  startRecording, stopRecording, cancelRecording,
  createStory, listenStories, deleteStory,
  getDMRoomId, deleteMessage, addMessageReaction, db
} from "./chat.js";

import { collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, loginUser, registerUser, loginWithGoogle, logoutUser, formatAuthError } from "./auth.js";
import { sendToAI, resetAIChat, setAIPersona, speakText } from "./ai.js";
import { GEMINI_MODEL } from "./config.js";

// ========== STICKERS ==========
const STICKERS = {
  emoji: ["😀","😄","😁","😂","🤣","😊","😍","🥰","😎","🤩","😘","😗","😙","😚","🙂","🤗","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","🥴","😠","😡","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇","🥳","🥺","🤠","🤡","🤥","🤫","🤭","🧐","🤓","😈","👿","💀","☠️","👻","👽","🤖"],
  gesture: ["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","🙏","✊","👊","🤛","🤜","💪","✍️","👏","🙌","🤲"],
  animal: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐴","🦄","🐝","🦋","🐢","🐍","🦎","🐙","🐬","🐳","🦈"],
  love: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","💌","💋","😍","🥰","😘","😻","💑","💐","🌹","🌷","🌸"],
  food: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🥭","🍍","🥝","🍅","🥑","🥦","🌽","🥕","🍞","🧀","🥚","🍳","🥓","🍗","🌭","🍔","🍟","🍕","🥪","🌮","🍣","🍱","🍜","🍩","🍪","☕","🍵"]
};

const THEMES = {
  kuning: { name: "Kuning Cokelat", color: "#FFC857" },
  ungu:   { name: "Ungu Modern",    color: "#8B5CF6" },
  pink:   { name: "Pink Rose",      color: "#EC4899" },
  hijau:  { name: "Hijau Daun",     color: "#10B981" },
  biru:   { name: "Biru Langit",    color: "#3B82F6" }
};

const WALLPAPER_PRESETS = {
  default: null,
  kuning: "linear-gradient(135deg, #FFC857, #E67E22)",
  ungu: "linear-gradient(135deg, #A78BFA, #7C3AED)",
  pink: "linear-gradient(135deg, #F472B6, #DB2777)",
  hijau: "linear-gradient(135deg, #34D399, #059669)",
  biru: "linear-gradient(135deg, #60A5FA, #2563EB)",
  gelap: "linear-gradient(135deg, #1F1B2E, #0F0A1A)"
};

// ========== STATE ==========
const state = {
  user: null, profile: null,
  authMode: "login", currentTab: "chat",
  currentChat: null, dmWithUid: null,
  globalUnsub: null, dmUnsub: null, incomingDmUnsub: null,
  typingUnsub: null, callUnsub: null,
  isAILoading: false,
  pendingAvatarFile: null, pendingBannerFile: null,
  pendingWallpaper: null, pendingStoryImage: null,
  lastGlobalMsgs: [], lastDmMsgs: [], lastAiMsgs: [],
  storiesList: [], storiesUnsub: null,
  currentStoryIndex: 0, storyTimer: null,
  currentStoryUid: null, currentStoryUserList: [],
  replyingTo: null, pendingAIImage: null,
  localStream: null, remoteStream: null, pc: null,
  isCalling: false, activeTargetUser: null
};

let frFriends = [], frRequests = [], frSentRequests = [];
let frUnsub = null, frSubTab = "friends";
let currentAudioData = null;
let typingTimer = null;
let frSearchTimer = null;
let currentReactionTarget = null;
let currentSelectedMsg = null;
let _reactionBackdrop = null;

const viewedStories = new Set(JSON.parse(localStorage.getItem("flux_viewed_stories") || "[]"));
const saveViewedStories = () => localStorage.setItem("flux_viewed_stories", JSON.stringify([...viewedStories]));

// ========== HELPERS ==========
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  const el = $(id);
  if (el) el.classList.add("active");
}

function showToast(msg, duration = 2000) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 250);
  }, duration);
}

function showInfo(title, bodyHtml, btnText = "OK", onBtn = null) {
  const titleEl = $("info-modal-title");
  const bodyEl = $("info-modal-body");
  const btn = $("info-modal-btn");
  if (!titleEl || !bodyEl || !btn) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  btn.textContent = btnText;
  btn.onclick = () => {
    $("info-modal")?.classList.add("hidden");
    if (onBtn) onBtn();
  };
  $("info-modal")?.classList.remove("hidden");
}

function formatTime(ts) {
  if (!ts) return "";
  let d;
  if (typeof ts === "object" && typeof ts.toDate === "function") d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  else d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");
}

function formatDateLabel(ts) {
  if (!ts) return "";
  let d;
  if (typeof ts === "object" && typeof ts.toDate === "function") d = ts.toDate();
  else d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const tOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yOnly = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate()).getTime();
  if (dOnly === tOnly) return "Hari ini";
  if (dOnly === yOnly) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function stableMsgId(m) {
  if (m.id) return m.id;
  const key = (m.uid || "") + "|" + (m.text || m.sticker || m.type || "");
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return "h-" + h.toString(36);
}

function getDisplayText(m) {
  if (!m) return "";
  if (m.type === "sticker" && m.sticker) return "Stiker " + m.sticker;
  if (m.type === "voice") return "🎤 Pesan suara";
  if (m.type === "location") return "📍 Lokasi";
  if (m.type === "contact") return "📇 Kontak";
  if (m.text && m.text.trim().length > 0) return m.text;
  return "Pesan";
}

function compressImage(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
        else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("Gagal baca gambar"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
}

// ========== THEME ==========
function applyTheme(name) {
  if (!THEMES[name]) name = "kuning";
  document.body.setAttribute("data-theme", name);
  localStorage.setItem("flux_theme", name);
  const meta = $("meta-theme-color");
  if (meta) meta.setAttribute("content", THEMES[name].color);
  const sub = $("menu-theme-sub");
  if (sub) sub.textContent = THEMES[name].name;
  $$(".theme-option").forEach(o => o.classList.toggle("active", o.dataset.theme === name));
}

function isDarkMode() { return localStorage.getItem("flux_dark") === "1"; }
function applyDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);
  localStorage.setItem("flux_dark", enabled ? "1" : "0");
  const btn = $("btn-dark-toggle");
  if (btn) btn.textContent = enabled ? "☀️" : "🌙";
}

applyTheme(localStorage.getItem("flux_theme") || "kuning");
applyDarkMode(isDarkMode());

// ========== SPLASH ==========
setTimeout(() => {
  if (state.user) showScreen("app");
  else showScreen("auth");
}, 1400);

// ========== AUTH ==========
$$(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    state.authMode = tab.dataset.mode;
    const btn = $("auth-submit");
    if (btn) btn.textContent = state.authMode === "login" ? "Masuk" : "Daftar";
    const nameWrap = $("field-name-wrap");
    if (nameWrap) nameWrap.style.display = state.authMode === "register" ? "flex" : "none";
  });
});

$("auth-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const name = $("auth-name").value.trim();
  const errEl = $("auth-error");
  const submitBtn = $("auth-submit");
  if (errEl) errEl.classList.add("hidden");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Memproses..."; }
  try {
    if (state.authMode === "login") await loginUser(email, password);
    else await registerUser(email, password, name || email.split("@")[0]);
  } catch (err) {
    if (errEl) { errEl.textContent = formatAuthError(err); errEl.classList.remove("hidden"); }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = state.authMode === "login" ? "Masuk" : "Daftar";
    }
  }
});

$("auth-google")?.addEventListener("click", async () => {
  try { await loginWithGoogle(); }
  catch (err) {
    const errEl = $("auth-error");
    if (errEl) { errEl.textContent = formatAuthError(err); errEl.classList.remove("hidden"); }
  }
});

// ========== AUTH WATCHER ==========
watchAuth(async (user) => {
  if (user) {
    state.user = user;
    try {
      await saveUserProfile(user);
      const profile = await getUserProfile(user.uid);
      if (profile) {
        state.profile = profile;
        if (Array.isArray(profile.conversations)) {
          for (const otherUid of profile.conversations) {
            const target = await getUserProfileByUid(otherUid);
            if (target) addPrivateChatToList(target, 0);
          }
        }
      }
      updateProfileUI();
    } catch (err) { console.error("Profile load error:", err); }
    setupChatListeners();
    initIncomingChatListener();
    loadWallpaper();
    const modelEl = $("ai-model-name");
    if (modelEl) modelEl.textContent = GEMINI_MODEL || "-";
    showScreen("app");
    initFriends();
    initStories();
  } else {
    state.user = null; state.profile = null;
    if (state.incomingDmUnsub) { state.incomingDmUnsub(); state.incomingDmUnsub = null; }
    showScreen("auth");
  }
});

// ========== PROFILE UI ==========
function updateProfileUI() {
  if (!state.profile) return;
  const name = state.profile.displayName || "User";
  const email = state.profile.email || "";
  const bio = state.profile.bio || "Belum ada bio";
  const avatar = state.profile.photoURL || state.user?.photoURL;
  const banner = state.profile.bannerURL;
  const numericUid = state.profile.numericUid || "-";
  const username = (email.split("@")[0] || "user").toLowerCase();
  const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setText("profile-name", name);
  setText("profile-username", username);
  setText("profile-bio", bio);
  setText("profile-uid", numericUid);
  setText("menu-username-sub", "@" + username);
  setText("menu-bio-sub", bio);
  const avatarEl = $("profile-avatar");
  const letterEl = $("profile-avatar-letter");
  if (avatarEl && letterEl) {
    if (avatar && avatar.length > 10) {
      avatarEl.style.backgroundImage = "url(" + avatar + ")";
      letterEl.style.display = "none";
    } else {
      avatarEl.style.backgroundImage = "";
      letterEl.style.display = "block";
      letterEl.textContent = name.charAt(0).toUpperCase();
    }
  }
  const bannerEl = $("profile-banner");
  if (bannerEl) bannerEl.style.backgroundImage = (banner && banner.length > 10) ? "url(" + banner + ")" : "";
  const headerAv = $("header-avatar");
  if (headerAv) {
    if (avatar && avatar.length > 10) {
      headerAv.style.backgroundImage = "url(" + avatar + ")";
      headerAv.textContent = "";
    } else {
      headerAv.style.backgroundImage = "";
      headerAv.textContent = name.charAt(0).toUpperCase();
    }
  }
}

// ========== HEADER ACTIONS ==========
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const action = t.dataset.action;
  if (action === "search") {
    showInfo("🔍 Cari Percakapan", '<input type="text" id="global-search-input" placeholder="Cari pesan atau teman..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text);" />');
  } else if (action === "notif") {
    showInfo("🔔 Pemberitahuan", '<div class="info-row">Tidak ada pemberitahuan baru saat ini.</div>');
  }
});

$("btn-dark-toggle")?.addEventListener("click", () => {
  const next = !isDarkMode();
  applyDarkMode(next);
  showToast(next ? "Dark mode ON 🌙" : "Light mode ON ☀️");
});

$("header-avatar")?.addEventListener("click", openProfileModal);

// ========== TAB NAVIGATION ==========
$$(".tk-nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tk-nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.currentTab = btn.dataset.tab;
    $$(".tab-content").forEach(t => t.classList.remove("active"));
    const target = $("tab-" + state.currentTab);
    if (target) target.classList.add("active");
  });
});

$$(".tk-subtab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tk-subtab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.subtab;
    $$(".tk-subpanel").forEach(p => p.classList.remove("active"));
    const target = document.querySelector('.tk-subpanel[data-panel="' + name + '"]');
    if (target) target.classList.add("active");
  });
});

$("item-ai")?.addEventListener("click", () => openChatDetail("ai"));
$("item-global")?.addEventListener("click", () => openChatDetail("global"));

// ========== OPEN CHAT DETAIL ==========
function openChatDetail(type, targetUser = null) {
  state.currentChat = type;
  state.activeTargetUser = targetUser;
  state.replyingTo = null;
  updateReplyBanner();

  const overlay = $("chat-detail");
  const nameEl = $("chat-name");
  const statusEl = $("chat-status");
  const avatarEl = $("chat-avatar");
  const msgBox = $("chat-messages");
  const inputEl = $("chat-input");
  if (!overlay) return;

  if (state.typingUnsub) { state.typingUnsub(); state.typingUnsub = null; }
  if (state.callUnsub) { state.callUnsub(); state.callUnsub = null; }

  if (type === "ai") {
    if (nameEl) nameEl.innerHTML = 'FluxAI <select id="ai-persona-select" style="margin-left:8px;font-size:11px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px;"><option value="assistant">Asisten</option><option value="friend">Teman</option><option value="dosen">Dosen</option><option value="motivator">Motivator</option></select>';
    if (statusEl) statusEl.textContent = "Online · AI Cerdas";
    if (avatarEl) { avatarEl.textContent = "F"; avatarEl.style.backgroundImage = ""; }
    if (inputEl) inputEl.placeholder = "Tanya FluxAI atau kirim foto...";
    setTimeout(() => {
      const sel = $("ai-persona-select");
      if (sel) sel.addEventListener("change", (ev) => {
        setAIPersona(ev.target.value);
        showToast("Persona AI diubah: " + ev.target.options[ev.target.selectedIndex].text);
      });
    }, 100);
    renderAIMessages();
  } else if (type === "global") {
    if (nameEl) nameEl.textContent = "Chat Global";
    if (statusEl) statusEl.textContent = "Publik · Semua user";
    if (avatarEl) { avatarEl.textContent = "🌍"; avatarEl.style.backgroundImage = ""; }
    if (inputEl) inputEl.placeholder = "Pesan ke semua orang...";
    renderGlobalMessages(state.lastGlobalMsgs);
  } else if (type === "dm" && targetUser) {
    if (nameEl) nameEl.textContent = targetUser.displayName || targetUser.email || "User";
    if (statusEl) statusEl.textContent = "Online";
    if (avatarEl) {
      if (targetUser.photoURL && targetUser.photoURL.length > 10) {
        avatarEl.style.backgroundImage = "url(" + targetUser.photoURL + ")";
        avatarEl.textContent = "";
      } else {
        avatarEl.style.backgroundImage = "";
        avatarEl.textContent = (targetUser.displayName || "U").charAt(0).toUpperCase();
      }
    }
    if (inputEl) inputEl.placeholder = "Tulis pesan...";
    markMessagesAsRead(state.user.uid, targetUser.uid);
    state.dmWithUid = targetUser.uid;
    addPrivateChatToList(targetUser, 0);
    if (msgBox) msgBox.innerHTML = '<div class="chat-timestamp-divider">Memuat pesan...</div>';
    if (state.dmUnsub) state.dmUnsub();
    state.dmUnsub = listenPrivateMessages(state.user.uid, targetUser.uid, (msgs) => {
      state.lastDmMsgs = msgs || [];
      if (state.currentChat === "dm" && state.dmWithUid === targetUser.uid) {
        renderDMMessages(state.lastDmMsgs);
      }
      markMessagesAsRead(state.user.uid, targetUser.uid);
    });
    state.typingUnsub = listenTypingStatus(state.user.uid, targetUser.uid, (isTyping) => {
      if (statusEl) statusEl.textContent = isTyping ? "Sedang mengetik..." : "Online";
    });
    setupDmCallListener(targetUser.uid);
    renderDMMessages(state.lastDmMsgs);
  }

  overlay.classList.remove("hidden");
  loadWallpaper();
  renderPinnedBanner();
  setTimeout(() => { if (msgBox) msgBox.scrollTop = msgBox.scrollHeight; }, 50);
}

$("chat-back")?.addEventListener("click", () => {
  hideReactionPicker();
  $("chat-detail")?.classList.add("hidden");
  state.currentChat = null;
  state.activeTargetUser = null;
  state.dmWithUid = null;
  if (state.typingUnsub) { state.typingUnsub(); state.typingUnsub = null; }
  if (state.callUnsub) { state.callUnsub(); state.callUnsub = null; }
  if (state.dmUnsub) { state.dmUnsub(); state.dmUnsub = null; }
});

$("chat-header-user")?.addEventListener("click", () => {
  if (state.currentChat === "dm" && state.activeTargetUser) {
    const u = state.activeTargetUser;
    showInfo("📇 Info Kontak", '<div style="text-align:center; margin-bottom:12px;">' +
      '<div style="width:64px; height:64px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px; margin:0 auto; background-size:cover; ' + (u.photoURL ? "background-image:url(" + u.photoURL + ")" : "") + '">' + (u.photoURL ? "" : (u.displayName || "U").charAt(0)) + '</div>' +
      '<div style="font-weight:700; font-size:16px; margin-top:8px;">' + escapeHtml(u.displayName || u.email) + '</div>' +
      '<div style="font-size:12px; color:var(--text-muted);">UID: ' + (u.numericUid || u.uid) + '</div></div>');
  }
});

// ========== WEBRTC ==========
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function startCall(isVideo) {
  if (!state.dmWithUid) { showToast("Buka chat privat dulu untuk menelepon!"); return; }
  state.isCalling = true;
  showCallUI(isVideo, true);
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
    if (isVideo && $("local-video")) $("local-video").srcObject = state.localStream;
    state.pc = new RTCPeerConnection(ICE_SERVERS);
    state.localStream.getTracks().forEach(t => state.pc.addTrack(t, state.localStream));
    state.pc.ontrack = (event) => {
      state.remoteStream = event.streams[0];
      if (isVideo && $("remote-video")) $("remote-video").srcObject = state.remoteStream;
      else if (!isVideo && $("remote-audio")) { $("remote-audio").srcObject = state.remoteStream; $("remote-audio").play(); }
    };
    state.pc.onicecandidate = (e) => {
      if (e.candidate) sendCallSignal(state.user.uid, state.dmWithUid, { type: "candidate", candidate: e.candidate, isVideo });
    };
    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);
    await sendCallSignal(state.user.uid, state.dmWithUid, { type: "offer", offer, isVideo });
    if ($("call-status-text")) $("call-status-text").textContent = "Memanggil...";
  } catch (err) { showToast("Akses kamera/mikrofon ditolak."); endCall(); }
}

function setupDmCallListener(otherUid) {
  if (state.callUnsub) state.callUnsub();
  state.callUnsub = listenCallSignal(state.user.uid, otherUid, async (signal) => {
    if (signal.type === "end") { endCall(); return; }
    if (!state.pc && signal.type === "offer") {
      if (confirm("Panggilan " + (signal.isVideo ? "Video" : "Suara") + " masuk. Terima?")) {
        state.isCalling = true;
        showCallUI(signal.isVideo, false);
        try {
          state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: signal.isVideo });
          if (signal.isVideo && $("local-video")) $("local-video").srcObject = state.localStream;
          state.pc = new RTCPeerConnection(ICE_SERVERS);
          state.localStream.getTracks().forEach(t => state.pc.addTrack(t, state.localStream));
          state.pc.ontrack = (e) => {
            state.remoteStream = e.streams[0];
            if (signal.isVideo && $("remote-video")) $("remote-video").srcObject = state.remoteStream;
            else if (!signal.isVideo && $("remote-audio")) { $("remote-audio").srcObject = state.remoteStream; $("remote-audio").play(); }
          };
          state.pc.onicecandidate = (e) => {
            if (e.candidate) sendCallSignal(state.user.uid, otherUid, { type: "candidate", candidate: e.candidate });
          };
          await state.pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          const answer = await state.pc.createAnswer();
          await state.pc.setLocalDescription(answer);
          await sendCallSignal(state.user.uid, otherUid, { type: "answer", answer });
          if ($("call-status-text")) $("call-status-text").textContent = "Terhubung";
        } catch (err) { endCall(); }
      }
    } else if (state.pc && signal.type === "answer") {
      await state.pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
      if ($("call-status-text")) $("call-status-text").textContent = "Terhubung";
    } else if (state.pc && signal.type === "candidate") {
      await state.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  });
}

function showCallUI(isVideo, isCaller) {
  let modal = $("call-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "call-modal";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#111; z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:20px; color:#fff;";
    modal.innerHTML = '<div id="call-status-text" style="font-size:18px; font-weight:600; margin-top:20px;">' + (isCaller ? "Memanggil..." : "Panggilan Masuk...") + '</div>' +
      '<div style="flex:1; width:100%; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; border-radius:12px; background:#000; margin:10px 0;">' +
      '<video id="remote-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover; ' + (isVideo ? "" : "display:none;") + '"></video>' +
      '<video id="local-video" autoplay muted playsinline style="position:absolute; bottom:20px; right:20px; width:100px; height:150px; object-fit:cover; border-radius:8px; border:2px solid #fff; ' + (isVideo ? "" : "display:none;") + '"></video>' +
      '<audio id="remote-audio" autoplay></audio>' +
      (isVideo ? "" : '<div style="font-size:64px;">📞</div>') + '</div>' +
      '<div style="margin-bottom:30px;"><button id="end-call-btn" style="background:red; color:#fff; border:none; padding:14px 32px; border-radius:30px; font-weight:700; cursor:pointer; font-size:16px;">Akhiri Panggilan</button></div>';
    document.body.appendChild(modal);
    $("end-call-btn").onclick = endCall;
  }
  modal.style.display = "flex";
}

function endCall() {
  if (state.localStream) state.localStream.getTracks().forEach(t => t.stop());
  if (state.pc) state.pc.close();
  state.pc = null; state.localStream = null; state.remoteStream = null; state.isCalling = false;
  if (state.dmWithUid) clearCallSignal(state.user.uid, state.dmWithUid).catch(()=>{});
  $("call-modal")?.remove();
  showToast("Panggilan diakhiri");
}

$("chat-call")?.addEventListener("click", () => startCall(false));
$("chat-video")?.addEventListener("click", () => startCall(true));

// ========== INSTANT REACTION ==========
function updateLocalReaction(msgId, emoji, userId) {
  const arrays = [state.lastGlobalMsgs, state.lastDmMsgs];
  for (const arr of arrays) {
    if (!arr || !arr.length) continue;
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      if (stableMsgId(m) !== msgId) continue;
      if (!m.reactions) m.reactions = {};
      if (!m.reactions[emoji]) m.reactions[emoji] = [];
      const users = m.reactions[emoji];
      const idx = users.indexOf(userId);
      if (idx >= 0) {
        users.splice(idx, 1);
        if (users.length === 0) delete m.reactions[emoji];
      } else {
        users.push(userId);
      }
      return true;
    }
  }
  return false;
}

// ========== REACTION RENDER ==========
function renderReactionsHTML(msgId, msgData) {
  const reactions = msgData?.reactions || {};
  if (!reactions || Object.keys(reactions).length === 0) return "";
  let html = '<div class="msg-reactions">';
  for (const [emoji, users] of Object.entries(reactions)) {
    if (!users || users.length === 0) continue;
    const mine = state.user && users.includes(state.user.uid);
    html += '<div class="reaction-chip ' + (mine ? "mine" : "") + '" data-msg="' + msgId + '" data-emoji="' + emoji + '"><span>' + emoji + '</span><span class="count">' + users.length + '</span></div>';
  }
  html += "</div>";
  return html;
}

// ========== MESSAGE RENDER ==========
function renderWithTimestamps(msgs) {
  const box = $("chat-messages");
  if (!box) return;
  box.innerHTML = "";
  if (!msgs || msgs.length === 0) {
    box.innerHTML = '<div class="tk-empty" style="padding: 40px 20px;"><div class="tk-empty-icon">💬</div><p>Belum ada pesan</p><span>Mulai percakapan sekarang</span></div>';
    return;
  }
  let lastDateLabel = "";
  for (const m of msgs) {
    const dateLabel = formatDateLabel(m.createdAt);
    if (dateLabel && dateLabel !== lastDateLabel) {
      const div = document.createElement("div");
      div.className = "chat-timestamp-divider";
      div.textContent = dateLabel;
      box.appendChild(div);
      lastDateLabel = dateLabel;
    }
    const isSelf = m.uid === state.user?.uid;
    const msgId = stableMsgId(m);
    const wrapper = document.createElement("div");
    wrapper.className = "msg-wrapper " + (isSelf ? "self" : "other");
    if (!isSelf && state.currentChat === "global") {
      const avHtml = document.createElement("div");
      avHtml.style.cssText = "width:28px; height:28px; border-radius:50%; margin-right:6px; flex-shrink:0; background-size:cover; background-position:center; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; background-color:var(--primary); color:#fff;";
      if (m.photoURL && m.photoURL.length > 10) avHtml.style.backgroundImage = "url(" + m.photoURL + ")";
      else avHtml.textContent = (m.name || "U").charAt(0).toUpperCase();
      wrapper.appendChild(avHtml);
    }
    const el = document.createElement("div");
    el.className = "chat-msg " + (isSelf ? "self" : "other");
    let replyHtml = "";
    if (m.replyTo) {
      replyHtml = '<div style="background:rgba(0,0,0,0.08); border-left:3px solid var(--primary); padding:4px 8px; margin-bottom:6px; border-radius:4px; font-size:11px;"><div style="font-weight:600; opacity:0.8;">' + escapeHtml(m.replyTo.name) + '</div><div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0.7;">' + escapeHtml(m.replyTo.text) + '</div></div>';
    }
    let content = "";
    if (m.type === "sticker" && m.sticker) {
      content = '<span class="msg-sticker">' + m.sticker + '</span>';
    } else if (m.type === "voice" && m.audioBase64) {
      let waveHTML = "";
      for (let i = 0; i < 20; i++) { const h = 6 + Math.random() * 18; waveHTML += '<div class="voice-wave-bar" style="height:' + h + 'px"></div>'; }
      content = '<div class="voice-bubble"><button class="voice-play-btn" data-audio="' + m.audioBase64 + '">▶</button><div class="voice-wave-display">' + waveHTML + '</div><div class="voice-duration">' + (m.duration || 0) + 's</div></div>';
    } else if (m.type === "location") {
      content = '<div style="background:rgba(0,0,0,0.1); padding:10px; border-radius:10px; text-align:center;">📍 <b>Live Location</b><br><a href="https://maps.google.com/?q=' + m.lat + ',' + m.lng + '" target="_blank" style="color:var(--primary); font-size:12px;">Buka di Maps</a></div>';
    } else if (m.type === "contact") {
      content = '<div style="background:rgba(0,0,0,0.1); padding:10px; border-radius:10px; display:flex; align-items:center; gap:8px;"><div style="font-size:24px;">📇</div><div><div style="font-weight:600;">' + escapeHtml(m.contactName) + '</div><div style="font-size:11px; opacity:0.8;">UID: ' + m.contactUid + '</div></div></div>';
    } else {
      content = '<span class="msg-text">' + escapeHtml(m.text || "") + '</span>';
    }
    const check = isSelf ? ' <span class="msg-check" style="' + (m.read ? "color:#3b82f6;" : "") + '">✓✓</span>' : "";
    const time = formatTime(m.createdAt);
    el.innerHTML = replyHtml + content + '<span class="msg-time">' + time + check + '</span>';
    el.dataset.msgId = msgId;
    const msgData = { id: msgId, text: getDisplayText(m), name: m.name || "User", uid: m.uid, type: m.type, reactions: m.reactions || {} };
    attachLongPress(el, msgId, msgData);
    attachSwipeReply(el, msgData);
    wrapper.appendChild(el);
    const rxHTML = renderReactionsHTML(msgId, m);
    if (rxHTML) {
      const tmp = document.createElement("div");
      tmp.innerHTML = rxHTML;
      const rxEl = tmp.firstChild;
      rxEl.querySelectorAll(".reaction-chip").forEach(chip => {
        chip.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const chatType = state.currentChat === "global" ? "global" : "dm";
          const roomId = chatType === "dm" ? getDMRoomId(state.user.uid, state.dmWithUid) : null;
          const targetId = msgId;
          const userId = state.user.uid;
          const emoji = chip.dataset.emoji;
          
          // Update lokal instan
          updateLocalReaction(targetId, emoji, userId);
          setTimeout(function() { refreshCurrentChat(); }, 50);
          
          // Kirim ke Firestore
          addMessageReaction(chatType, roomId, targetId, emoji, userId).catch(function(){});
        });
      });
      wrapper.appendChild(rxEl);
    }
    box.appendChild(wrapper);
  }
  box.scrollTop = box.scrollHeight;
  box.querySelectorAll(".voice-play-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const audio = btn.dataset.audio;
      if (!audio) return;
      const audioEl = $("audio-player");
      if (audioEl) { audioEl.src = audio; audioEl.play(); $("audio-player-modal")?.classList.remove("hidden"); }
    });
  });
}

function refreshCurrentChat() {
  if (state.currentChat === "global") renderGlobalMessages(state.lastGlobalMsgs);
  else if (state.currentChat === "dm") renderDMMessages(state.lastDmMsgs);
  else if (state.currentChat === "ai") renderAIMessages();
}

function renderGlobalMessages(msgs) {
  state.lastGlobalMsgs = msgs || [];
  if (state.currentChat !== "global") return;
  renderWithTimestamps(state.lastGlobalMsgs);
}

function renderDMMessages(msgs) {
  if (state.currentChat !== "dm") return;
  renderWithTimestamps(msgs || []);
}

function renderAIMessages() {
  const box = $("chat-messages");
  if (!box) return;
  box.innerHTML = "";
  const div = document.createElement("div");
  div.className = "chat-timestamp-divider";
  div.textContent = "Hari ini";
  box.appendChild(div);
  let idx = 0;
  for (const m of state.lastAiMsgs) {
    const isSelf = m.role === "user";
    const msgId = "ai-" + idx + "-" + (m.time || 0);
    idx++;
    const wrapper = document.createElement("div");
    wrapper.className = "msg-wrapper " + (isSelf ? "self" : "other");
    const el = document.createElement("div");
    el.className = "chat-msg " + (isSelf ? "self" : "other");
    const ttsBtn = !isSelf ? '<button class="ai-tts-btn" data-text="' + escapeHtml(m.text) + '" style="background:none;border:none;cursor:pointer;margin-left:4px;">🔊</button>' : "";
    const time = formatTime(m.time ? new Date(m.time) : new Date());
    el.innerHTML = '<span class="msg-text">' + escapeHtml(m.text) + '</span>' + ttsBtn + '<span class="msg-time">' + time + '</span>';
    attachLongPress(el, msgId, { id: msgId, text: m.text, name: "FluxAI", uid: "ai" });
    wrapper.appendChild(el);
    box.appendChild(wrapper);
  }
  box.scrollTop = box.scrollHeight;
  box.querySelectorAll(".ai-tts-btn").forEach(btn => { btn.onclick = () => speakText(btn.dataset.text); });
}

// ========== SWIPE REPLY ==========
function attachSwipeReply(el, msgData) {
  let startX = 0, startY = 0, currentX = 0;
  let isSwiping = false;
  let moved = false;

  el.addEventListener("touchstart", function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = startX;
    isSwiping = true;
    moved = false;
  }, { passive: true });

  el.addEventListener("touchmove", function(e) {
    if (!isSwiping) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (Math.abs(diff) > 15 && dy < 30) {
      moved = true;
      if (diff > 0 && diff <= 80) {
        el.style.transform = "translateX(" + diff + "px)";
        el.style.transition = "none";
      }
    }
  }, { passive: true });

  el.addEventListener("touchend", function() {
    if (!isSwiping) return;
    isSwiping = false;
    el.style.transition = "transform .2s";
    el.style.transform = "translateX(0px)";
    const diff = currentX - startX;
    if (moved && diff > 60) {
      state.replyingTo = msgData;
      updateReplyBanner();
      showToast("Membalas pesan 💬");
    }
  });

  el.addEventListener("touchcancel", function() {
    isSwiping = false;
    el.style.transform = "translateX(0px)";
  });
}

// ========== LONG PRESS + REACTION PICKER ==========
function attachLongPress(el, msgId, msgData) {
  let pressTimer = null;
  let startX = 0;
  let startY = 0;

  function start(e) {
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    el.classList.add("pressing");
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function() {
      el.classList.remove("pressing");
      if (navigator.vibrate) navigator.vibrate(30);
      console.log("[LongPress] Fired:", msgId);
      showReactionPicker(el, msgId, msgData);
    }, 500);
  }

  function cancel() {
    el.classList.remove("pressing");
    clearTimeout(pressTimer);
  }

  function move(e) {
    if (!e.touches) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (dx > 10 || dy > 10) cancel();
  }

  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchmove", move, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchcancel", cancel);
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    clearTimeout(pressTimer);
    showReactionPicker(el, msgId, msgData);
  });
}

function showReactionPicker(bubbleEl, msgId, msgData) {
  const picker = $("reaction-picker");
  if (!picker) return;

  currentReactionTarget = msgId;
  currentSelectedMsg = msgData;

  if (_reactionBackdrop) { _reactionBackdrop.remove(); _reactionBackdrop = null; }

  _reactionBackdrop = document.createElement("div");
  _reactionBackdrop.id = "reaction-backdrop";
  _reactionBackdrop.style.cssText = "position:fixed; inset:0; z-index:10001; background:transparent;";
  _reactionBackdrop.addEventListener("click", function(e) {
    if (e.target === _reactionBackdrop) { e.preventDefault(); e.stopPropagation(); hideReactionPicker(); }
  });
  _reactionBackdrop.addEventListener("touchstart", function(e) {
    if (e.target === _reactionBackdrop) { e.preventDefault(); e.stopPropagation(); hideReactionPicker(); }
  }, { passive: false });
  document.body.appendChild(_reactionBackdrop);

  picker.classList.remove("hidden");
  picker.style.display = "flex";
  picker.style.position = "fixed";
  picker.style.zIndex = "10002";
  picker.style.pointerEvents = "auto";

  const buttons = picker.querySelectorAll(".reaction-btn");
  console.log("[Reaction] Binding " + buttons.length + " buttons for " + msgId);

  buttons.forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      if (!emoji || !currentReactionTarget || !state.user) return;
      console.log("[Reaction] Klik:", emoji, "→ target:", currentReactionTarget);
      
      const chatType = state.currentChat === "global" ? "global" : "dm";
      const roomId = chatType === "dm" ? getDMRoomId(state.user.uid, state.dmWithUid) : null;
      const targetId = currentReactionTarget;
      const userId = state.user.uid;
      
      // 1. Update UI lokal INSTAN
      updateLocalReaction(targetId, emoji, userId);
      
      // 2. Render ulang
      setTimeout(function() { refreshCurrentChat(); }, 50);
      
      // 3. Kirim ke Firestore background
      addMessageReaction(chatType, roomId, targetId, emoji, userId)
        .then(function() { console.log("[Reaction] ✅ Saved"); })
        .catch(function(err) { console.error("[Reaction] ❌", err); });
      
      // 4. Tutup picker
      hideReactionPicker();
      showToast("Reaction " + emoji + " dikirim");
    };
  });

  const rect = bubbleEl.getBoundingClientRect();
  const pickerW = 300;
  const pickerH = 64;
  let left = rect.left + rect.width / 2 - pickerW / 2;
  let top = rect.top - pickerH - 14;
  if (left < 10) left = 10;
  if (left + pickerW > window.innerWidth - 10) left = window.innerWidth - pickerW - 10;
  if (top < 70) top = rect.bottom + 14;
  picker.style.left = left + "px";
  picker.style.top = top + "px";
  picker.style.width = pickerW + "px";

  showMessageToolbar(msgData);
}

function hideReactionPicker() {
  const picker = $("reaction-picker");
  if (picker) {
    picker.classList.add("hidden");
    picker.style.display = "";
    picker.style.left = "";
    picker.style.top = "";
    picker.style.width = "";
    picker.style.zIndex = "";
    picker.style.pointerEvents = "";
  }
  if (_reactionBackdrop) { _reactionBackdrop.remove(); _reactionBackdrop = null; }
  currentReactionTarget = null;
  currentSelectedMsg = null;
  const toolbar = document.getElementById("action-header");
  if (toolbar) toolbar.remove();
  const header = document.querySelector(".chat-detail-header");
  if (header) {
    Array.from(header.children).forEach(function(child) {
      if (child.id !== "action-header") child.style.visibility = "";
    });
  }
}

// ========== MESSAGE TOOLBAR (FULL WORKING) ==========
function showMessageToolbar(msg) {
  const header = document.querySelector(".chat-detail-header");
  if (!header) return;
  header.style.position = "relative";

  const existing = document.getElementById("action-header");
  if (existing) existing.remove();

  Array.from(header.children).forEach(function(child) {
    if (child.id !== "action-header") child.style.visibility = "hidden";
  });

  const toolbar = document.createElement("div");
  toolbar.id = "action-header";
  toolbar.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:var(--surface); display:flex; align-items:center; justify-content:space-between; padding:0 12px; box-sizing:border-box; z-index:30;";
  header.appendChild(toolbar);

  const isMyMsg = msg.uid === state.user?.uid;
  const isAIMsg = msg.uid === "ai";

  toolbar.innerHTML =
    '<button id="act-back" style="background:transparent;border:none;font-size:22px;cursor:pointer;color:var(--text);padding:8px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;">⬅️</button>' +
    '<div style="display:flex;align-items:center;gap:2px;">' +
    '<button id="act-reply" title="Balas" style="background:transparent;border:none;font-size:20px;cursor:pointer;padding:6px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;">💬</button>' +
    '<button id="act-star" title="Bintang" style="background:transparent;border:none;font-size:20px;cursor:pointer;padding:6px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;">⭐</button>' +
    '<button id="act-pin" title="Sematkan" style="background:transparent;border:none;font-size:20px;cursor:pointer;padding:6px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;">📌</button>' +
    '<button id="act-copy" title="Salin" style="background:transparent;border:none;font-size:20px;cursor:pointer;padding:6px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;">📋</button>' +
    (isAIMsg ? "" : '<button id="act-delete" title="Hapus" style="background:transparent;border:none;font-size:20px;cursor:pointer;padding:6px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;">🗑️</button>') +
    '</div>';

  // BACK
  const actBack = document.getElementById("act-back");
  if (actBack) actBack.onclick = function(e) { e.preventDefault(); e.stopPropagation(); hideReactionPicker(); };

  // REPLY
  const actReply = document.getElementById("act-reply");
  if (actReply) actReply.onclick = function(e) {
    e.preventDefault(); e.stopPropagation();
    state.replyingTo = msg;
    updateReplyBanner();
    hideReactionPicker();
    showToast("Membalas pesan 💬");
  };

  // STAR
  const actStar = document.getElementById("act-star");
  if (actStar) actStar.onclick = function(e) {
    e.preventDefault(); e.stopPropagation();
    const key = "flux_starred_" + (state.user?.uid || "guest");
    let starred = [];
    try { starred = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
    const idx = starred.indexOf(msg.id);
    if (idx >= 0) {
      starred.splice(idx, 1);
      showToast("Bintang dihapus");
    } else {
      starred.push(msg.id);
      showToast("Pesan diberi bintang ⭐");
    }
    localStorage.setItem(key, JSON.stringify(starred));
    hideReactionPicker();
  };

  // PIN
  const actPin = document.getElementById("act-pin");
  if (actPin) actPin.onclick = function(e) {
    e.preventDefault(); e.stopPropagation();
    const key = "flux_pinned_" + (state.currentChat || "global");
    let pinned = [];
    try { pinned = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
    const idx = pinned.findIndex(function(p) { return p.id === msg.id; });
    if (idx >= 0) {
      pinned.splice(idx, 1);
      showToast("Sematan dilepas");
    } else {
      pinned.push({ id: msg.id, text: msg.text, name: msg.name, uid: msg.uid, time: Date.now() });
      showToast("Pesan disematkan 📌");
    }
    localStorage.setItem(key, JSON.stringify(pinned));
    renderPinnedBanner();
    hideReactionPicker();
  };

  // COPY
  const actCopy = document.getElementById("act-copy");
  if (actCopy) actCopy.onclick = function(e) {
    e.preventDefault(); e.stopPropagation();
    if (navigator.clipboard) navigator.clipboard.writeText(msg.text || "").catch(function(){});
    showToast("Teks disalin 📋");
    hideReactionPicker();
  };

  // DELETE
  const actDelete = document.getElementById("act-delete");
  if (actDelete) actDelete.onclick = function(e) {
    e.preventDefault(); e.stopPropagation();
    showInfo("🗑️ Hapus Pesan",
      '<div style="display:flex; flex-direction:column; gap:10px; padding:10px 0;">' +
      (isMyMsg ? '<button id="del-all" style="padding:12px; background:var(--danger); color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600;">Hapus untuk Semua Orang</button>' : '') +
      '<button id="del-me" style="padding:12px; background:var(--bg-alt); border:1px solid var(--border); color:var(--text); border-radius:8px; cursor:pointer; font-weight:600;">Hapus untuk Saya</button>' +
      '</div>', "Batal");

    setTimeout(function() {
      const delAll = document.getElementById("del-all");
      if (delAll) delAll.onclick = async function() {
        const modal = document.getElementById("info-modal");
        if (modal) modal.classList.add("hidden");
        try {
          if (state.currentChat === "global") await deleteMessage("global", null, msg.id);
          else if (state.currentChat === "dm" && state.dmWithUid) {
            const roomId = getDMRoomId(state.user.uid, state.dmWithUid);
            await deleteMessage("dm", roomId, msg.id);
          }
          showToast("Pesan dihapus untuk semua 🗑️");
        } catch (err) {
          showToast("Gagal hapus: " + err.message);
        }
        hideReactionPicker();
      };
      const delMe = document.getElementById("del-me");
      if (delMe) delMe.onclick = function() {
        const modal = document.getElementById("info-modal");
        if (modal) modal.classList.add("hidden");
        const msgEl = document.querySelector('[data-msg-id="' + msg.id + '"]');
        if (msgEl) {
          const w = msgEl.closest(".msg-wrapper");
          if (w) w.remove();
        }
        showToast("Pesan dihapus untuk Anda");
        hideReactionPicker();
      };
    }, 100);
  };
}

// ========== PINNED BANNER ==========
function renderPinnedBanner() {
  const existing = document.getElementById("pinned-banner");
  if (existing) existing.remove();
  
  const key = "flux_pinned_" + (state.currentChat || "global");
  let pinned = [];
  try { pinned = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  
  if (!pinned.length) return;
  
  const first = pinned[0];
  const banner = document.createElement("div");
  banner.id = "pinned-banner";
  banner.style.cssText = "background:var(--primary-light); border-bottom:1px solid var(--border); padding:8px 14px; font-size:12px; display:flex; align-items:center; gap:8px; flex-shrink:0;";
  banner.innerHTML = '<span style="font-size:14px;">📌</span>' +
    '<div style="flex:1; min-width:0; overflow:hidden;">' +
    '<div style="font-weight:700; color:var(--primary-dark);">' + escapeHtml(first.name || "Pesan disematkan") + '</div>' +
    '<div style="color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml((first.text || "").slice(0, 60)) + '</div>' +
    '</div>' +
    '<button id="unpin-btn" style="background:transparent; border:none; font-size:16px; cursor:pointer; color:var(--text-muted);">✕</button>';
  
  banner.querySelector("#unpin-btn").onclick = function() {
    localStorage.setItem(key, "[]");
    banner.remove();
    showToast("Semua sematan dilepas");
  };
  
  const encBanner = document.querySelector(".chat-encryption-banner");
  if (encBanner && encBanner.parentNode) {
    encBanner.parentNode.insertBefore(banner, encBanner.nextSibling);
  }
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") hideReactionPicker();
});

// ========== SEND MESSAGE ==========
$("chat-input")?.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessageFromInput(); });
$("chat-input")?.addEventListener("input", () => {
  if (state.currentChat === "dm" && state.dmWithUid) {
    setTypingStatus(state.user.uid, state.dmWithUid, true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTypingStatus(state.user.uid, state.dmWithUid, false), 2000);
  }
});

async function sendMessageFromInput() {
  const input = $("chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text && !state.pendingAIImage) return;
  try {
    if (state.currentChat === "ai") {
      const img = state.pendingAIImage;
      input.value = ""; state.pendingAIImage = null; updateAIAttachPreview();
      await sendAIMessage(text, img);
    } else if (state.currentChat === "global") {
      input.value = "";
      const reply = state.replyingTo; state.replyingTo = null; updateReplyBanner();
      await sendGlobalMessage(state.user, { type: "text", text, replyTo: reply });
    } else if (state.currentChat === "dm" && state.dmWithUid) {
      input.value = "";
      const reply = state.replyingTo; state.replyingTo = null; updateReplyBanner();
      await setTypingStatus(state.user.uid, state.dmWithUid, false);
      await sendPrivateMessage(state.user, state.dmWithUid, { type: "text", text }, reply);
    } else {
      showToast("Pilih tujuan chat terlebih dahulu!");
    }
  } catch (err) {
    showToast("Gagal kirim pesan");
    input.value = text;
  }
}

function updateReplyBanner() {
  const banner = $("reply-banner");
  if (!banner) return;
  if (state.replyingTo) {
    banner.style.display = "flex";
    banner.innerHTML = '<div class="reply-info"><div class="reply-label">Membalas ' + escapeHtml(state.replyingTo.name) + '</div><div class="reply-text">' + escapeHtml(state.replyingTo.text) + '</div></div><button id="cancel-reply" class="modal-close">✕</button>';
    const cancelBtn = $("cancel-reply");
    if (cancelBtn) cancelBtn.onclick = () => { state.replyingTo = null; updateReplyBanner(); };
  } else {
    banner.style.display = "none";
    banner.innerHTML = "";
  }
}

// ========== AI CHAT ==========
async function sendAIMessage(text, imageBase64 = null) {
  if (state.isAILoading) return;
  state.isAILoading = true;
  state.lastAiMsgs.push({ role: "user", text, time: Date.now() });
  renderAIMessages();
  const box = $("chat-messages");
  if (!box) { state.isAILoading = false; return; }
  const aiEl = document.createElement("div");
  aiEl.className = "chat-msg other";
  const streamId = "stream-" + Date.now();
  aiEl.innerHTML = '<span class="msg-text" id="' + streamId + '">...</span><span class="msg-time">' + formatTime(new Date()) + '</span>';
  box.appendChild(aiEl);
  box.scrollTop = box.scrollHeight;
  const streamEl = aiEl.querySelector("#" + streamId);
  let firstChunk = true;
  let fullText = "";
  try {
    await sendToAI(text, (delta, full) => {
      if (firstChunk) { streamEl.textContent = ""; firstChunk = false; }
      streamEl.textContent = full;
      fullText = full;
      box.scrollTop = box.scrollHeight;
    }, imageBase64);
    state.lastAiMsgs.push({ role: "ai", text: fullText, time: Date.now() });
    renderAIMessages();
  } catch (err) {
    streamEl.textContent = "⚠️ " + err.message;
    streamEl.style.color = "var(--danger)";
    state.lastAiMsgs.push({ role: "ai", text: "⚠️ " + err.message, time: Date.now() });
  }
  state.isAILoading = false;
}

function updateAIAttachPreview() {
  const prev = $("ai-attach-preview");
  if (!prev) return;
  if (state.pendingAIImage) {
    prev.style.display = "flex";
    prev.innerHTML = '<span>📷 Gambar terlampir</span> <button id="remove-ai-img" style="background:none;border:none;color:red;cursor:pointer;margin-left:auto;">✕</button>';
    $("remove-ai-img").onclick = () => { state.pendingAIImage = null; updateAIAttachPreview(); };
  } else {
    prev.style.display = "none";
    prev.innerHTML = "";
  }
}

// ========== STICKER ==========
function renderStickerPicker(category) {
  const grid = $("sticker-picker-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const s of (STICKERS[category] || [])) {
    const cell = document.createElement("div");
    cell.className = "sticker-pick-cell";
    cell.textContent = s;
    cell.addEventListener("click", () => {
      sendSticker(s);
      $("sticker-picker")?.classList.add("hidden");
    });
    grid.appendChild(cell);
  }
}

async function sendSticker(sticker) {
  try {
    if (state.currentChat === "global") await sendGlobalMessage(state.user, { type: "sticker", sticker });
    else if (state.currentChat === "dm" && state.dmWithUid) await sendPrivateMessage(state.user, state.dmWithUid, { type: "sticker", sticker });
    else if (state.currentChat === "ai") await sendAIMessage(sticker);
  } catch (err) { showToast("Gagal kirim stiker"); }
}

$$(".sticker-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".sticker-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    renderStickerPicker(tab.dataset.tab);
  });
});

$("sticker-picker-close")?.addEventListener("click", () => $("sticker-picker")?.classList.add("hidden"));
$("chat-emoji")?.addEventListener("click", () => {
  renderStickerPicker("emoji");
  $("sticker-picker")?.classList.remove("hidden");
});

// ========== ATTACHMENT ==========
$("chat-attach")?.addEventListener("click", () => $("attachment-popup")?.classList.remove("hidden"));
$("attachment-close")?.addEventListener("click", () => $("attachment-popup")?.classList.add("hidden"));

$$(".att-item").forEach(item => {
  item.addEventListener("click", async () => {
    const type = item.dataset.type;
    $("attachment-popup")?.classList.add("hidden");
    if (type === "location") {
      if (!navigator.geolocation) { showToast("GPS tidak didukung"); return; }
      showToast("Mengambil lokasi GPS...");
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const payload = { type: "location", lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (state.currentChat === "global") await sendGlobalMessage(state.user, payload);
        else if (state.currentChat === "dm" && state.dmWithUid) await sendPrivateMessage(state.user, state.dmWithUid, payload);
        showToast("Live location terkirim 📍");
      }, () => showToast("Gagal mengambil lokasi"));
    } else if (type === "contact") {
      const contactName = prompt("Nama kontak:");
      const contactUid = prompt("UID kontak:");
      if (!contactName || !contactUid) return;
      const payload = { type: "contact", contactName, contactUid };
      if (state.currentChat === "global") await sendGlobalMessage(state.user, payload);
      else if (state.currentChat === "dm" && state.dmWithUid) await sendPrivateMessage(state.user, state.dmWithUid, payload);
      showToast("Kontak terkirim 📇");
    } else if (type === "ai" && state.currentChat === "ai") {
      const fi = document.createElement("input"); fi.type = "file"; fi.accept = "image/*";
      fi.onchange = async (ev) => {
        state.pendingAIImage = await compressImage(ev.target.files[0], 600);
        updateAIAttachPreview();
        showToast("Gambar siap dianalisis AI 📷");
      };
      fi.click();
    } else {
      showToast("Fitur " + type + " segera hadir");
    }
  });
});

$("chat-gif")?.addEventListener("click", () => showToast("GIF segera hadir"));

// ========== GLOBAL & DM LISTENERS ==========
function setupChatListeners() {
  if (state.globalUnsub) state.globalUnsub();
  state.globalUnsub = listenGlobalMessages((msgs) => {
    state.lastGlobalMsgs = msgs || [];
    const preview = $("global-preview");
    if (preview && state.lastGlobalMsgs.length > 0) {
      const last = state.lastGlobalMsgs[state.lastGlobalMsgs.length - 1];
      preview.textContent = (last.name || "Anonim") + ": " + (last.text || (last.sticker ? "Stiker" : ""));
    }
    if (state.currentChat === "global") renderGlobalMessages(state.lastGlobalMsgs);
  });
}

function initIncomingChatListener() {
  if (!state.user) return;
  if (state.incomingDmUnsub) state.incomingDmUnsub();
  const q = query(collection(db, "chats_dm"));
  state.incomingDmUnsub = onSnapshot(q, async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added" || change.type === "modified") {
        const pathSegments = change.doc.ref.path.split("/");
        if (pathSegments.length >= 2) {
          const roomId = pathSegments[1];
          if (roomId.includes(state.user.uid)) {
            const uids = roomId.split("_");
            const senderUid = uids.find(u => u !== state.user.uid);
            if (senderUid && senderUid !== state.user.uid) {
              const unread = (state.currentChat === "dm" && state.dmWithUid === senderUid) ? 0 : 1;
              const targetUser = await getUserProfileByUid(senderUid);
              if (targetUser) addPrivateChatToList(targetUser, unread);
            }
          }
        }
      }
    });
  }, (err) => console.error("Incoming DM error:", err));
}

// ========== NEW CHAT ==========
$("btn-new-chat")?.addEventListener("click", () => $("new-chat-modal")?.classList.remove("hidden"));
$("new-chat-cancel")?.addEventListener("click", () => $("new-chat-modal")?.classList.add("hidden"));

$("new-chat-start")?.addEventListener("click", async () => {
  const qStr = $("new-chat-email")?.value.trim();
  if (!qStr) return;
  const target = await findUserByNumericUidOrEmail(qStr);
  if (!target) { showToast("User tidak ditemukan"); return; }
  if (target.uid === state.user.uid) { showToast("Nggak bisa chat diri sendiri"); return; }
  $("new-chat-modal")?.classList.add("hidden");
  if ($("new-chat-email")) $("new-chat-email").value = "";
  addPrivateChatToList(target, 0);
  openChatDetail("dm", target);
});

function addPrivateChatToList(targetUser, unreadCount = 0) {
  const list = $("private-list-tk");
  if (!list) return;
  let el = list.querySelector('[data-uid="' + targetUser.uid + '"]');
  const initial = (targetUser.displayName || "U").charAt(0).toUpperCase();
  const avatarStyle = targetUser.photoURL && targetUser.photoURL.length > 10 ? "background-image:url(" + targetUser.photoURL + ");" : "";
  const badgeHtml = unreadCount > 0
    ? '<div style="background:#25D366; color:#fff; border-radius:50%; min-width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; padding:0 6px;">' + unreadCount + '</div>'
    : '<div class="tk-chat-preview">UID: ' + (targetUser.numericUid || "-") + '</div>';
  if (el) {
    const metaEl = el.querySelector(".tk-chat-meta");
    if (metaEl) metaEl.innerHTML = badgeHtml;
    return;
  }
  const empty = list.querySelector(".tk-empty");
  if (empty) empty.remove();
  el = document.createElement("div");
  el.className = "tk-chat-item";
  el.dataset.uid = targetUser.uid;
  el.innerHTML = '<div class="tk-avatar" style="' + avatarStyle + '"><span>' + (targetUser.photoURL && targetUser.photoURL.length > 10 ? "" : initial) + '</span><div class="tk-online-dot"></div></div>' +
    '<div class="tk-chat-info"><div class="tk-chat-name">' + escapeHtml(targetUser.displayName || targetUser.email) + ' <span class="tk-verified">✓</span></div>' +
    '<div class="tk-chat-preview">UID: ' + (targetUser.numericUid || "-") + '</div></div>' +
    '<div class="tk-chat-meta">' + badgeHtml + '</div>';
  el.addEventListener("click", () => {
    addPrivateChatToList(targetUser, 0);
    openChatDetail("dm", targetUser);
  });
  list.appendChild(el);
}

// ========== PROFILE EDIT ==========
function openProfileModal() {
  const p = state.profile || {};
  if ($("edit-name")) $("edit-name").value = p.displayName || "";
  if ($("edit-bio")) $("edit-bio").value = p.bio || "";
  const preview = $("edit-avatar-preview");
  const letter = $("edit-avatar-letter");
  if (preview && letter) {
    if (p.photoURL && p.photoURL.length > 10) {
      preview.style.backgroundImage = "url(" + p.photoURL + ")";
      letter.style.display = "none";
    } else {
      preview.style.backgroundImage = "";
      letter.style.display = "block";
      letter.textContent = (p.displayName || "U").charAt(0).toUpperCase();
    }
  }
  const banner = $("edit-banner-preview");
  if (banner) banner.style.backgroundImage = (p.bannerURL && p.bannerURL.length > 10) ? "url(" + p.bannerURL + ")" : "";
  state.pendingAvatarFile = null;
  state.pendingBannerFile = null;
  $("profile-modal")?.classList.remove("hidden");
}

$("btn-edit-profile-header")?.addEventListener("click", openProfileModal);
$("btn-edit-avatar")?.addEventListener("click", openProfileModal);
$("btn-edit-banner")?.addEventListener("click", openProfileModal);
$("menu-about-me")?.addEventListener("click", openProfileModal);

$("btn-pick-avatar")?.addEventListener("click", () => $("file-avatar")?.click());
$("file-avatar")?.addEventListener("change", (e) => {
  const file = e.target.files[0]; if (!file) return;
  state.pendingAvatarFile = file;
  const r = new FileReader();
  r.onload = (ev) => {
    const preview = $("edit-avatar-preview");
    if (preview) preview.style.backgroundImage = "url(" + ev.target.result + ")";
    if ($("edit-avatar-letter")) $("edit-avatar-letter").style.display = "none";
  };
  r.readAsDataURL(file);
});

$("btn-pick-banner")?.addEventListener("click", () => $("file-banner")?.click());
$("file-banner")?.addEventListener("change", (e) => {
  const file = e.target.files[0]; if (!file) return;
  state.pendingBannerFile = file;
  const r = new FileReader();
  r.onload = (ev) => {
    const preview = $("edit-banner-preview");
    if (preview) preview.style.backgroundImage = "url(" + ev.target.result + ")";
  };
  r.readAsDataURL(file);
});

$("profile-cancel")?.addEventListener("click", () => {
  $("profile-modal")?.classList.add("hidden");
  state.pendingAvatarFile = null;
  state.pendingBannerFile = null;
});

$("profile-save")?.addEventListener("click", async () => {
  const name = $("edit-name")?.value.trim();
  const bio = $("edit-bio")?.value.trim() || "";
  const saveBtn = $("profile-save");
  if (!name) { showToast("Nama tidak boleh kosong"); return; }
  saveBtn.disabled = true; saveBtn.textContent = "...";
  try {
    let avatarURL = state.profile?.photoURL || null;
    let bannerURL = state.profile?.bannerURL || null;
    if (state.pendingAvatarFile) avatarURL = await compressImage(state.pendingAvatarFile, 250);
    if (state.pendingBannerFile) bannerURL = await compressImage(state.pendingBannerFile, 700);
    await updateUserProfile(state.user, { displayName: name, bio, photoURL: avatarURL, bannerURL });
    state.profile = await getUserProfile(state.user.uid);
    updateProfileUI();
    $("profile-modal")?.classList.add("hidden");
    state.pendingAvatarFile = null; state.pendingBannerFile = null;
    showToast("Profil tersimpan ✅");
  } catch (err) {
    showToast("Gagal simpan: " + err.message);
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = "Simpan";
  }
});

// ========== THEME PICKER ==========
$("menu-theme")?.addEventListener("click", () => $("theme-modal")?.classList.remove("hidden"));
$("theme-modal-close")?.addEventListener("click", () => $("theme-modal")?.classList.add("hidden"));
$$(".theme-option").forEach(opt => {
  opt.addEventListener("click", () => {
    const theme = opt.dataset.theme;
    applyTheme(theme);
    showToast("Tema: " + THEMES[theme].name);
    setTimeout(() => $("theme-modal")?.classList.add("hidden"), 250);
  });
});

// ========== WALLPAPER ==========
function getWallpaperKey() { return "flux_wallpaper_" + (state.user?.uid || "guest"); }
function getSavedWallpaper() {
  try { const raw = localStorage.getItem(getWallpaperKey()); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function applyWallpaper(wp) {
  const box = $("chat-messages");
  if (!box) return;
  if (!wp || (wp.type === "preset" && !wp.value)) {
    box.style.background = ""; box.style.backgroundImage = "";
    box.classList.remove("has-wallpaper");
    return;
  }
  box.classList.add("has-wallpaper");
  if (wp.type === "preset") { box.style.backgroundImage = "none"; box.style.background = wp.value; }
  else if (wp.type === "image") { box.style.background = ""; box.style.backgroundImage = "url(" + wp.value + ")"; }
}
function loadWallpaper() { const saved = getSavedWallpaper(); if (saved) applyWallpaper(saved); }

function updateWallpaperPreview() {
  $$(".wallpaper-preset").forEach(el => {
    let isActive = false;
    if (!state.pendingWallpaper) isActive = el.dataset.preset === "default";
    else if (state.pendingWallpaper.type === "preset") {
      const key = Object.keys(WALLPAPER_PRESETS).find(k => WALLPAPER_PRESETS[k] === state.pendingWallpaper.value);
      isActive = el.dataset.preset === key;
    }
    el.classList.toggle("active", isActive);
  });
}

$("menu-wallpaper")?.addEventListener("click", () => {
  state.pendingWallpaper = getSavedWallpaper();
  updateWallpaperPreview();
  $("wallpaper-modal")?.classList.remove("hidden");
});
$("wallpaper-close")?.addEventListener("click", () => {
  $("wallpaper-modal")?.classList.add("hidden");
  state.pendingWallpaper = null;
});
$("wallpaper-upload")?.addEventListener("click", () => $("wallpaper-file")?.click());
$("wallpaper-file")?.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const compressed = await compressImage(file, 600);
    state.pendingWallpaper = { type: "image", value: compressed };
    updateWallpaperPreview();
    showToast("Gambar siap disimpan");
  } catch { showToast("Gagal baca gambar"); }
  e.target.value = "";
});
$$(".wallpaper-preset").forEach(el => {
  el.addEventListener("click", () => {
    state.pendingWallpaper = { type: "preset", value: WALLPAPER_PRESETS[el.dataset.preset] };
    updateWallpaperPreview();
  });
});
$("wallpaper-reset")?.addEventListener("click", () => {
  state.pendingWallpaper = null;
  localStorage.removeItem(getWallpaperKey());
  applyWallpaper(null);
  updateWallpaperPreview();
  showToast("Wallpaper direset");
});
$("wallpaper-save")?.addEventListener("click", () => {
  try {
    if (state.pendingWallpaper) {
      localStorage.setItem(getWallpaperKey(), JSON.stringify(state.pendingWallpaper));
      applyWallpaper(state.pendingWallpaper);
      showToast("Wallpaper tersimpan ✅");
    } else {
      localStorage.removeItem(getWallpaperKey());
      applyWallpaper(null);
    }
    $("wallpaper-modal")?.classList.add("hidden");
    state.pendingWallpaper = null;
  } catch { showToast("Gagal simpan"); }
});

// ========== SETTINGS MENUS ==========
$("menu-username")?.addEventListener("click", () => {
  const uid = $("profile-uid")?.textContent || "";
  navigator.clipboard?.writeText(uid);
  showToast("UID disalin: " + uid);
});
$("menu-privacy")?.addEventListener("click", () => showInfo("🔒 Privasi", '<div class="info-row">✅ Chat pribadi terenkripsi Firebase</div><div class="info-row">✅ AI tidak menyimpan history di server</div>'));
$("menu-security")?.addEventListener("click", () => showInfo("🛡️ Keamanan", '<div class="info-row">🔐 Login dengan Firebase Auth</div><div class="info-row">📱 Perangkat aktif: 1</div>'));
$("menu-storage")?.addEventListener("click", () => {
  const cache = JSON.stringify(localStorage).length;
  showInfo("📦 Penyimpanan", '<div class="info-row"><b>Cache lokal:</b> ~' + (cache / 1024).toFixed(1) + ' KB</div><div class="info-row"><b>Profile:</b> tersimpan di Firestore</div>', "Bersihkan Cache AI", () => {
    resetAIChat();
    state.lastAiMsgs = [];
    showToast("Cache AI dibersihkan");
  });
});
$("menu-about")?.addEventListener("click", () => showInfo("📱 Tentang FluxChat",
  '<div style="text-align:center;margin-bottom:16px;"><div style="font-size:48px;">F</div><div style="font-weight:700;font-size:18px;margin-top:8px;">FluxChat & FluxAI</div><div style="font-size:12px;color:var(--text-muted);">Versi 1.5.0</div></div>' +
  '<div class="info-row">🤖 <b>Model:</b> ' + (GEMINI_MODEL || "-") + '</div><div class="info-row">🔥 <b>Backend:</b> Firebase</div>'));
$("btn-logout")?.addEventListener("click", () => {
  showInfo("🚪 Keluar", '<div class="info-row">Yakin mau logout dari akun kamu?</div>', "Ya, Keluar", async () => { await logoutUser(); });
});
$("info-modal-close")?.addEventListener("click", () => $("info-modal")?.classList.add("hidden"));

// ========== MINI GAME ==========
const GAME_KEY = "flux_game_data";
const GAME_DURATION = 30;
const gameState = { playing: false, score: 0, startTime: 0, timerId: null, tapCooldown: false };

function getGameData() {
  try { return JSON.parse(localStorage.getItem(GAME_KEY) || "") || { highScore: 0, plays: 0 }; }
  catch { return { highScore: 0, plays: 0 }; }
}
function saveGameData(d) { try { localStorage.setItem(GAME_KEY, JSON.stringify(d)); } catch {} }
function updateGameStatsUI() {
  const data = getGameData();
  if (typeof data.highScore !== "number") data.highScore = 0;
  if (typeof data.plays !== "number") data.plays = 0;
  if ($("game-high-score")) $("game-high-score").textContent = data.highScore;
  if ($("game-total-plays")) $("game-total-plays").textContent = data.plays;
}

function startGame() {
  if (gameState.playing) return;
  gameState.playing = true;
  gameState.score = 0;
  gameState.startTime = Date.now();
  gameState.tapCooldown = false;
  $("game-overlay")?.classList.remove("hidden");
  $("game-over-modal")?.classList.add("hidden");
  if ($("game-score-live")) $("game-score-live").textContent = "0";
  if ($("game-timer")) $("game-timer").textContent = "30.0";
  clearInterval(gameState.timerId);
  gameState.timerId = setInterval(() => {
    if (!gameState.playing) return;
    const elapsed = (Date.now() - gameState.startTime) / 1000;
    const timeLeft = Math.max(0, GAME_DURATION - elapsed);
    if ($("game-timer")) $("game-timer").textContent = timeLeft.toFixed(1);
    if (timeLeft <= 0) endGame();
  }, 50);
}

function handleTap() {
  if (!gameState.playing || gameState.tapCooldown) return;
  gameState.tapCooldown = true;
  setTimeout(() => { gameState.tapCooldown = false; }, 30);
  gameState.score++;
  if ($("game-score-live")) $("game-score-live").textContent = gameState.score;
  const target = $("game-tap-target");
  if (target) { target.classList.add("tapped"); setTimeout(() => target.classList.remove("tapped"), 150); }
}

function endGame() {
  if (!gameState.playing) return;
  gameState.playing = false;
  clearInterval(gameState.timerId);
  const finalScore = gameState.score;
  const data = getGameData();
  if (typeof data.highScore !== "number") data.highScore = 0;
  if (typeof data.plays !== "number") data.plays = 0;
  const isNewHigh = finalScore > data.highScore;
  data.plays++;
  if (isNewHigh) data.highScore = finalScore;
  saveGameData(data);
  $("game-overlay")?.classList.add("hidden");
  $("game-over-modal")?.classList.remove("hidden");
  if ($("game-over-score")) $("game-over-score").textContent = finalScore;
  if ($("game-over-title")) $("game-over-title").textContent = isNewHigh ? "🎉 REKOR BARU!" : "SELESAI!";
  updateGameStatsUI();
}

$("btn-play-game")?.addEventListener("click", startGame);
$("game-tap-target")?.addEventListener("touchstart", (e) => { e.preventDefault(); handleTap(); }, { passive: false });
$("game-tap-target")?.addEventListener("mousedown", handleTap);
$("game-close")?.addEventListener("click", () => {
  if (gameState.playing && !confirm("Keluar? Skor hilang.")) return;
  gameState.playing = false;
  clearInterval(gameState.timerId);
  $("game-overlay")?.classList.add("hidden");
});
$("game-over-again")?.addEventListener("click", () => { $("game-over-modal")?.classList.add("hidden"); startGame(); });
$("game-over-home")?.addEventListener("click", () => $("game-over-modal")?.classList.add("hidden"));

updateGameStatsUI();

// ========== STORY SYSTEM ==========
function initStories() {
  if (state.storiesUnsub) state.storiesUnsub();
  state.storiesUnsub = listenStories((stories) => {
    state.storiesList = stories || [];
    renderStoryBar();
    renderStoryContent();
  });
}

function renderStoryBar() {
  const list = $("story-list-tk");
  if (!list) return;
  list.innerHTML = "";
  const byUser = {};
  for (const s of state.storiesList) {
    if (!byUser[s.uid]) byUser[s.uid] = [];
    byUser[s.uid].push(s);
  }
  const orderedUids = Object.keys(byUser).sort((a, b) => {
    if (a === state.user?.uid) return -1;
    if (b === state.user?.uid) return 1;
    return 0;
  });
  for (const uid of orderedUids) {
    if (uid === state.user?.uid) continue;
    const userStories = byUser[uid];
    userStories.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const first = userStories[0];
    const initial = (first.name || "U").charAt(0).toUpperCase();
    const allSeen = userStories.every(s => viewedStories.has(s.id));
    const latestTime = first.createdAt?.toDate?.() || new Date();
    const ageMin = Math.floor((Date.now() - latestTime.getTime()) / 60000);
    const ageText = ageMin < 60 ? ageMin + "m" : Math.floor(ageMin / 60) + "j";
    const el = document.createElement("div");
    el.className = "story-item-tk" + (allSeen ? " seen" : "");
    el.innerHTML = '<div class="story-ring-tk"><div class="story-avatar-tk" style="' + (first.photoURL && first.photoURL.length > 10 ? "background-image:url(" + first.photoURL + ");" : "") + '">' + (first.photoURL && first.photoURL.length > 10 ? "" : initial) + '</div></div>' +
      '<span>' + escapeHtml(first.name || "User") + ' · ' + ageText + '</span>';
    el.onclick = () => openStoryViewer(uid);
    list.appendChild(el);
  }
}

function renderStoryContent() {
  const content = $("story-content-tk");
  if (!content) return;
  if (state.storiesList.length === 0) {
    content.innerHTML = '<div class="tk-empty"><div class="tk-empty-icon">📖</div><p>Belum ada story</p><span>Tap + di atas untuk posting story</span></div>';
    return;
  }
  const myStories = state.storiesList.filter(s => s.uid === state.user.uid);
  const others = state.storiesList.filter(s => s.uid !== state.user.uid);
  let html = "";
  if (myStories.length > 0) {
    html += '<div style="padding: 12px 4px 8px; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Story Kamu</div>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px;">';
    for (const s of myStories) {
      html += '<div style="position:relative; aspect-ratio: 9/16; border-radius: 12px; overflow: hidden; background: url(' + s.imageBase64 + '); background-size: cover; background-position: center; cursor: pointer;" data-story-id="' + s.id + '"><div style="position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer;" class="story-delete" data-id="' + s.id + '">✕</div></div>';
    }
    html += '</div>';
  }
  if (others.length > 0) {
    html += '<div style="padding: 12px 4px 8px; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Story Terbaru</div>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">';
    for (const s of others) {
      html += '<div style="position:relative; aspect-ratio: 9/16; border-radius: 12px; overflow: hidden; background: url(' + s.imageBase64 + '); background-size: cover; background-position: center; cursor: pointer;" data-uid="' + s.uid + '"><div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: #fff; font-size: 10px; font-weight: 600;">' + escapeHtml(s.name) + '</div></div>';
    }
    html += '</div>';
  }
  content.innerHTML = html;
  content.querySelectorAll(".story-delete").forEach(el => {
    el.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Hapus story ini?")) return;
      try { await deleteStory(el.dataset.id); showToast("Story dihapus"); }
      catch { showToast("Gagal hapus"); }
    };
  });
  content.querySelectorAll("[data-story-id]").forEach(el => {
    el.onclick = (e) => { if (e.target.closest(".story-delete")) return; openStoryViewer(state.user.uid); };
  });
  content.querySelectorAll("[data-uid]").forEach(el => {
    el.onclick = () => openStoryViewer(el.dataset.uid);
  });
}

function openStoryViewer(uid) {
  state.currentStoryUid = uid;
  state.currentStoryUserList = state.storiesList.filter(s => s.uid === uid);
  if (state.currentStoryUserList.length === 0) return;
  state.currentStoryIndex = 0;
  $("story-viewer-tk")?.classList.remove("hidden");
  renderCurrentStory();
}

function renderCurrentStory() {
  const story = state.currentStoryUserList[state.currentStoryIndex];
  if (!story) { closeStoryViewer(); return; }
  const avatarEl = $("story-viewer-avatar");
  const nameEl = $("story-viewer-name");
  const timeEl = $("story-viewer-time");
  const imageEl = $("story-viewer-image");
  const captionEl = $("story-viewer-caption");
  const created = story.createdAt?.toDate?.() || new Date();
  const ageMin = Math.floor((Date.now() - created.getTime()) / 60000);
  const ageText = ageMin < 1 ? "Baru saja" : ageMin < 60 ? ageMin + " menit lalu" : Math.floor(ageMin / 60) + " jam lalu";
  const initial = (story.name || "U").charAt(0).toUpperCase();
  if (avatarEl) {
    avatarEl.textContent = story.photoURL && story.photoURL.length > 10 ? "" : initial;
    avatarEl.style.backgroundImage = story.photoURL && story.photoURL.length > 10 ? "url(" + story.photoURL + ")" : "";
  }
  if (nameEl) nameEl.textContent = story.name || "User";
  if (timeEl) timeEl.textContent = ageText;
  if (imageEl) imageEl.src = story.imageBase64;
  if (captionEl) captionEl.textContent = story.caption || "";
  viewedStories.add(story.id);
  saveViewedStories();
  const progressWrap = $("story-progress-wrap");
  if (progressWrap) {
    progressWrap.innerHTML = "";
    state.currentStoryUserList.forEach((_, i) => {
      const bar = document.createElement("div");
      bar.className = "story-viewer-progress";
      if (i < state.currentStoryIndex) bar.style.transform = "scaleX(1)";
      else if (i === state.currentStoryIndex) bar.classList.add("active");
      progressWrap.appendChild(bar);
    });
  }
  clearTimeout(state.storyTimer);
  state.storyTimer = setTimeout(() => nextStory(), 5000);
}

function nextStory() {
  state.currentStoryIndex++;
  if (state.currentStoryIndex >= state.currentStoryUserList.length) closeStoryViewer();
  else renderCurrentStory();
}
function prevStory() {
  state.currentStoryIndex--;
  if (state.currentStoryIndex < 0) state.currentStoryIndex = 0;
  renderCurrentStory();
}
function closeStoryViewer() {
  $("story-viewer-tk")?.classList.add("hidden");
  clearTimeout(state.storyTimer);
  renderStoryBar();
}

$("btn-add-story-tk")?.addEventListener("click", () => {
  state.pendingStoryImage = null;
  if ($("create-story-caption")) $("create-story-caption").value = "";
  const prev = $("create-story-preview");
  if (prev) {
    prev.style.backgroundImage = "";
    prev.innerHTML = '<div class="create-story-placeholder"><div class="csp-icon">📷</div><div>Tap untuk pilih foto</div></div>';
  }
  $("create-story-modal")?.classList.remove("hidden");
});
$("create-story-cancel")?.addEventListener("click", () => { $("create-story-modal")?.classList.add("hidden"); state.pendingStoryImage = null; });
$("create-story-preview")?.addEventListener("click", () => $("create-story-file")?.click());
$("create-story-file")?.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const compressed = await compressImage(file, 600);
    state.pendingStoryImage = compressed;
    const prev = $("create-story-preview");
    if (prev) { prev.innerHTML = ""; prev.style.backgroundImage = "url(" + compressed + ")"; }
  } catch { showToast("Gagal baca gambar"); }
  e.target.value = "";
});
$("create-story-post")?.addEventListener("click", async () => {
  if (!state.pendingStoryImage) { showToast("Pilih foto dulu"); return; }
  const caption = $("create-story-caption")?.value.trim() || "";
  const btn = $("create-story-post");
  btn.disabled = true; btn.textContent = "...";
  try {
    const myStories = state.storiesList.filter(s => s.uid === state.user.uid);
    if (myStories.length >= 3) { showToast("Maksimal 3 story per 24 jam"); return; }
    await createStory(state.user, { imageBase64: state.pendingStoryImage, caption });
    $("create-story-modal")?.classList.add("hidden");
    state.pendingStoryImage = null;
    showToast("Story posted ✅");
  } catch (err) { showToast("Gagal post: " + err.message); }
  finally { btn.disabled = false; btn.textContent = "Post"; }
});
$("story-viewer-close")?.addEventListener("click", closeStoryViewer);
$("story-nav-prev")?.addEventListener("click", prevStory);
$("story-nav-next")?.addEventListener("click", nextStory);

// ========== VOICE RECORDER ==========
const btnRecord = $("btn-record");
const btnStopRecord = $("btn-stop-record");
const btnCancelVoice = $("btn-cancel-voice");
const btnSendVoice = $("btn-send-voice");
const recordingUI = $("recording-ui");
const voicePreview = $("voice-preview");
const recordingTimer = $("recording-timer");
const previewDuration = $("preview-duration");

btnRecord?.addEventListener("click", async () => {
  try {
    const success = await startRecording();
    if (success !== false) {
      recordingUI?.classList.remove("hidden");
      btnRecord.classList.add("hidden");
    }
  } catch (err) { console.error("startRecording error:", err); }
});

window.addEventListener("recordingTick", (e) => {
  if (recordingTimer) {
    const s = e.detail;
    recordingTimer.textContent = Math.floor(s / 60) + ":" + (s % 60).toString().padStart(2, "0");
  }
});

btnStopRecord?.addEventListener("click", async () => {
  const result = await stopRecording();
  recordingUI?.classList.add("hidden");
  if (result) {
    currentAudioData = result;
    if (previewDuration) previewDuration.textContent = Math.floor(result.duration / 60) + ":" + (result.duration % 60).toString().padStart(2, "0");
    voicePreview?.classList.remove("hidden");
    btnRecord.classList.add("hidden");
  }
});

btnCancelVoice?.addEventListener("click", () => {
  currentAudioData = null;
  voicePreview?.classList.add("hidden");
  cancelRecording();
  btnRecord?.classList.remove("hidden");
});

btnSendVoice?.addEventListener("click", async () => {
  if (!currentAudioData) return;
  try {
    const payload = { type: "voice", audioBase64: currentAudioData.base64, duration: currentAudioData.duration };
    if (state.currentChat === "global") await sendGlobalMessage(state.user, payload);
    else if (state.currentChat === "dm" && state.dmWithUid) await sendPrivateMessage(state.user, state.dmWithUid, payload);
    else if (state.currentChat === "ai") { showToast("Voice message ke AI belum didukung"); return; }
    currentAudioData = null;
    voicePreview?.classList.add("hidden");
    btnRecord?.classList.remove("hidden");
    showToast("Voice note terkirim ✅");
  } catch { showToast("Gagal kirim voice note"); }
});

$("audio-player-close")?.addEventListener("click", () => {
  const audioEl = $("audio-player");
  if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
  $("audio-player-modal")?.classList.add("hidden");
});

// ========== FRIEND SYSTEM ==========
function initFriends() {
  if (!state.user) return;
  if (frUnsub) frUnsub();
  frUnsub = listenFriendships(state.user.uid, (friends, requests, sent) => {
    frFriends = friends || [];
    frRequests = requests || [];
    frSentRequests = sent || [];
    renderFriendsList();
    renderRequestsList();
    updateFriendBadges();
  });
}

async function renderFriendsList() {
  const list = $("fr-friends-list");
  if (!list) return;
  if (frFriends.length === 0) {
    list.innerHTML = '<div class="tk-empty"><div class="tk-empty-icon">👥</div><p>Belum ada teman</p><span>Tap ➕ untuk tambah teman</span></div>';
    return;
  }
  const uids = frFriends.map(f => f.otherUid);
  const profiles = await getUsersProfiles(uids);
  const map = {};
  profiles.forEach(p => map[p.uid] = p);
  list.innerHTML = "";
  for (const fr of frFriends) {
    const p = map[fr.otherUid];
    if (!p) continue;
    const name = p.displayName || "User";
    const initial = name.charAt(0).toUpperCase();
    const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
    const isOnline = p.lastSeen ? (Date.now() - (p.lastSeen.toDate?.().getTime() || 0)) < 5 * 60 * 1000 : false;
    const el = document.createElement("div");
    el.className = "fr-item";
    el.innerHTML = '<div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL && p.photoURL.length > 10 ? "" : initial) + '<div class="' + (isOnline ? "fr-online-dot" : "fr-offline-dot") + '"></div></div>' +
      '<div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">UID: ' + (p.numericUid || "-") + ' · ' + (isOnline ? "Online" : "Offline") + '</div></div>' +
      '<button class="fr-btn fr-btn-primary" data-action="chat">Chat</button>' +
      '<button class="fr-btn fr-btn-danger" data-action="remove">Hapus</button>';
    el.querySelector('[data-action="chat"]').onclick = (e) => {
      e.stopPropagation();
      openChatDetail("dm", { uid: p.uid, displayName: name, email: p.email, photoURL: p.photoURL, numericUid: p.numericUid });
    };
    el.querySelector('[data-action="remove"]').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Hapus " + name + " dari teman?")) return;
      const ok = await removeFriend(state.user.uid, p.uid);
      showToast(ok ? "Teman dihapus" : "Gagal hapus");
    };
    el.onclick = () => openChatDetail("dm", { uid: p.uid, displayName: name, email: p.email, photoURL: p.photoURL, numericUid: p.numericUid });
    list.appendChild(el);
  }
}

async function renderRequestsList() {
  const list = $("fr-requests-list");
  if (!list) return;
  if (frRequests.length === 0 && frSentRequests.length === 0) {
    list.innerHTML = '<div class="tk-empty"><div class="tk-empty-icon">📨</div><p>Belum ada request</p><span>Request dari user lain bakal muncul di sini</span></div>';
    return;
  }
  let html = "";
  if (frRequests.length > 0) {
    html += '<div class="tk-section-label">Request Masuk</div>';
    for (const req of frRequests) {
      const p = await getUserProfileByUid(req.otherUid);
      if (!p) continue;
      const name = p.displayName || "User";
      const initial = name.charAt(0).toUpperCase();
      const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
      html += '<div class="fr-item" data-uid="' + p.uid + '"><div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL && p.photoURL.length > 10 ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">UID: ' + (p.numericUid || "-") + '</div></div><button class="fr-btn fr-btn-primary" data-action="accept">✓</button><button class="fr-btn fr-btn-danger" data-action="reject">✕</button></div>';
    }
  }
  if (frSentRequests.length > 0) {
    html += '<div class="tk-section-label" style="margin-top:16px;">Request Terkirim</div>';
    for (const req of frSentRequests) {
      const p = await getUserProfileByUid(req.otherUid);
      if (!p) continue;
      const name = p.displayName || "User";
      const initial = name.charAt(0).toUpperCase();
      const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
      html += '<div class="fr-item" data-uid="' + p.uid + '"><div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL && p.photoURL.length > 10 ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">Menunggu konfirmasi...</div></div><button class="fr-btn fr-btn-ghost" data-action="cancel">Batal</button></div>';
    }
  }
  list.innerHTML = html;
  list.querySelectorAll('[data-action="accept"]').forEach(btn => {
    btn.onclick = async (e) => { e.stopPropagation(); const uid = btn.closest(".fr-item").dataset.uid; const ok = await acceptFriendRequest(state.user.uid, uid); showToast(ok ? "Teman ditambah ✅" : "Gagal"); };
  });
  list.querySelectorAll('[data-action="reject"]').forEach(btn => {
    btn.onclick = async (e) => { e.stopPropagation(); const uid = btn.closest(".fr-item").dataset.uid; const ok = await rejectFriendRequest(state.user.uid, uid); showToast(ok ? "Request ditolak" : "Gagal"); };
  });
  list.querySelectorAll('[data-action="cancel"]').forEach(btn => {
    btn.onclick = async (e) => { e.stopPropagation(); const uid = btn.closest(".fr-item").dataset.uid; const ok = await removeFriend(state.user.uid, uid); showToast(ok ? "Request dibatalkan" : "Gagal"); };
  });
}

function updateFriendBadges() {
  const badge = $("fr-requests-badge");
  if (!badge) return;
  if (frRequests.length > 0) { badge.textContent = frRequests.length; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

$$(".fr-subtab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".fr-subtab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    frSubTab = tab.dataset.fr;
    $$(".fr-panel").forEach(p => p.classList.remove("active"));
    const target = document.querySelector('.fr-panel[data-fr-panel="' + frSubTab + '"]');
    if (target) target.classList.add("active");
  });
});

$("btn-add-friend")?.addEventListener("click", () => {
  $("fr-add-modal")?.classList.remove("hidden");
  if ($("fr-add-input")) $("fr-add-input").value = "";
  if ($("fr-add-result")) $("fr-add-result").innerHTML = "";
  $("fr-add-input")?.focus();
});
$("fr-add-close")?.addEventListener("click", () => $("fr-add-modal")?.classList.add("hidden"));
$("fr-add-search")?.addEventListener("click", async () => {
  const text = $("fr-add-input").value.trim();
  if (!text) { showToast("Masukkan UID atau email"); return; }
  const btn = $("fr-add-search");
  btn.disabled = true; btn.textContent = "Mencari...";
  $("fr-add-result").innerHTML = "";
  const results = await searchUsers(text, state.user.uid, 10);
  btn.disabled = false; btn.textContent = "Cari User";
  if (results.length === 0) { $("fr-add-result").innerHTML = '<div class="fr-sub" style="text-align:center;padding:20px;">User tidak ditemukan</div>'; return; }
  for (const p of results) {
    const name = p.displayName || "User";
    const initial = name.charAt(0).toUpperCase();
    const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
    const el = document.createElement("div");
    el.className = "fr-search-result";
    el.innerHTML = '<div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL && p.photoURL.length > 10 ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">UID: ' + (p.numericUid || "-") + '</div></div><button class="fr-btn fr-btn-primary" data-action="add">+ Add</button>';
    el.querySelector('[data-action="add"]').onclick = async (e) => {
      e.stopPropagation();
      const b = e.target; b.disabled = true; b.textContent = "...";
      const result = await sendFriendRequest(state.user.uid, p.uid);
      const messages = { sent: "Request terkirim ✅", already_friends: "Kalian sudah teman", already_sent: "Sudah pernah minta", auto_accepted: "Kalian sekarang teman ✅", self: "Nggak bisa add diri sendiri", error: "Gagal kirim request" };
      showToast(messages[result] || "Selesai");
      if (result === "sent" || result === "already_sent") b.textContent = "Terkirim";
      else if (result === "auto_accepted" || result === "already_friends") b.textContent = "Teman ✓";
      else { b.disabled = false; b.textContent = "+ Add"; }
    };
    $("fr-add-result").appendChild(el);
  }
});
$("fr-add-input")?.addEventListener("keypress", (e) => { if (e.key === "Enter") $("fr-add-search")?.click(); });

$("fr-search-input")?.addEventListener("input", (e) => {
  clearTimeout(frSearchTimer);
  const text = e.target.value.trim();
  if (!text) { $("fr-search-results").innerHTML = ""; return; }
  frSearchTimer = setTimeout(async () => {
    const results = await searchUsers(text, state.user.uid, 10);
    const container = $("fr-search-results");
    container.innerHTML = "";
    if (results.length === 0) { container.innerHTML = '<div class="fr-sub" style="text-align:center;padding:20px;">User tidak ditemukan</div>'; return; }
    for (const p of results) {
      const name = p.displayName || "User";
      const initial = name.charAt(0).toUpperCase();
      const avatarStyle = p.photoURL && p.photoURL.length > 10 ? "background-image:url(" + p.photoURL + ");" : "";
      const el = document.createElement("div");
      el.className = "fr-search-result";
      el.innerHTML = '<div class="fr-avatar" style="' + avatarStyle + '">' + (p.photoURL && p.photoURL.length > 10 ? "" : initial) + '</div><div class="fr-info"><div class="fr-name">' + escapeHtml(name) + '</div><div class="fr-sub">UID: ' + (p.numericUid || "-") + '</div></div><button class="fr-btn fr-btn-primary" data-action="add">+ Add</button>';
      el.querySelector('[data-action="add"]').onclick = async (e) => {
        e.stopPropagation();
        const b = e.target; b.disabled = true; b.textContent = "...";
        const result = await sendFriendRequest(state.user.uid, p.uid);
        if (result === "sent" || result === "already_sent") b.textContent = "Terkirim";
        else if (result === "auto_accepted" || result === "already_friends") b.textContent = "Teman ✓";
        else { b.disabled = false; b.textContent = "+ Add"; }
        showToast(result);
      };
      container.appendChild(el);
    }
  }, 400);
});

// ========== DEBUG ==========
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  window.__flux = { state, showToast, applyTheme };
}

console.log("✅ FluxChat & FluxAI loaded — All features working");
