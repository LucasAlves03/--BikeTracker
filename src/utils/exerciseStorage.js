import AsyncStorage from '@react-native-async-storage/async-storage';

const EXERCISE_RECORDS_KEY = 'exerciseRecords';

const normalizeRecord = (record) => ({
  ...record,
  activityType: record.activityType || 'indoor',
});

export const listExerciseRecords = async () => {
  const savedRecords = await AsyncStorage.getItem(EXERCISE_RECORDS_KEY);
  if (!savedRecords) return [];

  const parsedRecords = JSON.parse(savedRecords);
  if (!Array.isArray(parsedRecords)) return [];

  return parsedRecords
    .map(normalizeRecord)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getExerciseStreak = (records, referenceDate = new Date()) => {
  if (records.length === 0) return 0;

  let streak = 0;
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  for (const record of records) {
    const recordDate = new Date(record.date);
    recordDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24));

    if (diffDays === streak) {
      streak++;
    } else if (diffDays > streak) {
      break;
    }
  }

  return streak;
};

export const saveExerciseRecord = async (record) => {
  const records = await listExerciseRecords();
  const nextRecords = [normalizeRecord(record), ...records];
  await AsyncStorage.setItem(EXERCISE_RECORDS_KEY, JSON.stringify(nextRecords));
  return nextRecords;
};

export const deleteExerciseRecord = async (id) => {
  const records = await listExerciseRecords();
  const nextRecords = records.filter((record) => record.id !== id);
  await AsyncStorage.setItem(EXERCISE_RECORDS_KEY, JSON.stringify(nextRecords));
  return nextRecords;
};
