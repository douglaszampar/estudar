import { isQuestionDue } from "./scheduler.js";

export function buildFeed(state) {
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

export function summarizeState(state) {
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

