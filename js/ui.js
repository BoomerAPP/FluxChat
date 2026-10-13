// ============================================================
// MODUL: UI (Themes, Dark Mode & Wallpaper)
// ============================================================
export const THEMES = {
  kuning: { name: "Kuning Cokelat" },
  ungu:   { name: "Ungu Modern" },
  pink:   { name: "Pink Rose" },
  hijau:  { name: "Hijau Daun" },
  biru:   { name: "Biru Langit" },
};

export const WALLPAPER_PRESETS = {
  default: null,
  kuning: "linear-gradient(135deg, #FFC857, #E67E22)",
  ungu: "linear-gradient(135deg, #A78BFA, #7C3AED)",
  pink: "linear-gradient(135deg, #F472B6, #DB2777)",
  hijau: "linear-gradient(135deg, #34D399, #059669)",
  biru: "linear-gradient(135deg, #60A5FA, #2563EB)",
  gelap: "linear-gradient(135deg, #1F1B2E, #0F0A1A)",
};

export function applyTheme(themeName) {
  if (!THEMES[themeName]) themeName = "kuning";
  document.body.setAttribute("data-theme", themeName);
  localStorage.setItem("flux_theme", themeName);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const colors = { kuning: "#FFC857", ungu: "#8B5CF6", pink: "#EC4899", hijau: "#10B981", biru: "#3B82F6" };
    meta.setAttribute("content", colors[themeName] || "#FFC857");
  }
}

export function isDarkMode() {
  return localStorage.getItem("flux_dark") === "1";
}

export function applyDarkMode(enabled) {
  const btn = document.getElementById("btn-dark-toggle");
  if (enabled) {
    document.body.classList.add("dark");
    localStorage.setItem("flux_dark", "1");
    if (btn) btn.textContent = "☀️";
  } else {
    document.body.classList.remove("dark");
    localStorage.setItem("flux_dark", "0");
    if (btn) btn.textContent = "🌙";
  }
}

export function applyWallpaper(wp) {
  const box = document.getElementById("chat-messages");
  if (!box) return;
  if (!wp || (wp.type === "preset" && !wp.value)) {
    box.style.background = "";
    box.style.backgroundImage = "";
    return;
  }
  if (wp.type === "preset") {
    box.style.backgroundImage = "none";
    box.style.background = wp.value;
  } else if (wp.type === "image") {
    box.style.background = "";
    box.style.backgroundImage = "url(" + wp.value + ")";
  }
}
