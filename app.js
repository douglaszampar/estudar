(function () {
  const STORAGE_KEY = "study-scroll-web-state-v1";
  const CACHE_NAME = "study-scroll-site-v2";

  function createId(prefix = "id") {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
  }

  function slugify(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatRelativeLabel(isoDate) {
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

  function formatDateTime(isoDate) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(isoDate));
  }

  function createEmptyState() {
    return {
      version: 1,
      title: "",
      description: "",
      sourceName: "",
      importedAt: null,
      contents: [],
      progressByQuestionId: {},
      history: []
    };
  }

  function createEmptyUiState() {
    return {
      feed: [],
      activeIndex: 0,
      menuOpen: false,
      notice: "",
      busyLabel: "",
      answeredQuestionIds: {}
    };
  }

  function createInitialProgress(questionId, contentId) {
    const now = new Date().toISOString();
    return {
      questionId,
      contentId,
      masteryLevel: 0,
      correctCount: 0,
      wrongCount: 0,
      lastReviewAt: null,
      nextReviewAt: now,
      intervalDays: 0
    };
  }

  function addDays(isoDate, days) {
    const date = new Date(isoDate);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  function addMinutes(isoDate, minutes) {
    const date = new Date(isoDate);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  }

  function gradeProgress(current, { questionId, contentId, correct }) {
    const now = new Date().toISOString();
    const base = current ?? createInitialProgress(questionId, contentId);
    const reviewStages = [1, 3, 7, 15, 30, 60, 120];

    if (correct) {
      const nextLevel = Math.min(base.masteryLevel + 1, reviewStages.length);
      const intervalDays = reviewStages[nextLevel - 1];
      return {
        ...base,
        masteryLevel: nextLevel,
        correctCount: base.correctCount + 1,
        lastReviewAt: now,
        nextReviewAt: addDays(now, intervalDays),
        intervalDays
      };
    }

    const nextLevel = Math.max(base.masteryLevel - 1, 0);
    const penaltyMinutes = base.masteryLevel >= 4 ? 30 : base.masteryLevel >= 2 ? 15 : 5;
    return {
      ...base,
      masteryLevel: nextLevel,
      wrongCount: base.wrongCount + 1,
      lastReviewAt: now,
      nextReviewAt: addMinutes(now, penaltyMinutes),
      intervalDays: 0
    };
  }

  function isQuestionDue(progress, now = new Date()) {
    if (!progress) {
      return true;
    }
    return new Date(progress.nextReviewAt).getTime() <= now.getTime();
  }

  function normalizeProgressMap(map) {
    if (!map || typeof map !== "object") {
      return {};
    }

    const normalized = {};
    for (const [key, value] of Object.entries(map)) {
      if (value && typeof value === "object") {
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

    return history.filter((entry) => entry && typeof entry === "object").map((entry) => ({
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

  function normalizeState(rawState) {
    if (!rawState || typeof rawState !== "object") {
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

  function loadState() {
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

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function createBackupPayload(state) {
    return {
      kind: "study-scroll-backup",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appState: state
    };
  }

  function isObject(value) {
    return typeof value === "object" && value !== null;
  }

  function requireString(value, label) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${label} precisa ser um texto valido.`);
    }
    return value.trim();
  }

  function requireArray(value, label) {
    if (!Array.isArray(value)) {
      throw new Error(`${label} precisa ser uma lista.`);
    }
    return value;
  }

  function normalizeQuestion(raw, studyKey, contentId) {
    const options = requireArray(raw.alternativas, "perguntas[].alternativas").map((alt, index) => {
      if (!isObject(alt)) {
        throw new Error(`alternativas[${index}] precisa ser um objeto.`);
      }
      return {
        id: requireString(alt.id, `alternativas[${index}].id`),
        text: requireString(alt.texto, `alternativas[${index}].texto`)
      };
    });

    if (options.length < 2) {
      throw new Error("Cada pergunta precisa ter ao menos 2 alternativas.");
    }

    const answerKey = requireString(raw.resposta_correta, "resposta_correta");
    const correctIndex = options.findIndex((option) => option.id === answerKey || option.text === answerKey);

    if (correctIndex < 0) {
      throw new Error(`Nao foi possivel encontrar a resposta correta: ${answerKey}`);
    }

    return {
      id: `${studyKey}::${contentId}::${requireString(raw.id, "perguntas[].id")}`,
      rawId: requireString(raw.id, "perguntas[].id"),
      contentId,
      type: requireString(raw.tipo, "perguntas[].tipo"),
      prompt: requireString(raw.pergunta, "perguntas[].pergunta"),
      options,
      correctOptionIndex: correctIndex,
      explanation: requireString(raw.explicacao, "perguntas[].explicacao")
    };
  }

  function normalizeContent(rawContent, studyKey, index, studyTitle, studyDescription, sourceName) {
    const rawContentId = requireString(rawContent.id, "conteudo[].id");
    const excerpt = requireString(rawContent.trecho, "conteudo[].trecho");
    const questions = requireArray(rawContent.perguntas, "conteudo[].perguntas").map((question) =>
      normalizeQuestion(question, studyKey, rawContentId)
    );

    if (questions.length === 0) {
      throw new Error(`O trecho ${rawContentId} precisa ter ao menos uma pergunta.`);
    }

    return {
      id: `${studyKey}::${rawContentId}`,
      rawId: rawContentId,
      order: index,
      studyTitle,
      studyDescription,
      sourceName,
      excerpt,
      questions,
      label: `Trecho ${rawContentId}`
    };
  }

  function normalizeStudyFile(raw, sourceName) {
    if (!isObject(raw)) {
      throw new Error("Arquivo invalido.");
    }

    const title = requireString(raw.titulo, "titulo");
    const description = requireString(raw.descricao, "descricao");
    const contents = requireArray(raw.conteudo, "conteudo");
    const studyKey = slugify(`${title}-${description}`) || slugify(sourceName) || createId("study");

    if (contents.length === 0) {
      throw new Error("O arquivo precisa conter ao menos um item em conteudo.");
    }

    return {
      id: studyKey,
      title,
      description,
      sourceName,
      importedAt: new Date().toISOString(),
      contents: contents.map((content, index) => normalizeContent(content, studyKey, index, title, description, sourceName))
    };
  }

  function parseImportedPayload(text, sourceName) {
    const parsed = JSON.parse(text);

    if (isObject(parsed) && parsed.kind === "study-scroll-backup") {
      if (parsed.schemaVersion !== 1 || !isObject(parsed.appState)) {
        throw new Error("Backup invalido.");
      }
      return {
        kind: "backup",
        backup: parsed
      };
    }

    return {
      kind: "study",
      study: normalizeStudyFile(parsed, sourceName)
    };
  }

  function mergeStudyIntoState(state, study) {
    const contentsWithoutCurrentStudy = state.contents.filter((content) => content.id.split("::")[0] !== study.id);
    const nextProgressByQuestionId = {};
    const nextHistory = state.history.filter((entry) => entry.contentId && entry.contentId.split("::")[0] !== study.id);

    for (const [questionId, progress] of Object.entries(state.progressByQuestionId)) {
      if (progress.contentId && progress.contentId.split("::")[0] !== study.id) {
        nextProgressByQuestionId[questionId] = progress;
      }
    }

    return {
      ...state,
      title: study.title,
      description: study.description,
      sourceName: study.sourceName,
      importedAt: study.importedAt,
      contents: [...contentsWithoutCurrentStudy, ...study.contents],
      progressByQuestionId: nextProgressByQuestionId,
      history: nextHistory
    };
  }

  function buildFeed(state) {
    const groups = [];

    for (const content of state.contents) {
      const activeQuestions = content.questions
        .map((question) => {
          const progress = state.progressByQuestionId[question.id] ?? null;
          const due = isQuestionDue(progress);
          return {
            content,
            question,
            progress,
            due
          };
        })
        .filter((entry) => !entry.progress || entry.due);

      if (activeQuestions.length === 0) {
        continue;
      }

      const hasReview = activeQuestions.some((entry) => Boolean(entry.progress));
      const dueDates = activeQuestions
        .filter((entry) => entry.progress)
        .map((entry) => new Date(entry.progress.nextReviewAt).getTime());

      groups.push({
        content,
        activeQuestions,
        hasReview,
        priorityDate: dueDates.length > 0 ? Math.min(...dueDates) : Number.POSITIVE_INFINITY
      });
    }

    groups.sort((a, b) => {
      if (a.hasReview !== b.hasReview) {
        return a.hasReview ? -1 : 1;
      }
      if (a.priorityDate !== b.priorityDate) {
        return a.priorityDate - b.priorityDate;
      }
      return a.content.order - b.content.order;
    });

    const feed = [];

    for (const group of groups) {
      feed.push({
        id: `${group.content.id}::excerpt`,
        kind: "excerpt",
        contentId: group.content.id,
        contentTitle: group.content.studyTitle,
        contentDescription: group.content.studyDescription,
        sectionLabel: group.content.label,
        text: group.content.excerpt,
        statusLabel: group.hasReview ? "Revisao" : "Novo"
      });

      const questions = group.activeQuestions.slice().sort((a, b) => {
        if (Boolean(a.progress) !== Boolean(b.progress)) {
          return a.progress ? -1 : 1;
        }
        const aDate = a.progress ? new Date(a.progress.nextReviewAt).getTime() : 0;
        const bDate = b.progress ? new Date(b.progress.nextReviewAt).getTime() : 0;
        if (aDate !== bDate) {
          return aDate - bDate;
        }
        return a.question.rawId.localeCompare(b.question.rawId);
      });

      for (const entry of questions) {
        feed.push({
          id: entry.question.id,
          kind: "question",
          contentId: group.content.id,
          contentTitle: group.content.studyTitle,
          contentDescription: group.content.studyDescription,
          sectionLabel: group.content.label,
          question: entry.question,
          progress: entry.progress,
          queueLabel: entry.progress ? "review" : "new"
        });
      }
    }

    return feed;
  }

  function summarizeState(state) {
    let due = 0;
    let fresh = 0;
    let mastered = 0;

    for (const content of state.contents) {
      for (const question of content.questions) {
        const progress = state.progressByQuestionId[question.id] ?? null;
        if (!progress) {
          fresh += 1;
        } else if (isQuestionDue(progress)) {
          due += 1;
        } else {
          mastered += 1;
        }
      }
    }

    return {
      due,
      fresh,
      mastered,
      total: due + fresh + mastered
    };
  }

  function renderApp(state, ui, summary, feed) {
    const heading = state.title || "Study Scroll";
    const subtitle = state.description || "Importe um arquivo para comecar.";

    return `
      <div class="ambient ambient--one"></div>
      <div class="ambient ambient--two"></div>
      <div class="ambient ambient--three"></div>

      <div class="shell">
        <header class="topbar">
          <div class="brand">
            <h1 class="brand__title">${escapeHtml(heading)}</h1>
            <p class="brand__subtitle">${escapeHtml(subtitle)}</p>
          </div>
          <div class="topbar__actions">
            <div class="pill pill--accent">
              <div>
                <span class="pill__title">Pendentes</span>
                <span class="pill__value">${summary.due}</span>
              </div>
            </div>
            <button class="icon-button" type="button" data-action="open-menu" aria-label="Abrir menu">
              <span aria-hidden="true">Menu</span>
            </button>
          </div>
        </header>

        <section class="summary" aria-label="Resumo">
          <div class="stat">
            <span class="stat__value">${summary.fresh}</span>
            <span class="stat__label">Novos</span>
          </div>
          <div class="stat">
            <span class="stat__value">${summary.mastered}</span>
            <span class="stat__label">Em dia</span>
          </div>
          <div class="stat">
            <span class="stat__value">${summary.total}</span>
            <span class="stat__label">Total</span>
          </div>
        </section>

        ${renderFeed(feed, ui.answeredQuestionIds)}

        <button class="fab" type="button" data-action="open-menu" aria-label="Abrir menu">
          <span class="fab__icon" aria-hidden="true"></span>
        </button>

        <div class="notice ${ui.notice ? "is-visible" : ""}" role="status" aria-live="polite">
          <p class="notice__text">${escapeHtml(ui.notice || "")}</p>
        </div>

        <div class="menu ${ui.menuOpen ? "is-open" : ""}" aria-hidden="${ui.menuOpen ? "false" : "true"}">
          <div class="menu__backdrop" data-action="close-menu"></div>
          <div class="menu__sheet">
            <div class="menu__handle"></div>
            <h2 class="menu__title">Menu</h2>
            <p class="menu__text">Acoes rapidas para estudar, importar novos arquivos e exportar seu historico local.</p>

            <button class="menu__action" type="button" data-action="study">
              <span class="menu__action-title">Estudar</span>
              <span class="menu__action-text">Volta para o topo do feed.</span>
            </button>

            <button class="menu__action" type="button" data-action="import">
              <span class="menu__action-title">Importar novos arquivos</span>
              <span class="menu__action-text">Seleciona um .txt ou .json no formato esperado.</span>
            </button>

            <button class="menu__action" type="button" data-action="export">
              <span class="menu__action-title">Exportar historico</span>
              <span class="menu__action-text">Gera um backup completo para transferir para outro aparelho.</span>
            </button>

            ${ui.busyLabel ? `<div class="menu__busy">${escapeHtml(ui.busyLabel)}</div>` : ""}
          </div>
        </div>

        <input class="file-input" id="import-file" type="file" accept=".json,.txt,application/json,text/plain" />
      </div>
    `;
  }

  function renderFeed(feed, answeredQuestionIds) {
    if (feed.length === 0) {
      return `
        <main class="feed" id="feed">
          <section class="empty-state">
            <div class="empty-card">
              <div class="card__glow card__glow--a"></div>
              <div class="card__glow card__glow--b"></div>
              <p class="empty-card__kicker">Sem conteudo ainda</p>
              <h2 class="empty-card__title">Importe um arquivo estruturado para comecar.</h2>
              <p class="empty-card__text">
                O site vai organizar os trechos e perguntas em um feed vertical com revisao espaciada e armazenamento local.
              </p>
              <button class="primary-button" type="button" data-action="import">Importar arquivo</button>
              <p class="footer-hint">Funciona offline depois do primeiro carregamento.</p>
            </div>
          </section>
        </main>
      `;
    }

    return `
      <main class="feed" id="feed" aria-label="Feed de estudo">
        ${feed.map((item) => renderFeedItem(item, answeredQuestionIds)).join("")}
      </main>
    `;
  }

  function renderFeedItem(item, answeredQuestionIds) {
    if (item.kind === "excerpt") {
      return `
        <section class="card">
          <div class="card__glow card__glow--a"></div>
          <div class="card__glow card__glow--b"></div>
          <div class="card__inner">
            <div class="badge-row">
              <span class="badge ${item.statusLabel === "Revisao" ? "badge--review" : "badge--new"}">${item.statusLabel}</span>
              <span class="badge badge--muted">${escapeHtml(item.sectionLabel)}</span>
            </div>
            <div>
              <p class="eyebrow">${escapeHtml(item.contentTitle)}</p>
              <h2 class="title">${escapeHtml(item.contentTitle)}</h2>
              <p class="description">${escapeHtml(item.contentDescription)}</p>
            </div>
            <div class="excerpt">
              <span class="excerpt__label">Trecho</span>
              <p class="excerpt__text">${escapeHtml(item.text)}</p>
            </div>
            <p class="footer-hint">Deslize para continuar.</p>
          </div>
        </section>
      `;
    }

    const answered = Boolean(answeredQuestionIds[item.question.id]);
    const correctIndex = item.question.correctOptionIndex;
    const selectedIndex = answered ? answeredQuestionIds[item.question.id].selectedOptionIndex : -1;

    return `
      <section class="card">
        <div class="card__glow card__glow--c"></div>
        <div class="card__glow card__glow--d"></div>
        <div class="card__inner">
          <div class="badge-row">
            <span class="badge ${item.queueLabel === "review" ? "badge--review" : "badge--new"}">${item.queueLabel === "review" ? "Revisao" : "Novo"}</span>
            <span class="badge badge--muted">${escapeHtml(item.sectionLabel)}</span>
            <span class="badge badge--muted">${item.progress ? `Dominio ${item.progress.masteryLevel}` : "Primeira vez"}</span>
          </div>

          <div>
            <p class="eyebrow">${escapeHtml(item.contentTitle)}</p>
            <h2 class="question__prompt">${escapeHtml(item.question.prompt)}</h2>
            <div class="question__meta">
              <span>${item.progress ? `Proxima revisao ${formatRelativeLabel(item.progress.nextReviewAt)}` : "Novo conteudo"}</span>
              ${item.progress?.lastReviewAt ? `<span>Ultima: ${formatDateTime(item.progress.lastReviewAt)}</span>` : ""}
            </div>
          </div>

          <div class="options">
            ${item.question.options
              .map((option, index) => {
                const classes = ["option"];
                if (answered && index === correctIndex) {
                  classes.push("option--correct");
                } else if (answered && index === selectedIndex && index !== correctIndex) {
                  classes.push("option--wrong");
                }
                return `
                  <button
                    class="${classes.join(" ")}"
                    type="button"
                    ${answered ? "disabled" : ""}
                    data-action="answer"
                    data-question-id="${escapeHtml(item.question.id)}"
                    data-content-id="${escapeHtml(item.contentId)}"
                    data-content-title="${escapeHtml(item.contentTitle)}"
                    data-choice-index="${index}"
                  >
                    <span class="option__label">${escapeHtml(option.id || String.fromCharCode(65 + index))}</span>
                    <span class="option__text">${escapeHtml(option.text)}</span>
                  </button>
                `;
              })
              .join("")}
          </div>

          ${
            answered
              ? `
            <div class="feedback">
              <p class="feedback__headline ${answeredQuestionIds[item.question.id].correct ? "feedback__headline--success" : "feedback__headline--error"}">
                ${answeredQuestionIds[item.question.id].correct ? "Acertou" : "Errou"}
              </p>
              <p class="feedback__text">${escapeHtml(item.question.explanation)}</p>
              <p class="feedback__meta">Proxima revisao: ${formatDateTime(answeredQuestionIds[item.question.id].nextReviewAt)}</p>
            </div>
          `
              : `
            <p class="footer-hint">Toque em uma resposta para registrar o resultado.</p>
          `
          }
        </div>
      </section>
    `;
  }

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

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Offline support is best-effort.
      });
    });
  }
})();

