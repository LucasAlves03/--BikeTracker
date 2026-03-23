import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const TRACKER_OPTIONS = ['indoor', 'walk'];

const METRICS_BY_TYPE = {
  indoor: [
    { key: 'distance', label: 'Distancia (km)', unit: 'km' },
    { key: 'time', label: 'Tempo (min)', unit: 'min' },
    { key: 'calories', label: 'Calorias', unit: 'kcal' },
  ],
  walk: [
    { key: 'distance', label: 'Distancia (km)', unit: 'km' },
    { key: 'time', label: 'Tempo (min)', unit: 'min' },
    { key: 'calories', label: 'Calorias', unit: 'kcal' },
    { key: 'steps', label: 'Passos', unit: 'steps' },
  ],
};

const getTrackerLabel = (type) => (type === 'walk' ? 'Caminhada' : 'Bic. Ergometrica');

const normalizeGoalNumber = (value) => {
  const parsed = parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const normalizeStepsNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
  const digits = String(value).replace(/[^\d]/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
};

export default function WeeklyGoalsSetupModal({
  visible,
  onClose,
  onSave,
  goalsByType,
  statsByType,
}) {
  const [activeType, setActiveType] = useState('indoor');
  const [draftGoals, setDraftGoals] = useState(goalsByType);

  useEffect(() => {
    if (visible) {
      setDraftGoals(goalsByType);
    }
  }, [visible, goalsByType]);

  const activeMetrics = useMemo(() => METRICS_BY_TYPE[activeType], [activeType]);

  const updateGoal = (metricKey, rawValue) => {
    setDraftGoals((prev) => ({
      ...prev,
      [activeType]: {
        ...prev[activeType],
        [metricKey]: rawValue,
      },
    }));
  };

  const handleSave = () => {
    const normalized = {
      indoor: {
        distance: normalizeGoalNumber(draftGoals.indoor?.distance),
        time: normalizeGoalNumber(draftGoals.indoor?.time),
        calories: normalizeGoalNumber(draftGoals.indoor?.calories),
        steps: 0,
      },
      walk: {
        distance: normalizeGoalNumber(draftGoals.walk?.distance),
        time: normalizeGoalNumber(draftGoals.walk?.time),
        calories: normalizeGoalNumber(draftGoals.walk?.calories),
        steps: normalizeStepsNumber(draftGoals.walk?.steps),
      },
    };

    onSave(normalized);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Configurar Metas Semanais</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            {TRACKER_OPTIONS.map((type) => {
              const isActive = activeType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.toggleButton, isActive && styles.toggleButtonActive]}
                  onPress={() => setActiveType(type)}
                >
                  <Text style={[styles.toggleText, isActive && styles.toggleTextActive]}>
                    {getTrackerLabel(type)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {activeMetrics.map((metric) => {
              const goalValue = draftGoals?.[activeType]?.[metric.key] ?? 0;
              const currentValue = statsByType?.[activeType]?.[`total${metric.key[0].toUpperCase()}${metric.key.slice(1)}`] ?? 0;
              const safeGoal = normalizeGoalNumber(goalValue);
              const safeCurrent = normalizeGoalNumber(currentValue);
              const progress = safeGoal > 0 ? Math.min(Math.round((safeCurrent / safeGoal) * 100), 100) : 0;

              return (
                <View key={metric.key} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={String(goalValue)}
                    onChangeText={(text) => updateGoal(metric.key, text)}
                    placeholder={`Meta ${metric.unit}`}
                    placeholderTextColor="#64748B"
                  />
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    Atual: {safeCurrent} {metric.unit} | Meta: {safeGoal} {metric.unit} ({progress}%)
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.ghostButton} onPress={onClose}>
              <Text style={styles.ghostButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>Salvar Metas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '85%',
    backgroundColor: '#0B1220',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '800',
  },
  close: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#22D3EE',
  },
  toggleText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  toggleTextActive: {
    color: '#04121C',
  },
  scroll: {
    maxHeight: 430,
  },
  metricCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  metricLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22D3EE',
    borderRadius: 999,
  },
  progressText: {
    marginTop: 7,
    color: '#94A3B8',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  ghostButton: {
    flex: 1,
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#22D3EE',
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#03111A',
    fontWeight: '800',
  },
});
