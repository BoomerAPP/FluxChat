// ============================================================
// FLUXCHAT & FLUXAI — CHAT MODULE (Full Features & Improvements)
// ============================================================
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app } from "./config.js";

export const db = getFirestore(app);

// ============================================================
// HELPER: Generate 12-digit UID starting with "34" (numeric only)
// ============================================================
export function generateNumericUid() {
  let rand = "";
  for (let i = 0; i < 10; i++) {
    rand += Math.floor(Math.random() * 10);
  }
  return "34" + rand;
}

// ============================================================
// USER PROFILE (Fixed PP & Cache Synchronization)
// ============================================================
export async function saveUserProfile(user, customName = null) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  
  let numericUid = snap.exists() ? snap.data().numericUid : null;
  if (!numericUid) {
    numericUid = generateNumericUid();
  }

  const existingData = snap.exists() ? snap.data() : {};
  const photoURL = user.photoURL || existingData.photoURL || null;
  const displayName = customName || user.displayName || existingData.displayName || (user.email ? user.email.split("@")[0] : "User");

  const data = {
    uid: user.uid,
    numericUid: numericUid,
    email: user.email || existingData.email || "",
    displayName: displayName,
    photoURL: photoURL,
    lastSeen: serverTimestamp(),
  };
  
  if (!snap.exists()) {
    data.createdAt = serverTimestamp();
    data.bio = "Halo, saya menggunakan FluxChat & FluxAI!";
    data.bannerURL = null;
  }
  
  await setDoc(ref, data, { merge: true });
}

export async function getUserProfile(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
}

export async function updateUserProfile(user, updates) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  
  if (updates.photoURL !== undefined || updates.displayName !== undefined) {
    await updateProfile(user, {
      displayName: updates.displayName !== undefined ? updates.displayName : user.displayName,
      photoURL: updates.photoURL !== undefined ? updates.photoURL : user.photoURL
    }).catch(() => {});
  }

  await updateDoc(ref, {
    ...updates,
    lastSeen: serverTimestamp(),
  });
}

// ============================================================
// CHAT GLOBAL
// ============================================================
export function listenGlobalMessages(callback, maxMsgs = 50) {
  const q = query(
    collection(db, "chats_global"),
    orderBy("createdAt", "desc"),
    limit(maxMsgs)
  );
  return onSnapshot(q, (snap) => {
    const msgs = [];
    snap.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
    msgs.reverse();
    callback(msgs);
  }, (err) => {
    console.error("Global chat error:", err);
  });
}

export async function sendGlobalMessage(user, payload) {
  const profile = await getUserProfile(user.uid);
  const base = {
    uid: user.uid,
    name: profile?.displayName || user.displayName || (user.email ? user.email.split("@")[0] : "User"),
    photoURL: profile?.photoURL || user.photoURL || null,
    createdAt: serverTimestamp(),
    reactions: {}, // Field reactions agar bisa dilihat semua user secara real-time
  };
  
  if (typeof payload === "string") {
    if (!payload.trim()) return;
    await addDoc(collection(db, "chats_global"), {
      ...base,
      type: "text",
      text: payload.trim(),
    });
  } else if (payload && payload.type) {
    // Mendukung semua tipe payload (sticker, voice, location, contact, image, document, dll)
    await addDoc(collection(db, "chats_global"), {
      ...base,
      ...payload,
    });
  }
}

// ============================================================
// REACTION HANDLER (Global & DM)
// ============================================================
export async function addMessageReaction(chatType, roomIdOrMessageId, messageId, emoji, userId) {
  try {
    let docRef;
    if (chatType === "global") {
      docRef = doc(db, "chats_global", messageId);
    } else {
      docRef = doc(db, "chats_dm", roomIdOrMessageId, "messages", messageId);
    }

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    let reactions = data.reactions || {};

    if (reactions[emoji] && reactions[emoji].includes(userId)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      if (!reactions[emoji]) reactions[emoji] = [];
      reactions[emoji].push(userId);
    }

    await updateDoc(docRef, { reactions });
  } catch (err) {
    console.error("Gagal memperbarui reaction:", err);
  }
}

// ============================================================
// PRIVATE CHAT (DM) & ADVANCED FEATURES
// ============================================================
export function getDMRoomId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export function listenPrivateMessages(myUid, otherUid, callback) {
  const roomId = getDMRoomId(myUid, otherUid);
  const q = query(
    collection(db, "chats_dm", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const msgs = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.disappearingExpiresAt && Date.now() > data.disappearingExpiresAt) {
        return;
      }
      msgs.push({ id: d.id, ...data });
    });
    callback(msgs);
  }, (err) => {
    console.error("DM listen error:", err);
  });
}

export async function sendPrivateMessage(sender, recipientUid, textOrPayload, replyTo = null, disappearingHours = 0) {
  try {
    const roomId = getDMRoomId(sender.uid, recipientUid);
    const messagesRef = collection(db, "chats_dm", roomId, "messages");
    const senderProfile = await getUserProfile(sender.uid);
    const senderName = senderProfile?.displayName || sender.displayName || sender.email;
    const senderPhoto = senderProfile?.photoURL || sender.photoURL || null;
    
    let basePayload = {
      uid: sender.uid,
      name: senderName,
      photoURL: senderPhoto,
      createdAt: serverTimestamp(),
      read: false,
      reactions: {},
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text || replyTo.caption || "Lampiran", name: replyTo.name } : null,
      disappearingExpiresAt: disappearingHours > 0 ? Date.now() + (disappearingHours * 3600 * 1000) : null
    };

    if (typeof textOrPayload === "string") {
      basePayload.type = "text";
      basePayload.text = textOrPayload;
    } else {
      Object.assign(basePayload, textOrPayload);
    }

    await addDoc(messagesRef, basePayload);

    const senderRef = doc(db, "users", sender.uid);
    const recipientRef = doc(db, "users", recipientUid);
    
    await updateDoc(senderRef, { conversations: arrayUnion(recipientUid) }).catch(() => {
      setDoc(senderRef, { conversations: [recipientUid] }, { merge: true });
    });
    
    await updateDoc(recipientRef, { conversations: arrayUnion(sender.uid) }).catch(() => {
      setDoc(recipientRef, { conversations: [sender.uid] }, { merge: true });
    });

    return true;
  } catch (err) {
    console.error("Error sendPrivateMessage:", err);
    throw err;
  }
}

// Typing Indicator Exports
export async function setTypingStatus(myUid, otherUid, isTyping) {
  try {
    const roomId = getDMRoomId(myUid, otherUid);
    await setDoc(doc(db, "chats_dm", roomId, "typing", myUid), { isTyping, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {}
}

export function listenTypingStatus(myUid, otherUid, callback) {
  const roomId = getDMRoomId(myUid, otherUid);
  return onSnapshot(doc(db, "chats_dm", roomId, "typing", otherUid), (snap) => {
    if (snap.exists()) {
      callback(snap.data().isTyping);
    } else {
      callback(false);
    }
  });
}

// Read Receipt Export
export async function markMessagesAsRead(myUid, otherUid) {
  try {
    const roomId = getDMRoomId(myUid, otherUid);
    const q = query(collection(db, "chats_dm", roomId, "messages"), where("uid", "==", otherUid), where("read", "==", false));
    const snap = await getDocs(q);
    const updates = [];
    snap.forEach((d) => {
      updates.push(updateDoc(doc(db, "chats_dm", roomId, "messages", d.id), { read: true }));
    });
    await Promise.all(updates);
  } catch (e) {}
}

// ============================================================
// WEBRTC SIGNALING (Voice & Video Call)
// ============================================================
export async function sendCallSignal(myUid, otherUid, signalData) {
  try {
    const roomId = getDMRoomId(myUid, otherUid);
    await setDoc(doc(db, "chats_dm", roomId, "call", "signal"), {
      sender: myUid,
      data: signalData,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Gagal kirim sinyal call:", err);
  }
}

export function listenCallSignal(myUid, otherUid, callback) {
  const roomId = getDMRoomId(myUid, otherUid);
  return onSnapshot(doc(db, "chats_dm", roomId, "call", "signal"), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      if (d && d.sender !== myUid) {
        callback(d.data);
      }
    }
  });
}

export async function clearCallSignal(myUid, otherUid) {
  try {
    const roomId = getDMRoomId(myUid, otherUid);
    await deleteDoc(doc(db, "chats_dm", roomId, "call", "signal"));
  } catch (e) {}
}

// ============================================================
// CARI USER via NUMERIC UID atau EMAIL
// ============================================================
export async function findUserByNumericUidOrEmail(queryStr) {
  const qText = queryStr.trim().toLowerCase();
  if (!qText) return null;

  if (/^\d+$/.test(qText)) {
    const q = query(collection(db, "users"), where("numericUid", "==", qText));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
  }

  const qEmail = query(collection(db, "users"), where("email", "==", qText));
  const snapEmail = await getDocs(qEmail);
  if (!snapEmail.empty) {
    return { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
  }

  return null;
}

export async function findUserByEmail(email) {
  return await findUserByNumericUidOrEmail(email);
}

// ============================================================
// FRIEND SYSTEM
// ============================================================
export function getFriendPairKey(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export async function sendFriendRequest(myUid, otherUid) {
  try {
    if (myUid === otherUid) return "self";
    
    const pairKey = getFriendPairKey(myUid, otherUid);
    const ref = doc(db, "friendships", pairKey);
    const snap = await getDoc(ref);
    
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "accepted") return "already_friends";
      if (data.status === "pending" && data.requester === myUid) return "already_sent";
      if (data.status === "pending" && data.requester !== myUid) {
        await updateDoc(ref, {
          status: "accepted",
          updatedAt: serverTimestamp(),
        });
        return "auto_accepted";
      }
      if (data.status === "rejected") {
        await updateDoc(ref, {
          status: "pending",
          requester: myUid,
          updatedAt: serverTimestamp(),
        });
        return "sent";
      }
    }
    
    await setDoc(ref, {
      users: [myUid, otherUid],
      requester: myUid,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return "sent";
  } catch (err) {
    console.error("sendFriendRequest error:", err);
    return "error";
  }
}

export async function acceptFriendRequest(myUid, otherUid) {
  try {
    const pairKey = getFriendPairKey(myUid, otherUid);
    const ref = doc(db, "friendships", pairKey);
    await updateDoc(ref, {
      status: "accepted",
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("acceptFriendRequest error:", err);
    return false;
  }
}

export async function rejectFriendRequest(myUid, otherUid) {
  try {
    const pairKey = getFriendPairKey(myUid, otherUid);
    const ref = doc(db, "friendships", pairKey);
    await updateDoc(ref, {
      status: "rejected",
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("rejectFriendRequest error:", err);
    return false;
  }
}

export async function removeFriend(myUid, otherUid) {
  try {
    const pairKey = getFriendPairKey(myUid, otherUid);
    const ref = doc(db, "friendships", pairKey);
    await deleteDoc(ref);
    return true;
  } catch (err) {
    console.error("removeFriend error:", err);
    return false;
  }
}

export function listenFriendships(myUid, callback) {
  const q = query(
    collection(db, "friendships"),
    where("users", "array-contains", myUid)
  );
  
  return onSnapshot(q, (snap) => {
    const friends = [];
    const requests = [];
    const sentRequests = [];
    
    snap.forEach((d) => {
      const data = d.data();
      const otherUid = data.users.find((u) => u !== myUid);
      const item = { id: d.id, ...data, otherUid };
      
      if (data.status === "accepted") {
        friends.push(item);
      } else if (data.status === "pending") {
        if (data.requester === myUid) sentRequests.push(item);
        else requests.push(item);
      }
    });
    
    callback(friends, requests, sentRequests);
  }, (err) => {
    console.error("listenFriendships error:", err);
    callback([], [], []);
  });
}

export async function getUserProfileByUid(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch (err) {
    return null;
  }
}

export async function getUsersProfiles(uids) {
  try {
    const promises = uids.map((uid) => getUserProfileByUid(uid));
    const results = await Promise.all(promises);
    return results.filter((r) => r !== null);
  } catch (err) {
    console.error("getUsersProfiles error:", err);
    return [];
  }
}

export async function searchUsers(queryText, excludeUid, maxResults = 10) {
  try {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];
    
    const allUsers = query(collection(db, "users"), limit(50));
    const snap = await getDocs(allUsers);
    const results = [];
    
    snap.forEach((d) => {
      const data = d.data();
      if (data.uid === excludeUid) return;
      const name = (data.displayName || "").toLowerCase();
      const email = (data.email || "").toLowerCase();
      const numUid = (data.numericUid || "").toLowerCase();
      
      if (name.includes(q) || email.includes(q) || numUid.includes(q)) {
        results.push({ uid: d.id, ...data });
      }
    });
    
    return results.slice(0, maxResults);
  } catch (err) {
    console.error("searchUsers error:", err);
    return [];
  }
}

export async function checkFriendshipStatus(myUid, otherUid) {
  try {
    const pairKey = getFriendPairKey(myUid, otherUid);
    const ref = doc(db, "friendships", pairKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) return "none";
    const data = snap.data();
    if (data.status === "accepted") return "accepted";
    if (data.status === "pending" && data.requester === myUid) return "pending_sent";
    if (data.status === "pending") return "pending_received";
    return "none";
  } catch (err) {
    return "none";
  }
}

// ============================================================
// STORIES
// ============================================================
export function listenStories(callback) {
  const q = query(
    collection(db, "stories"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const stories = [];
    snap.forEach((d) => {
      const data = d.data();
      const created = data.createdAt?.toDate?.() || new Date(0);
      const age = now - created.getTime();
      if (age > 24 * 60 * 60 * 1000) return;
      stories.push({ id: d.id, ...data });
    });
    callback(stories);
  }, (err) => console.error("Stories error:", err));
}

export async function createStory(user, { imageBase64, caption, type = "image" }) {
  const profile = await getUserProfile(user.uid);
  const ref = await addDoc(collection(db, "stories"), {
    uid: user.uid,
    name: profile?.displayName || user.displayName || user.email.split("@")[0],
    photoURL: profile?.photoURL || user.photoURL || null,
    imageBase64,
    caption: caption || "",
    type,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteStory(storyId) {
  const ref = doc(db, "stories", storyId);
  await deleteDoc(ref);
}

// ============================================================
// VOICE NOTE RECORDER
// ============================================================
let mediaRecorder = null;
let audioChunks = [];
let recordTimerInterval = null;
let recordSeconds = 0;

export async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordSeconds = 0;
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.start();
    
    recordTimerInterval = setInterval(() => {
      recordSeconds++;
      window.dispatchEvent(new CustomEvent('recordingTick', { detail: recordSeconds }));
    }, 1000);
    
    return true;
  } catch (err) {
    console.error("Gagal mengakses mikrofon:", err);
    alert("Izin mikrofon ditolak atau tidak tersedia.");
    return false;
  }
}

export function stopRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      resolve(null);
      return;
    }
    
    clearInterval(recordTimerInterval);
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64Audio = reader.result;
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        resolve({
          base64: base64Audio,
          duration: recordSeconds
        });
      };
    };
    
    mediaRecorder.stop();
  });
}

export function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    clearInterval(recordTimerInterval);
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
}
// ============================================================
// HAPUS PESAN (Global & DM)
// ============================================================
export async function deleteMessage(chatType, roomIdOrMessageId, messageId) {
  try {
    let docRef;
    if (chatType === "global") {
      docRef = doc(db, "chats_global", messageId);
    } else {
      docRef = doc(db, "chats_dm", roomIdOrMessageId, "messages", messageId);
    }
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error("Gagal menghapus pesan:", err);
    return false;
  }
}
