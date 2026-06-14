export function createId(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatRelativeLabel(isoDate) {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) {
    return "Agora";
  }

  const minutes = Math.round(diff / 60000);
  if (minutes < 60) {
    return `Em ${Math.max(1, minutes)} min`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Em ${Math.max(1, hours)} h`;
  }

  const days = Math.round(hours / 24);
  return `Em ${Math.max(1, days)} dia(s)`;
}

export function formatDateTime(isoDate) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(isoDate));
}

