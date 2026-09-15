import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const BACKUP_FORMAT = 'biketracker-backup';
const BACKUP_VERSION = 1;
const BACKUP_FILE_PREFIX = 'biketracker-backup';
export const BACKUP_METADATA_KEY = 'backupMetadata';

const STORAGE_KEYS = [
  'exerciseRecords',
  'userProfile',
  'weeklyGoalsByType',
  'notifications',
  'lastWeekReset',
  'goalsCompletedThisWeek:indoor',
  'goalsCompletedThisWeek:walk',
];

const parseJsonValue = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const isValidBackup = (backup) => {
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) return false;
  if (!backup.data || !Array.isArray(backup.data.exerciseRecords)) return false;
  if (backup.data.userProfile !== null && typeof backup.data.userProfile !== 'object') return false;
  if (backup.data.weeklyGoalsByType !== null && typeof backup.data.weeklyGoalsByType !== 'object') return false;
  return true;
};

const getStoredData = async () => {
  const entries = await AsyncStorage.multiGet(STORAGE_KEYS);
  return entries.reduce((data, [key, value]) => {
    data[key] = parseJsonValue(value, value);
    return data;
  }, {});
};

export const getBackupMetadata = async () => {
  const savedMetadata = await AsyncStorage.getItem(BACKUP_METADATA_KEY);
  return parseJsonValue(savedMetadata, null);
};

export const exportBackup = async () => {
  const data = await getStoredData();
  const exportedAt = new Date().toISOString();
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data,
  };
  const fileUri = `${FileSystem.cacheDirectory}${BACKUP_FILE_PREFIX}-${exportedAt.replace(/[:.]/g, '-')}.json`;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup do BikeTracker',
    UTI: 'public.json',
  });

  const metadata = {
    exportedAt,
    exerciseCount: data.exerciseRecords.length,
  };
  await AsyncStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
  return metadata;
};

export const importBackup = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const contents = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  let backup;
  try {
    backup = JSON.parse(contents);
  } catch {
    throw new Error('O arquivo selecionado nao contem um JSON valido');
  }

  if (!isValidBackup(backup)) {
    throw new Error('Este arquivo nao e um backup valido do BikeTracker');
  }

  const valuesToSave = STORAGE_KEYS
    .filter((key) => backup.data[key] !== undefined && backup.data[key] !== null)
    .map((key) => [key, JSON.stringify(backup.data[key])]);
  const keysToRemove = STORAGE_KEYS.filter((key) => backup.data[key] === null);

  if (valuesToSave.length > 0) await AsyncStorage.multiSet(valuesToSave);
  if (keysToRemove.length > 0) await AsyncStorage.multiRemove(keysToRemove);
  await AsyncStorage.removeItem(BACKUP_METADATA_KEY);

  return {
    exportedAt: backup.exportedAt,
    exerciseCount: backup.data.exerciseRecords.length,
  };
};
