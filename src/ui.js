import { escapeHtml, formatDateTime, formatRelativeLabel } from "./utils.js";

export function renderApp(state, ui, summary, feed) {
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

