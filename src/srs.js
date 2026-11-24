export const REVIEW_INTERVALS_DAYS = [3, 7, 14, 30, 60, 120, 240];

const DAY_MS = 86_400_000;

export function dateOnly(date = new Date()) {
  const local = new Date(date);
  local.setHours(12, 0, 0, 0);
  return local.toISOString().slice(0, 10);
}

export function addDaysISO(days, from = new Date()) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(laterISO, earlierISO) {
  if (!laterISO || !earlierISO) return 0;
  const later = new Date(`${laterISO}T12:00:00`);
  const earlier = new Date(`${earlierISO}T12:00:00`);
  return Math.floor((later - earlier) / DAY_MS);
}

export function errorsInLastDays(progress, days = 7, now = dateOnly()) {
  return (progress.errorDates || []).filter(date => {
    const diff = daysBetween(now, date);
    return diff >= 0 && diff < days;
  }).length;
}

export function trimErrorHistory(progress, keepDays = 45, now = dateOnly()) {
  return {
    ...progress,
    errorDates: (progress.errorDates || []).filter(date => {
      const diff = daysBetween(now, date);
      return diff >= 0 && diff <= keepDays;
    })
  };
}

export function scheduleNewlyLearned(progress, now = dateOnly()) {
  return {
    ...progress,
    mastered: true,
    known: true,
    learnedAt: progress.learnedAt || now,
    lastSuccessAt: now,
    lastSeenAt: now,
    reviewStep: 0,
    nextReviewAt: addDaysISO(REVIEW_INTERVALS_DAYS[0]),
    correctCount: (progress.correctCount || 0) + 1
  };
}

export function scheduleReviewSuccess(progress, now = dateOnly()) {
  const nextStep = Math.min((progress.reviewStep || 0) + 1, REVIEW_INTERVALS_DAYS.length - 1);
  return {
    ...trimErrorHistory(progress, 45, now),
    known: true,
    lastSuccessAt: now,
    lastReviewAt: now,
    lastSeenAt: now,
    reviewStep: nextStep,
    nextReviewAt: addDaysISO(REVIEW_INTERVALS_DAYS[nextStep]),
    correctCount: (progress.correctCount || 0) + 1
  };
}

export function scheduleFailure(progress, now = dateOnly()) {
  const recentErrors = errorsInLastDays(progress, 7, now) + 1;
  // One recent error gets a 2-day recovery. Repeated errors return tomorrow.
  const retryDays = recentErrors >= 2 ? 1 : 2;

  return {
    ...trimErrorHistory(progress, 45, now),
    known: false,
    learningStep: 0,
    lastFailureAt: now,
    lastSeenAt: now,
    lastReviewAt: progress.mastered ? now : progress.lastReviewAt,
    reviewStep: progress.mastered ? -1 : 0,
    nextReviewAt: progress.mastered ? addDaysISO(retryDays) : progress.nextReviewAt,
    totalErrorCount: (progress.totalErrorCount || 0) + 1,
    errorDates: [...(progress.errorDates || []), now]
  };
}

export function isDue(progress, now = dateOnly()) {
  return Boolean(progress.mastered && progress.nextReviewAt && progress.nextReviewAt <= now);
}

export function reviewUrgency(progress, now = dateOnly()) {
  if (!progress.mastered || !progress.nextReviewAt) return -Infinity;

  const overdueDays = Math.max(0, daysBetween(now, progress.nextReviewAt));
  const recentErrors = errorsInLastDays(progress, 7, now);
  const reference = progress.lastReviewAt || progress.learnedAt || progress.lastSeenAt || now;
  const daysWithoutPractice = Math.max(0, daysBetween(now, reference));

  // Overdue time is the main signal. Recent errors amplify it.
  return (overdueDays + 1) * (1 + recentErrors * 0.75) + daysWithoutPractice * 0.08;
}

export function buildReviewQueue(words, progressMap, now = dateOnly()) {
  return words
    .filter(word => isDue(progressMap.get(word.id) || {}, now))
    .sort((a, b) => {
      const aScore = reviewUrgency(progressMap.get(a.id) || {}, now);
      const bScore = reviewUrgency(progressMap.get(b.id) || {}, now);
      return bScore - aScore;
    });
}
