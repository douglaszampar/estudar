import { createEmptyState } from "./data.js";

const STORAGE_KEY = "study-scroll-web-state-v1";

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function normalizeProgressMap(map) {
  if (!isObject(map)) {
    return {};
  }

  const normalized = {};
  for (const [key, value] of Object.entries(map)) {
    if (isObject(value)) {
      normalized[key] = {
        questionId: String(value.questionId ?? key),
        contentId: String(value.contentId ?? ""),
        masteryLevel: Number.isFinite(value.masteryLevel) ? value.masteryLevel : 0,
        correctCount: Number.isFinite(value.correctCount) ? value.correctCount : 0,
        wrongCount: Number.isFinite(value.wrongCount) ? value.wrongCount : 0,
        lastReviewAt: typeof value.lastReviewAt === "string" ? value.lastReviewAt : null,
        nextReviewAt: typeof value.nextReviewAt === "string" ? value.nextReviewAt : new Date().toISOString(),
        intervalDays: Number.isFinite(value.intervalDays) ? value.intervalDays : 0
      };
    }
  }

  return normalized;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.filter(isObject).map((entry) => ({
    id: String(entry.id ?? ""),
    questionId: String(entry.questionId ?? ""),
    contentId: String(entry.contentId ?? ""),
    contentTitle: String(entry.contentTitle ?? ""),
    selectedOptionIndex: Number.isFinite(entry.selectedOptionIndex) ? entry.selectedOptionIndex : 0,
    correct: Boolean(entry.correct),
    answeredAt: typeof entry.answeredAt === "string" ? entry.answeredAt : new Date().toISOString(),
    nextReviewAt: typeof entry.nextReviewAt === "string" ? entry.nextReviewAt : new Date().toISOString()
  }));
}

export function normalizeState(rawState) {
  if (!isObject(rawState)) {
    return createEmptyState();
  }

  return {
    version: 1,
    title: typeof rawState.title === "string" ? rawState.title : "",
    description: typeof rawState.description === "string" ? rawState.description : "",
    sourceName: typeof rawState.sourceName === "string" ? rawState.sourceName : "",
    importedAt: typeof rawState.importedAt === "string" ? rawState.importedAt : null,
    contents: Array.isArray(rawState.contents) ? rawState.contents : [],
    progressByQuestionId: normalizeProgressMap(rawState.progressByQuestionId),
    history: normalizeHistory(rawState.history)
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }
    return normalizeState(JSON.parse(raw));
  } catch {
    return createEmptyState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createBackupPayload(state) {
  return {
    kind: "study-scroll-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appState: state
  };
}

