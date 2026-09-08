export const WEEKLY_GOALS_KEY = 'weeklyGoalsByType';

export const DEFAULT_WEEKLY_GOALS = {
  indoor: {
    distance: 80,
    time: 300,
    calories: 1125,
    steps: 0,
  },
  walk: {
    distance: 20,
    time: 240,
    calories: 800,
    steps: 45000,
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
  },
  walk: {
    ...DEFAULT_WEEKLY_GOALS.walk,
    ...(savedGoals?.walk || {}),
    steps: normalizeStepsGoal(savedGoals?.walk?.steps ?? DEFAULT_WEEKLY_GOALS.walk.steps),
  },
});
