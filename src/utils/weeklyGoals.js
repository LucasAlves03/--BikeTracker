export const WEEKLY_GOALS_KEY = 'weeklyGoalsByType';
export const COMPLETED_WEEKLY_GOALS_KEY = 'completedWeeklyGoals';

export const DEFAULT_WEEKLY_GOALS = {
  indoor: {
    distance: 80,
    time: 300,
    calories: 1125,
    steps: 0,
    runningTime: 0,
  },
  walk: {
    distance: 20,
    time: 240,
    calories: 800,
    steps: 45000,
    runningTime: 0,
  },
};

export const normalizeStepsGoal = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

export const normalizeWeeklyGoals = (savedGoals) => ({
  indoor: {
    ...DEFAULT_WEEKLY_GOALS.indoor,
    ...(savedGoals?.indoor || {}),
    steps: 0,
    runningTime: 0,
  },
  walk: {
    ...DEFAULT_WEEKLY_GOALS.walk,
    ...(savedGoals?.walk || {}),
    steps: normalizeStepsGoal(savedGoals?.walk?.steps ?? DEFAULT_WEEKLY_GOALS.walk.steps),
    runningTime: Number.isFinite(Number(savedGoals?.walk?.runningTime))
      ? Math.max(0, Number(savedGoals.walk.runningTime))
      : DEFAULT_WEEKLY_GOALS.walk.runningTime,
  },
});

export const getMondayOfWeek = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const daysFromMonday = date.getDay() === 0 ? 6 : date.getDay() - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const getNextMondayOfWeek = (dateValue = new Date()) => {
  const nextMonday = getMondayOfWeek(dateValue);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return nextMonday;
};
