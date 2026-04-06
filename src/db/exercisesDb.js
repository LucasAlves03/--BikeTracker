import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'biketracker.db';
const MIGRATION_FLAG_KEY = 'dbMigrationDone:v1';
const LEGACY_RECORDS_KEY = 'bikeRecords';

let dbPromise = null;

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).trim().replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInteger = (value) => {
  const parsed = Math.round(toNumber(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeRecordInput = (record = {}) => {
  const nowIso = new Date().toISOString();
  return {
    id: String(record.id || Date.now()),
    activityType: record.activityType || 'indoor',
    date: record.date || nowIso,
    displayDate: record.displayDate || '',
    displayTime: record.displayTime || '',
    time: toNumber(record.time),
    speed: toNumber(record.speed),
    calories: toNumber(record.calories),
    distance: toNumber(record.distance),
    steps:
      record.steps === undefined || record.steps === null || record.steps === ''
        ? null
        : toInteger(record.steps),
    createdAt: record.createdAt || nowIso,
    updatedAt: nowIso,
  };
};

const rowToLegacyShape = (row) => ({
  id: row.id,
  activityType: row.activity_type,
  date: row.date_iso,
  displayDate: row.display_date,
  displayTime: row.display_time,
  time: String(row.time),
  speed: String(row.speed),
  calories: String(row.calories),
  distance: String(row.distance),
  steps: row.steps === null || row.steps === undefined ? undefined : String(row.steps),
});

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
};

export const initExercisesDb = async () => {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      activity_type TEXT NOT NULL,
      date_iso TEXT NOT NULL,
      display_date TEXT,
      display_time TEXT,
      time REAL NOT NULL DEFAULT 0,
      speed REAL NOT NULL DEFAULT 0,
      calories REAL NOT NULL DEFAULT 0,
      distance REAL NOT NULL DEFAULT 0,
      steps INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_exercises_date_iso ON exercises (date_iso DESC);
    CREATE INDEX IF NOT EXISTS idx_exercises_activity_type ON exercises (activity_type);
  `);
};

export const upsertExercise = async (record) => {
  const db = await getDb();
  const normalized = normalizeRecordInput(record);
  await db.runAsync(
    `INSERT OR REPLACE INTO exercises (
      id, activity_type, date_iso, display_date, display_time,
      time, speed, calories, distance, steps, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalized.id,
      normalized.activityType,
      normalized.date,
      normalized.displayDate,
      normalized.displayTime,
      normalized.time,
      normalized.speed,
      normalized.calories,
      normalized.distance,
      normalized.steps,
      normalized.createdAt,
      normalized.updatedAt,
    ]
  );
  return normalized;
};

export const listExercises = async () => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
      id,
      activity_type,
      date_iso,
      display_date,
      display_time,
      time,
      speed,
      calories,
      distance,
      steps
    FROM exercises
    ORDER BY date_iso DESC`
  );
  return rows.map(rowToLegacyShape);
};

export const deleteExerciseById = async (id) => {
  if (!id) return;
  const db = await getDb();
  await db.runAsync(`DELETE FROM exercises WHERE id = ?`, [String(id)]);
};

export const clearExercises = async () => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM exercises`);
};

export const getExerciseCount = async () => {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT COUNT(*) as count FROM exercises`);
  return row?.count || 0;
};

export const migrateLegacyRecordsToDb = async () => {
  const migrationDone = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
  if (migrationDone === 'true') return { migrated: false, reason: 'already_migrated' };

  const legacy = await AsyncStorage.getItem(LEGACY_RECORDS_KEY);
  if (!legacy) {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return { migrated: false, reason: 'no_legacy_records' };
  }

  let parsed;
  try {
    parsed = JSON.parse(legacy);
  } catch (error) {
    console.error('Failed to parse legacy records during migration:', error);
    parsed = [];
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return { migrated: false, reason: 'empty_legacy_records' };
  }

  const db = await getDb();
  await db.execAsync('BEGIN');
  try {
    for (const record of parsed) {
      const normalized = normalizeRecordInput(record);
      await db.runAsync(
        `INSERT OR REPLACE INTO exercises (
          id, activity_type, date_iso, display_date, display_time,
          time, speed, calories, distance, steps, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          normalized.activityType,
          normalized.date,
          normalized.displayDate,
          normalized.displayTime,
          normalized.time,
          normalized.speed,
          normalized.calories,
          normalized.distance,
          normalized.steps,
          normalized.createdAt,
          normalized.updatedAt,
        ]
      );
    }
    await db.execAsync('COMMIT');
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return { migrated: true, migratedCount: parsed.length };
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('Legacy migration failed:', error);
    throw error;
  }
};

export const bootstrapExercisesDb = async () => {
  await initExercisesDb();
  const migrationResult = await migrateLegacyRecordsToDb();
  return migrationResult;
};

export const getLegacyRecordCount = async () => {
  const legacy = await AsyncStorage.getItem(LEGACY_RECORDS_KEY);
  if (!legacy) return 0;
  try {
    const parsed = JSON.parse(legacy);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

export const getMigrationFlag = async () => {
  return AsyncStorage.getItem(MIGRATION_FLAG_KEY);
};

export const getDbDebugSnapshot = async () => {
  const db = await getDb();
  const countRow = await db.getFirstAsync(`SELECT COUNT(*) as count FROM exercises`);
  const recentRows = await db.getAllAsync(
    `SELECT id, activity_type, date_iso, time, distance, calories, speed, steps
     FROM exercises
     ORDER BY date_iso DESC
     LIMIT 20`
  );
  const migrationFlag = await getMigrationFlag();
  const legacyCount = await getLegacyRecordCount();

  return {
    migrationFlag: migrationFlag || 'null',
    exerciseCount: countRow?.count || 0,
    legacyCount,
    recentRows,
  };
};

export const resetMigrationFlagForDebug = async () => {
  await AsyncStorage.removeItem(MIGRATION_FLAG_KEY);
};
