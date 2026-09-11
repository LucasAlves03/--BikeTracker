import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_WEEKLY_GOALS, WEEKLY_GOALS_KEY, normalizeWeeklyGoals } from './weeklyGoals';

const EXERCISE_RECORDS_KEY = 'exerciseRecords';
const TEST_BACKUP_KEY = 'testDataOriginalRecords';
const TEST_RECORD_PREFIX = '__bike_tracker_test__';

const randomBetween = (minimum, maximum) =>
  minimum + Math.random() * (maximum - minimum);

const round = (value, decimals = 0) => {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
};

const readRecords = async () => {
  const savedRecords = await AsyncStorage.getItem(EXERCISE_RECORDS_KEY);
  if (!savedRecords) return [];

  const parsedRecords = JSON.parse(savedRecords);
  return Array.isArray(parsedRecords) ? parsedRecords : [];
};

const formatDisplayDate = (date) =>
  date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const formatDisplayTime = (date) =>
  date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const createRecord = ({ date, activityType, index, values = {} }) => {
  const distance = values.distance ?? round(
    activityType === 'walk' ? randomBetween(1.5, 8) : randomBetween(4, 18),
    1
  );
  const time = values.time ?? Math.round(
    activityType === 'walk' ? randomBetween(20, 70) : randomBetween(25, 85)
  );
  const speed = values.speed ?? round(distance / (time / 60), 1);
  const calories = values.calories ?? Math.round(
    activityType === 'walk' ? randomBetween(100, 350) : randomBetween(180, 550)
  );
  const steps = values.steps ?? (activityType === 'walk' ? Math.round(distance * 1300) : undefined);

  return {
    id: `${TEST_RECORD_PREFIX}${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    activityType,
    date: date.toISOString(),
    displayDate: formatDisplayDate(date),
    displayTime: formatDisplayTime(date),
    time: String(time),
    speed: String(speed),
    calories: String(calories),
    distance: String(distance),
    steps: activityType === 'walk' ? String(steps) : undefined,
  };
};

const saveWithBackup = async (newRecords) => {
  const records = await readRecords();
  const backup = await AsyncStorage.getItem(TEST_BACKUP_KEY);
  if (!backup) {
    await AsyncStorage.setItem(TEST_BACKUP_KEY, JSON.stringify(records));
  }
  await AsyncStorage.setItem(EXERCISE_RECORDS_KEY, JSON.stringify([...newRecords, ...records]));
  return newRecords.length;
};

export const countGeneratedRecords = async () => {
  const records = await readRecords();
  return records.filter((record) => record.id?.startsWith(TEST_RECORD_PREFIX)).length;
};

export const addRandomRecords = async (count) => {
  const records = Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));
    date.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
    const activityType = Math.random() > 0.5 ? 'walk' : 'indoor';
    return createRecord({ date, activityType, index });
  });

  return saveWithBackup(records);
};

export const addCompletedWeek = async () => {
  const savedGoals = await AsyncStorage.getItem(WEEKLY_GOALS_KEY);
  const goals = normalizeWeeklyGoals(
    savedGoals ? JSON.parse(savedGoals) : DEFAULT_WEEKLY_GOALS
  );
  const target = {
    time: (Number(goals.indoor.time) + Number(goals.walk.time)) * 1.15,
    distance: (Number(goals.indoor.distance) + Number(goals.walk.distance)) * 1.15,
    calories: (Number(goals.indoor.calories) + Number(goals.walk.calories)) * 1.15,
    steps: (Number(goals.indoor.steps) + Number(goals.walk.steps)) * 1.15,
  };
  const walkingSessions = 4;
  const today = new Date();
  const records = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    date.setHours(8 + (index % 4), 30, 0, 0);
    const activityType = index % 2 === 0 ? 'indoor' : 'walk';
    const distance = target.distance / 7;
    const time = target.time / 7;
    const calories = target.calories / 7;
    const steps = target.steps / walkingSessions;

    return createRecord({
      date,
      activityType,
      index,
      values: {
        distance: round(distance, 1),
        time: Math.max(1, Math.round(time)),
        speed: round(distance / (time / 60), 1),
        calories: Math.max(1, Math.round(calories)),
        steps: Math.max(1, Math.round(steps)),
      },
    });
  });

  return saveWithBackup(records);
};

export const clearGeneratedRecords = async () => {
  const records = await readRecords();
  const cleanRecords = records.filter((record) => !record.id?.startsWith(TEST_RECORD_PREFIX));
  await AsyncStorage.setItem(EXERCISE_RECORDS_KEY, JSON.stringify(cleanRecords));
  await AsyncStorage.removeItem(TEST_BACKUP_KEY);
  return records.length - cleanRecords.length;
};

export const restoreOriginalRecords = async () => {
  const backup = await AsyncStorage.getItem(TEST_BACKUP_KEY);
  if (!backup) return false;

  await AsyncStorage.setItem(EXERCISE_RECORDS_KEY, backup);
  await AsyncStorage.removeItem(TEST_BACKUP_KEY);
  return true;
};
