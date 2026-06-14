import { createEmptyUiState } from "./data.js";
import { buildFeed, summarizeState } from "./feed.js";
import { parseImportedPayload, mergeStudyIntoState } from "./importer.js";
import { gradeProgress } from "./scheduler.js";
import { createBackupPayload, loadState, normalizeState, saveState } from "./storage.js";
import { createId } from "./utils.js";
import { renderApp } from "./ui.js";

const appRoot = document.querySelector("#app");

if (!appRoot) {
  throw new Error("App root nao encontrado.");
}

let state = loadState();
let ui = createEmptyUiState();
let feed = buildFeed(state);
let lastScrollTop = 0;
let noticeTimer = null;
let preserveScrollOnNextRender = true;

function setNotice(message) {
  ui.notice = message;
  scheduleNoticeClear();
  render();
}

function scheduleNoticeClear() {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
  }
  if (!ui.notice) {
    return;
  }
  noticeTimer = setTimeout(() => {
    ui.notice = "";
    render();
  }, 3200);
}

function persist() {
  saveState(state);
}

function refreshFeed(resetScroll = false) {
  feed = buildFeed(state);
  if (resetScroll) {
    ui.activeIndex = 0;
    lastScrollTop = 0;
    preserveScrollOnNextRender = false;
  } else {
    ui.activeIndex = Math.min(ui.activeIndex, Math.max(feed.length - 1, 0));
  }
}

function render() {
  const summary = summarizeState(state);
  const previousFeed = appRoot.querySelector("#feed");
  const shouldPreserveScroll = preserveScrollOnNextRender;
  preserveScrollOnNextRender = true;

  if (previousFeed && shouldPreserveScroll) {
    lastScrollTop = previousFeed.scrollTop;
  }

  appRoot.innerHTML = renderApp(state, ui, summary, feed);

  const feedEl = appRoot.querySelector("#feed");
  if (feedEl) {
    feedEl.scrollTop = shouldPreserveScroll ? lastScrollTop : 0;
  }
}

function openMenu() {
  ui.menuOpen = true;
  render();
}

function closeMenu() {
  ui.menuOpen = false;
  render();
}

function scrollToTop() {
  const feedEl = appRoot.querySelector("#feed");
  if (feedEl) {
    feedEl.scrollTo({ top: 0, behavior: "smooth" });
  }
  ui.activeIndex = 0;
  closeMenu();
}

function triggerImport() {
  const input = appRoot.querySelector("#import-file");
  if (input) {
    input.value = "";
    input.click();
  }
}

async function exportBackup() {
  const payload = createBackupPayload(state);
  const text = JSON.stringify(payload, null, 2);
  const filename = `study-scroll-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], filename, { type: "application/json" });

  try {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Backup Study Scroll",
        text: "Backup completo do historico e progresso.",
        files: [file]
      });
      setNotice("Backup pronto para compartilhar.");
      return;
    }
  } catch {
    // Fallback para download manual.
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setNotice("Backup baixado para o aparelho.");
}

async function handleFileSelection(file) {
  if (!file) {
    return;
  }

  ui.busyLabel = "Importando arquivo...";
  render();

  try {
    const text = await file.text();
    const parsed = parseImportedPayload(text, file.name || "arquivo.txt");

    if (parsed.kind === "backup") {
      state = normalizeState(parsed.backup.appState);
      refreshFeed(true);
      persist();
      setNotice(`Backup restaurado com sucesso. Fonte: ${file.name}`);
    } else {
      state = mergeStudyIntoState(state, parsed.study);
      refreshFeed(true);
      persist();
      setNotice(`Conteudo importado: ${parsed.study.title}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel importar o arquivo.";
    setNotice(message);
  } finally {
    ui.busyLabel = "";
    closeMenu();
    render();
  }
}

function answerQuestion(questionId, contentId, contentTitle, choiceIndex) {
  const alreadyAnswered = ui.answeredQuestionIds[questionId];
  if (alreadyAnswered) {
    return;
  }

  const targetContent = state.contents.find((content) => content.id === contentId);
  const targetQuestion = targetContent?.questions.find((question) => question.id === questionId);
  if (!targetContent || !targetQuestion) {
    setNotice("Nao foi possivel localizar a pergunta.");
    return;
  }

  const correct = choiceIndex === targetQuestion.correctOptionIndex;
  const updatedProgress = gradeProgress(state.progressByQuestionId[questionId] ?? null, {
    questionId,
    contentId,
    correct
  });

  state = {
    ...state,
    progressByQuestionId: {
      ...state.progressByQuestionId,
      [questionId]: updatedProgress
    },
    history: [
      {
        id: createId("history"),
        questionId,
        contentId,
        contentTitle,
        selectedOptionIndex: choiceIndex,
        correct,
        answeredAt: updatedProgress.lastReviewAt ?? new Date().toISOString(),
        nextReviewAt: updatedProgress.nextReviewAt
      },
      ...state.history
    ]
  };

  ui.answeredQuestionIds[questionId] = {
    selectedOptionIndex: choiceIndex,
    correct,
    nextReviewAt: updatedProgress.nextReviewAt
  };

  persist();
  refreshFeed(false);
  setNotice(correct ? "Resposta correta registrada." : "Resposta incorreta registrada.");
}

function updateActiveIndex() {
  const feedEl = appRoot.querySelector("#feed");
  if (!feedEl) {
    return;
  }

  const cardHeight = feedEl.clientHeight || 1;
  ui.activeIndex = Math.max(0, Math.min(feed.length - 1, Math.round(feedEl.scrollTop / cardHeight)));
}

appRoot.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
  if (!target) {
    return;
  }

  const action = target.getAttribute("data-action");
  if (action === "open-menu") {
    openMenu();
  } else if (action === "close-menu") {
    closeMenu();
  } else if (action === "study") {
    scrollToTop();
  } else if (action === "import") {
    triggerImport();
  } else if (action === "export") {
    exportBackup();
  } else if (action === "answer") {
    answerQuestion(
      target.getAttribute("data-question-id"),
      target.getAttribute("data-content-id"),
      target.getAttribute("data-content-title"),
      Number(target.getAttribute("data-choice-index"))
    );
  }
});

appRoot.addEventListener(
  "scroll",
  (event) => {
    if (event.target && event.target.id === "feed") {
      updateActiveIndex();
    }
  },
  true
);

appRoot.addEventListener("change", (event) => {
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  if (target && target.id === "import-file" && target.files && target.files[0]) {
    handleFileSelection(target.files[0]);
  }
});

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is best-effort.
    });
  });
}
