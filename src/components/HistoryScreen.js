import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BikeContext } from '../context/BikeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { deleteExerciseRecord, listExerciseRecords } from '../utils/exerciseStorage';
import { DEFAULT_WEEKLY_GOALS, WEEKLY_GOALS_KEY, normalizeWeeklyGoals } from '../utils/weeklyGoals';

const TOP_SAFE_OFFSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 44;

const getActivityStyle = (type) =>
  type === 'walk'
    ? { accent: '#38BDF8', soft: '#082F49', icon: 'walk-outline', label: 'Caminhada' }
    : { accent: '#A3E635', soft: '#1A2E05', icon: 'bicycle-outline', label: 'Bicicleta ergométrica' };

const getDateGroupLabel = (dateValue) => {
  const date = new Date(dateValue);
  const today = new Date();
  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const difference = Math.round((startOfDay(today) - startOfDay(date)) / (24 * 60 * 60 * 1000));

  if (difference === 0) return 'Hoje';
  if (difference === 1) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
};

export default function HistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('all'); 
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [weeklyGoalsByType, setWeeklyGoalsByType] = useState(DEFAULT_WEEKLY_GOALS);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const scrollViewRef = useRef(null);
  const cardPositionsRef = useRef({});
  const { refreshTrigger } = useContext(BikeContext);

  useFocusEffect(
    React.useCallback(() => {
      loadRecords();
      loadWeeklyGoals();
    }, [refreshTrigger])
  );

  const loadRecords = async () => {
    try {
      const savedRecords = await listExerciseRecords();
      setRecords(savedRecords);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const loadWeeklyGoals = async () => {
    try {
      const savedGoals = await AsyncStorage.getItem(WEEKLY_GOALS_KEY);
      setWeeklyGoalsByType(normalizeWeeklyGoals(savedGoals ? JSON.parse(savedGoals) : null));
    } catch (error) {
      console.error('Error loading history weekly goals:', error);
      setWeeklyGoalsByType(DEFAULT_WEEKLY_GOALS);
    }
  };

  const getDayKey = (dateValue) => {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFilteredRecords = () => {
    const now = new Date();
    
    if (filter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return records.filter(r => new Date(r.date) >= oneWeekAgo);
    } else if (filter === 'month') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return records.filter(r => new Date(r.date) >= oneMonthAgo);
    }
    
    return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const deleteRecord = async (id) => {
    Alert.alert(
      'Excluir Registro',
      'Tem certeza que deseja excluir este exercício?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const updatedRecords = records.filter(record => record.id !== id);
            try {
              await deleteExerciseRecord(id);
              setRecords(updatedRecords);
              setSelectedRecord(null);
            } catch (error) {
              console.error('Error deleting record:', error);
            }
          },
        },
      ]
    );
  };

  const getActivityType = (record) => record.activityType || 'indoor';

  const parseMetricNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value).trim().replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const getMetricNumericValue = (record, key) => {
    if (!record) return 0;
    if (key === 'steps') return parseInt(record.steps || 0, 10) || 0;
    return parseMetricNumber(record[key]);
  };

  const formatMetricDisplayValue = (value, unit) => {
    if (unit === 'steps') return `${Math.round(value)}`;
    if (unit === 'kcal' || unit === 'min') return `${Math.round(value)} ${unit}`;
    return `${value.toFixed(1)} ${unit}`;
  };

  const selectedReport = (() => {
    if (!selectedRecord) return null;

    const activityType = getActivityType(selectedRecord);
    const goals = weeklyGoalsByType[activityType] || DEFAULT_WEEKLY_GOALS[activityType];
    const now = new Date();
    const day = now.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weeklyRecords = records.filter((record) => {
      const recordDate = new Date(record.date).getTime();
      return (
        getActivityType(record) === activityType &&
        Number.isFinite(recordDate) &&
        recordDate >= weekStart.getTime() &&
        recordDate < weekEnd.getTime()
      );
    });
    const weeklyTotals = {
      distance: weeklyRecords.reduce((sum, record) => sum + getMetricNumericValue(record, 'distance'), 0),
      time: weeklyRecords.reduce((sum, record) => sum + getMetricNumericValue(record, 'time'), 0),
      calories: weeklyRecords.reduce((sum, record) => sum + getMetricNumericValue(record, 'calories'), 0),
      steps: weeklyRecords.reduce((sum, record) => sum + getMetricNumericValue(record, 'steps'), 0),
    };
    const progressMetrics = [
      { key: 'distance', label: 'Distância', unit: 'km', color: '#668DC4' },
      { key: 'time', label: 'Tempo', unit: 'min', color: '#62A77C' },
      { key: 'calories', label: 'Calorias', unit: 'kcal', color: '#C95C5C' },
      ...(activityType === 'walk' && goals.steps > 0
        ? [{ key: 'steps', label: 'Passos', unit: 'steps', color: '#624E8C' }]
        : []),
    ].map((metric) => {
      const current = weeklyTotals[metric.key];
      const goal = getMetricNumericValue(goals, metric.key);
      const percent = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;
      return { ...metric, current, goal, percent };
    });
    const bestMetrics = ['distance', 'speed', 'calories'].filter((metric) => {
      const selectedValue = getMetricNumericValue(selectedRecord, metric);
      return selectedValue > 0 && records.every((record) => {
        return getActivityType(record) !== activityType || getMetricNumericValue(record, metric) <= selectedValue;
      });
    });

    return {
      activityType,
      activity: getActivityStyle(activityType),
      progressMetrics,
      bestMetrics,
      weeklyRecordsCount: weeklyRecords.length,
    };
  })();

  useFocusEffect(
    React.useCallback(() => {
      const highlightDate = params.highlightDate;
      if (highlightDate) {
        setFilter('all');
        setActiveHighlight({
          date: highlightDate,
          type: params.highlightType || null,
          requestId: params.highlightRequestId || Date.now(),
        });
        router.setParams({
          highlightDate: undefined,
          highlightType: undefined,
          highlightRequestId: undefined,
        });
      }
    }, [
      params.highlightDate,
      params.highlightType,
      params.highlightRequestId,
      router,
    ])
  );

  const filteredRecords = getFilteredRecords();
  const groupedRecords = useMemo(() => {
    const groups = [];

    filteredRecords.forEach((record) => {
      const groupKey = getDayKey(record.date);
      const existingGroup = groups.find((group) => group.key === groupKey);

      if (existingGroup) {
        existingGroup.records.push(record);
      } else {
        groups.push({
          key: groupKey,
          label: getDateGroupLabel(record.date),
          records: [record],
        });
      }
    });

    return groups;
  }, [filteredRecords]);
  const highlightRecordIds = useMemo(() => {
    if (!activeHighlight?.date) return [];
    return filteredRecords
      .filter((record) => {
        const matchesDate = getDayKey(record.date) === activeHighlight.date;
        const matchesType =
          !activeHighlight.type || getActivityType(record) === activeHighlight.type;
        return matchesDate && matchesType;
      })
      .map((record) => record.id);
  }, [activeHighlight, filteredRecords]);

  useEffect(() => {
    if (!highlightRecordIds.length) return;
    const firstMatchId = highlightRecordIds[0];
    const y = cardPositionsRef.current[firstMatchId];
    if (typeof y === 'number' && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(y - 24, 0), animated: true });
    }
  }, [highlightRecordIds]);

  return (
    <View style={styles.container}>
      <View
        style={styles.header}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <Text style={styles.headerTitle}>Histórico</Text>
        <Text style={styles.headerSubtitle}>Todas as suas sessões</Text>
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.filterSection}>
          {[
            { key: 'week', label: '7 dias' },
            { key: 'month', label: '30 dias' },
            { key: 'all', label: 'Tudo' },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.filterButton, filter === option.key && styles.filterButtonActive]}
              onPress={() => setFilter(option.key)}
            >
              <Text style={[styles.filterText, filter === option.key && styles.filterTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.historySection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>ATIVIDADE</Text>
              <Text style={styles.sectionTitle}>Sua jornada</Text>
            </View>
            <View style={styles.sessionCountBadge}>
              <Text style={styles.sessionCount}>{filteredRecords.length}</Text>
              <Text style={styles.sessionCountLabel}>sessões</Text>
            </View>
          </View>

          {filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="footsteps-outline" size={28} color="#38BDF8" />
              </View>
              <Text style={styles.emptyText}>Nada por aqui ainda</Text>
              <Text style={styles.emptySubtext}>Registre um exercício e acompanhe sua evolução nesta linha do tempo.</Text>
            </View>
          ) : (
            <View style={styles.timelineContainer}>
              {groupedRecords.map((group) => (
                <View key={group.key} style={styles.timelineGroup}>
                  <Text style={styles.dateGroupLabel}>{group.label}</Text>
                  {group.records.map((record, index) => {
                    const activity = getActivityStyle(getActivityType(record));
                    const isHighlighted = highlightRecordIds.includes(record.id);
                    const isLast = index === group.records.length - 1;

                    return (
                      <View
                        key={record.id}
                        onLayout={(event) => {
                          cardPositionsRef.current[record.id] = event.nativeEvent.layout.y;
                        }}
                        style={styles.timelineRow}
                      >
                        <View style={styles.timelineRail}>
                          <View style={[styles.timelineDot, { backgroundColor: activity.accent }]}>
                            <Ionicons name={activity.icon} size={16} color="#07111F" />
                          </View>
                          {!isLast && <View style={styles.timelineLine} />}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.activityCard,
                            { borderLeftColor: activity.accent },
                            isHighlighted && styles.activityCardHighlighted,
                          ]}
                          onPress={() => setSelectedRecord(record)}
                          activeOpacity={0.86}
                        >
                          <View style={styles.activityCardHeader}>
                            <View style={styles.activityCardTitleWrap}>
                              <Text style={styles.activityCardTitle}>{activity.label}</Text>
                              <Text style={styles.activityCardTime}>{record.displayTime}</Text>
                            </View>
                            <View style={[styles.activityPill, { backgroundColor: activity.soft }]}>
                              <Text style={[styles.activityPillText, { color: activity.accent }]}>Detalhes</Text>
                              <Ionicons name="arrow-forward" size={14} color={activity.accent} />
                            </View>
                          </View>
                          <View style={styles.activityMetricRow}>
                            <View style={styles.activityMetric}>
                              <Text style={styles.activityMetricValue}>{formatMetricDisplayValue(getMetricNumericValue(record, 'distance'), 'km')}</Text>
                              <Text style={styles.activityMetricLabel}>distância</Text>
                            </View>
                            <View style={styles.activityMetric}>
                              <Text style={styles.activityMetricValue}>{formatMetricDisplayValue(getMetricNumericValue(record, 'time'), 'min')}</Text>
                              <Text style={styles.activityMetricLabel}>tempo</Text>
                            </View>
                            <View style={styles.activityMetric}>
                              <Text style={styles.activityMetricValue}>{formatMetricDisplayValue(getMetricNumericValue(record, 'calories'), 'kcal')}</Text>
                              <Text style={styles.activityMetricLabel}>energia</Text>
                            </View>
                            {getActivityType(record) === 'walk' && record.steps ? (
                              <View style={styles.activityMetric}>
                                <Text style={styles.activityMetricValue}>{getMetricNumericValue(record, 'steps').toLocaleString('pt-BR')}</Text>
                                <Text style={styles.activityMetricLabel}>passos</Text>
                              </View>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>

        <Modal
          visible={!!selectedRecord}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setSelectedRecord(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {selectedRecord && (
                <>
                  <View style={styles.modalTopHeader}>
                    <View>
                      <Text style={styles.modalTopHeaderKicker}>DESEMPENHO</Text>
                      <Text style={styles.modalTopHeaderTitle}>Dados da sessão</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.modalTopCloseButton}
                      onPress={() => setSelectedRecord(null)}
                    >
                      <Ionicons name="close" size={20} color="#E2E8F0" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={styles.modalBodyScroll}
                    contentContainerStyle={styles.modalBodyContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.athleticHeader}>
                      <View style={[styles.athleticActivityIcon, { backgroundColor: selectedReport.activity.soft }]}>
                        <Ionicons
                          name={selectedReport.activity.icon}
                          size={24}
                          color={selectedReport.activity.accent}
                        />
                      </View>
                      <View style={styles.athleticHeaderCopy}>
                        <Text style={styles.athleticActivityName}>{selectedReport.activity.label}</Text>
                        <Text style={styles.athleticDateText}>
                          {selectedRecord.displayDate} às {selectedRecord.displayTime}
                        </Text>
                      </View>
                      <View style={styles.sessionCountBadge}>
                        <Text style={styles.athleticSessionLabel}>SESSÃO</Text>
                        <Text style={styles.athleticSessionNumber}>{selectedReport.weeklyRecordsCount}</Text>
                      </View>
                    </View>

                    <View style={styles.largeMetricRow}>
                      <View style={styles.largeMetric}>
                        <Text style={styles.largeMetricLabel}>DISTÂNCIA</Text>
                        <Text style={styles.largeMetricValue}>{formatMetricDisplayValue(getMetricNumericValue(selectedRecord, 'distance'), 'km')}</Text>
                      </View>
                      <View style={styles.largeMetricDivider} />
                      <View style={styles.largeMetric}>
                        <Text style={styles.largeMetricLabel}>VELOCIDADE</Text>
                        <Text style={styles.largeMetricValue}>{formatMetricDisplayValue(getMetricNumericValue(selectedRecord, 'speed'), 'km/h')}</Text>
                      </View>
                      <View style={styles.largeMetricDivider} />
                      <View style={styles.largeMetric}>
                        <Text style={styles.largeMetricLabel}>CALORIAS</Text>
                        <Text style={styles.largeMetricValue}>{formatMetricDisplayValue(getMetricNumericValue(selectedRecord, 'calories'), 'kcal')}</Text>
                      </View>
                    </View>

                    <Text style={styles.reportSectionTitle}>Meta semanal</Text>
                    <View style={styles.progressList}>
                      {selectedReport.progressMetrics.map((metric) => (
                        <View style={styles.progressMetric} key={metric.key}>
                          <View style={styles.progressMetricHeader}>
                            <Text style={styles.progressMetricLabel}>{metric.label}</Text>
                            <Text style={styles.progressMetricValue}>
                              {formatMetricDisplayValue(metric.current, metric.unit)} / {formatMetricDisplayValue(metric.goal, metric.unit)}
                            </Text>
                          </View>
                          <View style={styles.performanceTrack}>
                            <View style={[styles.performanceFill, { width: `${metric.percent}%`, backgroundColor: metric.color }]} />
                          </View>
                          <Text style={styles.progressPercent}>{metric.percent}% da meta</Text>
                        </View>
                      ))}
                    </View>

                    {selectedReport.bestMetrics.length > 0 && (
                      <View style={styles.bestResultCard}>
                        <View style={styles.bestResultIcon}>
                          <Ionicons name="trophy-outline" size={20} color="#FBBF24" />
                        </View>
                        <View style={styles.bestResultCopy}>
                          <Text style={styles.bestResultTitle}>Melhor resultado</Text>
                          <Text style={styles.bestResultText}>
                            {selectedReport.bestMetrics.map((metric) => metric === 'distance' ? 'distância' : metric === 'speed' ? 'velocidade' : 'calorias').join(' e ')} nesta modalidade.
                          </Text>
                        </View>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.deleteReportButton}
                      onPress={() => deleteRecord(selectedRecord.id)}
                    >
                      <Ionicons name="trash-outline" size={17} color="#FDA4AF" />
                      <Text style={styles.deleteReportText}>Excluir sessão</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 140,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#0F172A',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  sectionTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  sectionEyebrow: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  sessionCountBadge: {
    alignItems: 'flex-end',
  },
  sessionCount: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  sessionCountLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  filterSection: {
    flexDirection: 'row',
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 14,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 4,
  },
  filterButton: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#38BDF8',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterTextActive: {
    color: '#07111F',
  },
  historySection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  timelineContainer: {
    paddingLeft: 2,
  },
  timelineGroup: {
    marginBottom: 22,
  },
  dateGroupLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'capitalize',
    marginBottom: 13,
    marginLeft: 40,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 142,
  },
  timelineRail: {
    width: 40,
    alignItems: 'center',
    position: 'relative',
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    top: 34,
    bottom: 0,
    width: 1,
    backgroundColor: '#334155',
  },
  activityCard: {
    flex: 1,
    minHeight: 126,
    marginLeft: 10,
    marginBottom: 16,
    padding: 15,
    borderRadius: 16,
    borderLeftWidth: 3,
    backgroundColor: '#111C30',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#1E293B',
    borderRightColor: '#1E293B',
    borderBottomColor: '#1E293B',
  },
  activityCardHighlighted: {
    borderTopColor: '#F8FAFC',
    borderRightColor: '#F8FAFC',
    borderBottomColor: '#F8FAFC',
  },
  activityCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  activityCardTitleWrap: {
    flex: 1,
  },
  activityCardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  activityCardTime: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  activityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activityPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  activityMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityMetric: {
    flex: 1,
  },
  activityMetricValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  activityMetricLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#020617',
  },
  modalCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 0,
    overflow: 'hidden',
  },
  modalTopHeader: {
    paddingTop: TOP_SAFE_OFFSET + 2,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTopHeaderKicker: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  modalTopHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  modalTopCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#212529',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBodyScroll: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  athleticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 24,
  },
  athleticActivityIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  athleticHeaderCopy: {
    flex: 1,
    marginLeft: 13,
  },
  athleticActivityName: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 6,
  },
  athleticDateText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  athleticSessionLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  athleticSessionNumber: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  largeMetricRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 23,
    paddingHorizontal: 5,
    marginBottom: 32,
    borderRadius: 15,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#020617',
  },
  largeMetric: {
    flex: 1,
    alignItems: 'center',
  },
  largeMetricDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
  largeMetricLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  largeMetricValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  progressList: {
    marginBottom: 22,
  },
  progressMetric: {
    marginBottom: 15,
  },
  progressMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  progressMetricLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
  },
  progressMetricValue: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  performanceTrack: {
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  performanceFill: {
    height: '100%',
    borderRadius: 8,
  },
  progressPercent: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  bestResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    marginBottom: 20,
    borderRadius: 13,
    backgroundColor: '#29200C',
    borderWidth: 1,
    borderColor: '#020617',
  },
  bestResultIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#3D2D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestResultCopy: {
    flex: 1,
    marginLeft: 11,
  },
  bestResultTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 3,
  },
  bestResultText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  modalHeaderImage: {
    height: 238,
    justifyContent: 'flex-end',
  },
  modalHeaderImageStyle: {
    opacity: 0.62,
  },
  modalHeroOverlay: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
  },
  modalActivityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalHeroActivity: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  modalHeroHeadline: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 39,
  },
  modalHeroCaption: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  sessionIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 13,
  },
  sessionIntroTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  sessionIntroText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  qualityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 12,
  },
  sessionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 23,
  },
  sessionDateText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  reportSectionTitle: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 11,
  },
  reportMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 22,
  },
  reportMetricCard: {
    width: '48%',
    minHeight: 105,
    borderRadius: 14,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 13,
  },
  reportMetricIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#082F49',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  reportMetricLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  reportMetricValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  deleteReportButton: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#4C1D2A',
    backgroundColor: '#1F1720',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteReportText: {
    color: '#FDA4AF',
    fontSize: 13,
    fontWeight: '800',
  },

  sectionDivider: {
    paddingVertical: 16,
  },
  sectionDividerLine: {
    height: 1,
    backgroundColor: '#374151',
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 58,
    borderRadius: 18,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#082F49',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#64748B',
  },
});
