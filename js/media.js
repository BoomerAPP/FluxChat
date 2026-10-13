// ============================================================
// MODUL: MEDIA (Attachment, Quick Contact, & Voice Note)
// ============================================================
export function compressImage(file, maxSize = 400) {
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
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("Gagal baca gambar"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
}

export async function showQuickContactModal(userProfile, state, checkFriendshipStatus, sendCallSignal, sendFriendRequest, showToast, escapeHtml) {
  let modal = document.getElementById("quick-contact-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "quick-contact-modal";
    modal.className = "modal hidden";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;";
    document.body.appendChild(modal);
  }

  const friendshipStatus = await checkFriendshipStatus(state.user.uid, userProfile.uid);
  const isSaved = friendshipStatus === "accepted";
  const displayName = userProfile.displayName || userProfile.email || "User";
  const numericUid = userProfile.numericUid || userProfile.uid || "-";
  const photo = userProfile.photoURL;
  const mediaMessages = state.lastDmMsgs.filter(m => m.type === "image" || m.type === "sticker" || m.audioBase64);

  modal.innerHTML = `
    <div class="modal-content" style="background:var(--surface); width:100%; max-width:380px; border-radius:18px; border:2px solid var(--border); box-shadow:var(--shadow-brutal); overflow:hidden; max-height:85vh; display:flex; flex-direction:column;">
      <div style="position:relative; width:100%; height:220px; background:var(--primary); background-size:cover; background-position:center; ${photo && photo.length > 10 ? 'background-image:url(' + photo + ');' : ''}">
        <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent);"></div>
        <button id="qc-close" style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.5); color:#fff; border:none; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
        <div style="position:absolute; bottom:16px; left:16px; right:16px; color:#fff;">
          <div style="font-size:20px; font-weight:700; text-shadow:0 1px 3px rgba(0,0,0,0.8);">${escapeHtml(displayName)}</div>
          <div style="font-size:12px; opacity:0.9;">UID: ${numericUid}</div>
        </div>
      </div>
      <div style="display:flex; justify-content:space-around; align-items:center; background:var(--surface); padding:16px; border-bottom:2px solid var(--border);">
        <button id="qc-btn-msg" style="background:none; border:none; cursor:pointer; color:var(--text);"><div style="width:40px; height:40px; border-radius:50%; background:var(--primary); color:#111; display:flex; align-items:center; justify-content:center; font-weight:bold;">💬</div><span style="font-size:11px;">Pesan</span></button>
        <button id="qc-btn-call" style="background:none; border:none; cursor:pointer; color:var(--text);"><div style="width:40px; height:40px; border-radius:50%; background:var(--primary); color:#111; display:flex; align-items:center; justify-content:center; font-weight:bold;">📞</div><span style="font-size:11px;">Audio</span></button>
        <button id="qc-btn-save" style="background:none; border:none; cursor:pointer; color:var(--text);"><div style="width:40px; height:40px; border-radius:50%; background:var(--primary); color:#111; display:flex; align-items:center; justify-content:center; font-weight:bold;">👤+</div><span style="font-size:11px;">${isSaved ? 'Disimpan' : 'Simpan'}</span></button>
      </div>
      <div style="padding:16px; overflow-y:auto; flex:1;">
        <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Media Dibagikan</div>
        <div style="display:flex; gap:8px; overflow-x:auto;">
          ${mediaMessages.length > 0 ? mediaMessages.map(m => `<div style="min-width:60px; height:60px; border-radius:8px; background:var(--border); ${m.mediaBase64 ? 'background-image:url(' + m.mediaBase64 + '); background-size:cover;' : ''}">${m.sticker || ''}</div>`).join('') : '<i style="font-size:12px; color:var(--text-muted);">Belum ada media</i>'}
        </div>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
  document.getElementById("qc-close").onclick = () => modal.classList.add("hidden");
  document.getElementById("qc-btn-msg").onclick = () => modal.classList.add("hidden");
  document.getElementById("qc-btn-save").onclick = async () => {
    await sendFriendRequest(state.user.uid, userProfile.uid);
    showToast("Kontak berhasil disimpan ✅");
    modal.classList.add("hidden");
  };
}
