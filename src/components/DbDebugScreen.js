import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  bootstrapExercisesDb,
  clearExercises,
  getDbDebugSnapshot,
  resetMigrationFlagForDebug,
} from '../db/exercisesDb';

export default function DbDebugScreen() {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState({
    migrationFlag: 'loading',
    exerciseCount: 0,
    legacyCount: 0,
    recentRows: [],
  });

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getDbDebugSnapshot();
      setSnapshot(next);
    } catch (error) {
      console.error('DB debug snapshot error:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do banco');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSnapshot();
    }, [loadSnapshot])
  );

  const handleRunMigration = async () => {
    try {
      setLoading(true);
      const result = await bootstrapExercisesDb();
      Alert.alert('Migração', JSON.stringify(result));
      await loadSnapshot();
    } catch (error) {
      console.error('DB migration error:', error);
      Alert.alert('Erro', 'Falha ao executar migração');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDb = async () => {
    Alert.alert('Limpar banco', 'Deseja apagar todas as sessões no SQLite?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await clearExercises();
            await loadSnapshot();
          } catch (error) {
            console.error('Clear DB error:', error);
            Alert.alert('Erro', 'Falha ao limpar banco');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleResetMigrationFlag = async () => {
    try {
      setLoading(true);
      await resetMigrationFlagForDebug();
      await loadSnapshot();
    } catch (error) {
      console.error('Reset migration flag error:', error);
      Alert.alert('Erro', 'Falha ao resetar flag de migração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DB Debug</Text>
      <Text style={styles.subtitle}>SQLite + migration state</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>SQLite sessões</Text>
          <Text style={styles.statValue}>{snapshot.exerciseCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Legacy sessões</Text>
          <Text style={styles.statValue}>{snapshot.legacyCount}</Text>
        </View>
      </View>

      <View style={styles.flagCard}>
        <Text style={styles.flagLabel}>Migration flag</Text>
        <Text style={styles.flagValue}>{snapshot.migrationFlag}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={loadSnapshot} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Carregando...' : 'Refresh'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleRunMigration} disabled={loading}>
          <Text style={styles.buttonText}>Run migration</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.warnButton} onPress={handleResetMigrationFlag} disabled={loading}>
          <Text style={styles.buttonText}>Reset migration flag</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton} onPress={handleClearDb} disabled={loading}>
          <Text style={styles.buttonText}>Clear SQLite</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent rows</Text>
      <ScrollView style={styles.list}>
        {snapshot.recentRows.length === 0 ? (
          <Text style={styles.empty}>No rows</Text>
        ) : (
          snapshot.recentRows.map((row) => (
            <View style={styles.rowCard} key={row.id}>
              <Text style={styles.rowTitle}>{row.activity_type} - {row.date_iso}</Text>
              <Text style={styles.rowMeta}>
                time {row.time} | dist {row.distance} | cal {row.calories} | speed {row.speed} | steps {row.steps ?? '-'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  flagCard: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  flagLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  flagValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  warnButton: {
    backgroundColor: '#9A3412',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  empty: {
    color: '#94A3B8',
    fontSize: 14,
  },
  rowCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginBottom: 8,
  },
  rowTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  rowMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
});
