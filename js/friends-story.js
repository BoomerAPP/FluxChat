// ============================================================
// MODUL: FRIENDS & STORIES
// ============================================================
export async function renderFriendsList(state, frFriends, getUsersProfiles, removeFriend, openChatDetail, showToast, escapeHtml) {
  const list = document.getElementById("fr-friends-list");
  if (!list) return;

  if (frFriends.length === 0) {
    list.innerHTML = `<div class="tk-empty"><div class="tk-empty-icon">👥</div><p>Belum ada teman</p></div>`;
    return;
  }

  const uids = frFriends.map((f) => f.otherUid);
  const profiles = await getUsersProfiles(uids);
  const profileMap = {};
  profiles.forEach((p) => { profileMap[p.uid] = p; });

  list.innerHTML = "";
  for (const fr of frFriends) {
    const p = profileMap[fr.otherUid];
    if (!p) continue;
    const name = p.displayName || "User";
    const el = document.createElement("div");
    el.className = "fr-item";
    el.innerHTML = `
      <div class="fr-avatar" style="${p.photoURL ? 'background-image:url(' + p.photoURL + ');' : ''}"></div>
      <div class="fr-info"><div class="fr-name">${escapeHtml(name)}</div><div class="fr-sub">UID: ${p.numericUid || "-"}</div></div>
      <button class="fr-btn fr-btn-primary" data-action="chat">Chat</button>
      <button class="fr-btn fr-btn-danger" data-action="remove">Hapus</button>
    `;
    el.querySelector('[data-action="chat"]').onclick = () => openChatDetail("dm", p);
    el.querySelector('[data-action="remove"]').onclick = async () => {
      if (confirm(`Hapus ${name}?`)) {
        await removeFriend(state.user.uid, p.uid);
        showToast("Teman dihapus");
      }
    };
    list.appendChild(el);
  }
}
