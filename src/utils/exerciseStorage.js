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
