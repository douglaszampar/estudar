import { createId } from "./utils.js";

const REVIEW_STAGES = [1, 3, 7, 15, 30, 60, 120];

export function createInitialProgress(questionId, contentId) {
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

export function gradeProgress(current, { questionId, contentId, correct }) {
  const now = new Date().toISOString();
  const base = current ?? createInitialProgress(questionId, contentId);

  if (correct) {
    const nextLevel = Math.min(base.masteryLevel + 1, REVIEW_STAGES.length);
    const intervalDays = REVIEW_STAGES[nextLevel - 1];
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

export function isQuestionDue(progress, now = new Date()) {
  if (!progress) {
    return true;
  }
  return new Date(progress.nextReviewAt).getTime() <= now.getTime();
}

export function getNextIntervalLabel(progress) {
  if (!progress) {
    return "Novo";
  }
  if (progress.intervalDays <= 0) {
    return "Revisar em minutos";
  }
  if (progress.intervalDays === 1) {
    return "1 dia";
  }
  return `${progress.intervalDays} dias`;
}

export function createAnswerRecord(question, selectedOptionIndex, correct, nextReviewAt) {
  return {
    id: createId("history"),
    questionId: question.id,
    contentId: question.contentId,
    contentTitle: question.contentTitle,
    selectedOptionIndex,
    correct,
    answeredAt: new Date().toISOString(),
    nextReviewAt
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

