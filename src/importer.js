import { createId, slugify } from "./utils.js";

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

export function normalizeStudyFile(raw, sourceName) {
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

export function parseImportedPayload(text, sourceName) {
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

export function mergeStudyIntoState(state, study) {
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
