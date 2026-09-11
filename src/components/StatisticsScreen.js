import React, { useState, useContext, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { BikeContext } from '../context/BikeContext';
import { listExerciseRecords } from '../utils/exerciseStorage';
import Ionicons from '@expo/vector-icons/Ionicons';


const ACTIVITY_COLORS = {
  indoor: '#F97316',
  walk: '#7DD3FC',
};
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const hexToRgba = (hex, alpha) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const WEEKLY_TREND_METRICS = [
  { key: 'distance', label: 'Distância', unit: 'km', color: '#668DC4' },
  { key: 'time', label: 'Tempo', unit: 'min', color: '#62A77C' },
  { key: 'calories', label: 'Calorias', unit: 'kcal', color: '#C95C5C' },
  { key: 'speed', label: 'Velocidade', unit: 'km/h', color: '#624E8C' },
];

const formatCompactNumber = (value) => {
  const numeric = Math.max(0, Number(value) || 0);
  if (numeric < 10000) return `${Math.round(numeric).toLocaleString('pt-BR')}`;

  const compact = numeric / 1000;
  return `${compact.toFixed(1).replace('.0', '')}k`;
};

const formatMonthlyCalories = (value) => {
  const calories = Math.max(0, Math.round(Number(value) || 0));
  if (calories >= 1000) return `${(calories / 1000).toFixed(1).replace('.0', '')}Kg`;
  return calories.toLocaleString('pt-BR');
};

export default function StatisticsScreen() {
  const router = useRouter();
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [compareMetric, setCompareMetric] = useState('distance');
  const [frequencyType, setFrequencyType] = useState('indoor');
  const [selectedMonths, setSelectedMonths] = useState({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const { refreshTrigger } = useContext(BikeContext);

  useFocusEffect(
    React.useCallback(() => {
      loadRecords();
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

  const parseMetricNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value).trim().replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getRecordType = (record) => record.activityType || 'indoor';
  const getDayKey = (dateValue) => {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getMonthKey = (dateValue) => {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  };
  const getDateFromMonthKey = (monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1);
  };
  const formatMonthLabel = (monthKey) =>
    getDateFromMonthKey(monthKey).toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
    });

  const selectedTrendMetric = WEEKLY_TREND_METRICS.find((metric) => metric.key === compareMetric)
    || WEEKLY_TREND_METRICS[0];

  const weeklyTrendData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    const sourceRecords = filterType === 'all'
      ? records
      : records.filter((record) => getRecordType(record) === filterType);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dayKey = getDayKey(date);
      const dayRecords = sourceRecords.filter((record) => getDayKey(record.date) === dayKey);
      const value = dayRecords.reduce(
        (sum, record) => sum + parseMetricNumber(record[selectedTrendMetric.key]),
        0
      );

      return {
        value: Number(value.toFixed(1)),
        exerciseCount: dayRecords.length,
        label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3),
      };
    });
  }, [records, filterType, selectedTrendMetric.key]);

  const weeklyTrendAverage = useMemo(() => {
    const total = weeklyTrendData.reduce((sum, point) => sum + point.value, 0);
    const exerciseCount = weeklyTrendData.reduce((sum, point) => sum + point.exerciseCount, 0);
    return exerciseCount > 0 ? total / exerciseCount : 0;
  }, [weeklyTrendData]);

  const weeklyTrendDescription = `Média de ${selectedTrendMetric.label.toLowerCase()} por exercício`;

  const monthlySummary = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const sourceRecords = (filterType === 'all'
      ? records
      : records.filter((record) => getRecordType(record) === filterType)
    ).filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === month && recordDate.getFullYear() === year;
    });

    return {
      sessions: sourceRecords.length,
      calories: sourceRecords.reduce((sum, record) => sum + parseMetricNumber(record.calories), 0),
      steps: sourceRecords.reduce((sum, record) => {
        const value = typeof record.steps === 'number'
          ? record.steps
          : parseInt(String(record.steps || '').replace(/[^\d]/g, ''), 10) || 0;
        return sum + value;
      }, 0),
    };
  }, [records, filterType]);

  const formatWeeklyTrendValue = (value, metric) => {
    const numeric = parseMetricNumber(value);
    if (metric.key === 'calories' && numeric > 1000) {
      return `${(numeric / 1000).toFixed(1).replace('.0', '')}kg`;
    }
    return `${numeric.toFixed(1)} ${metric.unit}`;
  };

  const getPointerItem = (items, index = 0) => {
    if (!items) return null;
    if (Array.isArray(items)) return items[index] || items[0] || null;
    return items;
  };

  const renderTooltip =
    ({
      unit,
      showSecondary,
      primaryLabel = 'Valor',
      secondaryLabel = 'Caminhada',
      primaryColor = '#111827',
      secondaryColor = '#6B7280',
    }) =>
    // eslint-disable-next-line react/display-name
    (items, secondaryItems) => {
    const primaryItem = getPointerItem(items, 0);
    const secondaryItem = getPointerItem(secondaryItems, 0);
    const label = primaryItem?.label || secondaryItem?.label || '';

    return (
      <View style={styles.tooltipContainer}>
        <Text style={styles.tooltipTitle}>{label}</Text>
        <View style={styles.tooltipRow}>
          <View style={[styles.tooltipDot, { backgroundColor: primaryColor }]} />
          <Text style={styles.tooltipText}>
            {primaryLabel}: {primaryItem?.value ?? 0} {unit}
          </Text>
        </View>
        {showSecondary && (
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: secondaryColor }]} />
            <Text style={styles.tooltipText}>
              {secondaryLabel}: {secondaryItem?.value ?? 0} {unit}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const getAvailableMonths = (type) => {
    const monthSet = new Set();
    monthSet.add(getMonthKey(new Date()));

    const typeRecords = records.filter((record) => getRecordType(record) === type);
    typeRecords.forEach((record) => monthSet.add(getMonthKey(record.date)));

    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  };

  const buildMonthHeatmap = (type, monthKey) => {
    const dayCount = {};

    records
      .filter((record) => getRecordType(record) === type)
      .forEach((record) => {
        const key = getDayKey(record.date);
        dayCount[key] = (dayCount[key] || 0) + 1;
      });

    const targetMonth = getDateFromMonthKey(monthKey);
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells = [];
    const cursor = new Date(gridStart);
    while (cursor.getTime() <= gridEnd.getTime()) {
      const key = getDayKey(cursor);
      cells.push({
        key: `${type}-${key}`,
        dayKey: key,
        day: cursor.getDate(),
        count: dayCount[key] || 0,
        isCurrentMonth: cursor.getMonth() === targetMonth.getMonth(),
        isFuture: cursor.getTime() > today.getTime(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const maxCount = Math.max(
      ...cells.filter((cell) => cell.isCurrentMonth).map((cell) => cell.count),
      0
    );
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }

    return { rows, maxCount };
  };

  const getHeatColor = (count, maxCount, baseColor, isCurrentMonth, isFuture) => {
    if (!isCurrentMonth) return '#F8FAFC';
    if (isFuture) return '#F1F5F9';
    if (count === 0 || maxCount === 0) return '#E2E8F0';
    const intensity = count / maxCount;
    const alpha = 0.2 + intensity * 0.8;
    return hexToRgba(baseColor, alpha);
  };
  const navigateToHistoryDate = (dayKey, type) => {
    router.navigate({
      pathname: '/(tabs)/history',
      params: {
        highlightDate: dayKey,
        highlightType: type,
        highlightRequestId: Date.now(),
      },
    });
  };
  const lifetimeStats = useMemo(
    () =>
      records.reduce(
        (totals, record) => ({
          exercises: totals.exercises + 1,
          time: totals.time + parseMetricNumber(record.time),
          calories: totals.calories + parseMetricNumber(record.calories),
          distance: totals.distance + parseMetricNumber(record.distance),
        }),
        { exercises: 0, time: 0, calories: 0, distance: 0 }
      ),
    [records]
  );

  const firstSessionDate = useMemo(() => {
    let oldestDate = null;

    records.forEach((record) => {
      const currentDate = new Date(record.date);
      if (Number.isNaN(currentDate.getTime())) return;
      if (!oldestDate || currentDate.getTime() < oldestDate.getTime()) {
        oldestDate = currentDate;
      }
    });

    return oldestDate;
  }, [records]);

  const sinceLabel = firstSessionDate
    ? `Desde ${firstSessionDate.toLocaleDateString('pt-BR')}`
    : 'Desde --';
  const formatTotalMinutes = (totalMinutes) => {
    const minutes = Math.max(0, Math.round(totalMinutes));
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  };
  const formatTotalCalories = (totalCalories) => {
    const calories = Math.max(0, Math.round(totalCalories));
    if (calories >= 1000) {
      const caloriesInKg = calories / 1000;
      return `${caloriesInKg.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}kg`;
    }
    return `${calories.toLocaleString('pt-BR')} kcal`;
  };

  const yourStatsCards = [
    {
      key: 'exercises',
      label: 'Total de exercícios',
      value: `${lifetimeStats.exercises}`,
      icon: 'fitness-outline',
      color: '#624E8C',
      progress: Math.min(lifetimeStats.exercises / 30, 1),
    },
    {
      key: 'time',
      label: 'Tempo gasto em exercícios',
      value: formatTotalMinutes(lifetimeStats.time),
      icon: 'time-outline',
      color: '#62A77C',
      progress: Math.min(lifetimeStats.time / 1200, 1),
    },
    {
      key: 'calories',
      label: 'Calorias queimadas',
      value: formatTotalCalories(lifetimeStats.calories),
      icon: 'flame-outline',
      color: '#C95C5C',
      progress: Math.min(lifetimeStats.calories / 10000, 1),
    },
    {
      key: 'distance',
      label: 'Distância total percorrida',
      value: `${lifetimeStats.distance.toFixed(1)} km`,
      icon: 'map-outline',
      color: '#668DC4',
      progress: Math.min(lifetimeStats.distance / 500, 1),
    },
  ];
  return (
    <View style={styles.container}>
      <View
        style={styles.header}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <Text style={styles.headerTitle}>Estatísticas</Text>
        <Text style={styles.headerSubtitle}>Insights das suas sessões</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.yourStatsHeaderRow}>
            <Text style={styles.sectionTitle}>Seu Histórico</Text>
            <Text style={styles.yourStatsSince}>{sinceLabel}</Text>
          </View>
          <View style={styles.yourStatsRow}>
            {yourStatsCards.map((card) => (
              <View style={[styles.yourStatsCard, { backgroundColor: card.color }]} key={card.key}>
                <View style={styles.yourStatsContent}>
                  <View style={styles.yourStatsHeader}>
                    <Text style={styles.yourStatsLabel} numberOfLines={2}>{card.label}</Text>
                    <View style={styles.yourStatsIcon}>
                      <Ionicons name={card.icon} size={31} color="#FFFFFF" />
                    </View>
                  </View>
                  <Text style={styles.yourStatsValue}>{card.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          {['all', 'indoor', 'walk'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterButton, filterType === type && styles.filterButtonActive]}
              onPress={() => setFilterType(type)}
            >
              <Text numberOfLines={1} style={[styles.filterText, filterType === type && styles.filterTextActive]}>
                {type === 'all' ? 'Todos' : type === 'indoor' ? 'Bic. Ergométrica' : 'Caminhada'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionEyebrow}>ÚLTIMOS 7 DIAS</Text>
              <Text style={styles.dashboardSectionTitle}>Ritmo da semana</Text>
            </View>
            <Text style={styles.sectionMeta}>{selectedTrendMetric.unit}</Text>
          </View>
          <View style={styles.metricTabs}>
            {WEEKLY_TREND_METRICS.map((metric) => (
              <TouchableOpacity
                key={metric.key}
                style={[styles.metricTab, compareMetric === metric.key && styles.metricTabActive]}
                onPress={() => setCompareMetric(metric.key)}
              >
                <Text style={[styles.metricTabText, compareMetric === metric.key && styles.metricTabTextActive]}>
                  {metric.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.trendCard}>
            <Text style={styles.trendSummary}>
              {formatWeeklyTrendValue(
                weeklyTrendData.reduce((sum, point) => sum + point.value, 0),
                selectedTrendMetric
              )} nos últimos 7 dias
            </Text>
            <LineChart
              data={weeklyTrendData}
              curved={false}
              thickness={3}
              adjustToWidth
              spacing={42}
              initialSpacing={8}
              endSpacing={8}
              maxValue={Math.max(...weeklyTrendData.map((point) => point.value), 1) * 1.2}
              color={selectedTrendMetric.color}
              yAxisColor="transparent"
              xAxisColor="#E2E8F0"
              yAxisThickness={0}
              xAxisThickness={1}
              noOfSections={3}
              hideRules
              xAxisLabelTextStyle={styles.chartLabel}
              yAxisTextStyle={styles.chartLabel}
              pointerConfig={{
                pointerColor: selectedTrendMetric.color,
                pointerStripColor: '#CBD5E1',
                pointerStripWidth: 1,
                pointerStripUptoDataPoint: true,
                activatePointersInstantlyOnTouch: true,
                pointerLabelWidth: 120,
                pointerLabelHeight: 56,
                pointerLabelComponent: renderTooltip({
                  unit: selectedTrendMetric.unit,
                  showSecondary: false,
                  primaryLabel: selectedTrendMetric.label,
                  primaryColor: selectedTrendMetric.color,
                }),
              }}
            />
            <Text style={styles.trendCaption}>
              {weeklyTrendDescription}: {formatWeeklyTrendValue(weeklyTrendAverage, selectedTrendMetric)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionEyebrow}>ESTE MÊS</Text>
              <Text style={styles.dashboardSectionTitle}>Resumo mensal</Text>
            </View>
          </View>
          <View style={styles.monthlySummaryGrid}>
            <View style={[styles.monthlySummaryCard, styles.monthlySummaryCardTall, styles.monthlySessionsCard]}>
              <Ionicons name="fitness-outline" size={31} color="#FFFFFF" />
              <Text style={styles.monthlySummaryValue}>{formatCompactNumber(monthlySummary.sessions)}</Text>
              <Text style={styles.monthlySummaryLabel}>Sessões no mês</Text>
            </View>
            <View style={styles.monthlySummarySide}>
              <View style={[styles.monthlySummaryCard, styles.monthlyCaloriesCard]}>
                <Ionicons name="flame-outline" size={31} color="#FFFFFF" />
                <View style={styles.monthlySummaryCopy}>
                  <Text style={styles.monthlySummaryValueSmall}>{formatMonthlyCalories(monthlySummary.calories)}</Text>
                  <Text style={styles.monthlySummaryLabel}>Calorias queimadas</Text>
                </View>
              </View>
              <View style={[styles.monthlySummaryCard, styles.monthlyStepsCard]}>
                <Ionicons name="footsteps-outline" size={31} color="#FFFFFF" />
                <View style={styles.monthlySummaryCopy}>
                  <Text style={styles.monthlySummaryValueSmall}>{formatCompactNumber(monthlySummary.steps)}</Text>
                  <Text style={styles.monthlySummaryLabel}>Passos realizados</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Frequência de Exercícios</Text>
              <View style={styles.frequencyToggle}>
                {['indoor', 'walk'].map((type) => {
                  const isActive = frequencyType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.frequencyTab, isActive && styles.frequencyTabActive]}
                      onPress={() => setFrequencyType(type)}
                    >
                      <Text style={[styles.frequencyTabText, isActive && styles.frequencyTabTextActive]}>
                        {type === 'walk' ? 'Caminhada' : 'Bic. Ergométrica'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(() => {
                const type = frequencyType;
                const label = type === 'walk' ? 'Caminhada' : 'Bic. Ergométrica';
                const color = ACTIVITY_COLORS[type];
                const months = getAvailableMonths(type);
                const selectedMonth = months.includes(selectedMonths[type])
                  ? selectedMonths[type]
                  : months[0];
                const heatmap = buildMonthHeatmap(type, selectedMonth);

                return (
                  <View style={styles.heatmapCard}>
                    <View style={styles.heatmapHeaderRow}>
                      <Text style={styles.heatmapTypeTitle}>{label}</Text>
                      <Text style={styles.heatmapHint}>Toque em um mês</Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.monthTabsRow}
                    >
                      {months.map((monthKey) => {
                        const isActive = selectedMonth === monthKey;
                        return (
                          <TouchableOpacity
                            key={`${type}-${monthKey}`}
                            style={[styles.monthTab, isActive && styles.monthTabActive]}
                            onPress={() =>
                              setSelectedMonths((prev) => ({ ...prev, [type]: monthKey }))
                            }
                          >
                            <Text style={[styles.monthTabText, isActive && styles.monthTabTextActive]}>
                              {formatMonthLabel(monthKey)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <View style={styles.heatmapWeekHeader}>
                      {WEEKDAY_LABELS.map((day, dayIndex) => (
                        <Text style={styles.heatmapWeekdayLabel} key={`${type}-${day}-${dayIndex}`}>
                          {day}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.heatmapGridContainer}>
                      {heatmap.rows.map((row, rowIndex) => (
                        <View style={styles.heatmapRow} key={`${type}-row-${rowIndex}`}>
                          {row.map((cell) => {
                            const cellColor = getHeatColor(
                              cell.count,
                              heatmap.maxCount,
                              color,
                              cell.isCurrentMonth,
                              cell.isFuture
                            );
                            const highIntensity =
                              cell.isCurrentMonth
                              && heatmap.maxCount > 0
                              && cell.count / heatmap.maxCount >= 0.55;

                            return (
                              <TouchableOpacity
                                key={cell.key}
                                disabled={!cell.isCurrentMonth || cell.isFuture || cell.count === 0}
                                onPress={() => navigateToHistoryDate(cell.dayKey, type)}
                                style={[
                                  styles.heatmapSquare,
                                  cell.count > 0
                                  && cell.isCurrentMonth
                                  && !cell.isFuture
                                  && styles.heatmapSquarePressable,
                                  { backgroundColor: cellColor },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.heatmapDayText,
                                    !cell.isCurrentMonth && styles.heatmapDayTextMuted,
                                    highIntensity && styles.heatmapDayTextStrong,
                                  ]}
                                >
                                  {cell.day}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </View>

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
    paddingTop: 120,
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
    paddingBottom: 5,
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
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 24,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#111827',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterTextActive: {
    color: '#000',
  },
  section: {
    marginBottom: 28,
  },
  yourStatsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 33,
  },
  yourStatsSince: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  yourStatsRow: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  yourStatsCard: {
    width: '48%',
    minHeight: 132,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
    justifyContent: 'flex-start',
  },
  yourStatsContent: {
    flex: 1,
    zIndex: 1,
  },
  yourStatsHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  yourStatsIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  yourStatsValue: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 20,
  },
  yourStatsLabel: {
    flex: 1,
    textAlign: 'left',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  compareTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 16,
  },
  compareTab: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'gray',
    backgroundColor: '#0F172A',
  },
  compareTabActive: {
    backgroundColor: '#fff',
    borderColor: '#111827',
  },
  compareTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  compareTabTextActive: {
    color: '#000',
  },
  chartCard: {
    marginHorizontal: 24,
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  tooltipContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 120,
  },
  tooltipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569',
  },
  emptyChart: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 14,
    color: '#64748B',
  },
  sectionTitle:{
    color: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  dashboardSectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  monthlySummaryGrid: {
    flexDirection: 'row',
    minHeight: 188,
    marginHorizontal: 24,
    gap: 12,
  },
  monthlySummaryCard: {
    borderRadius: 18,
    padding: 15,
    overflow: 'hidden',
  },
  monthlySummaryCardTall: {
    flex: 1,
    justifyContent: 'space-between',
  },
  monthlySummarySide: {
    flex: 1,
    gap: 12,
  },
  monthlySessionsCard: {
    backgroundColor: '#624E8C',
  },
  monthlyCaloriesCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#C95C5C',
  },
  monthlyStepsCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#668DC4',
  },
  monthlySummaryCopy: {
    flex: 1,
  },
  monthlySummaryValue: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
  },
  monthlySummaryValueSmall: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 3,
  },
  monthlySummaryLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  frequencyToggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 4,
    borderRadius: 13,
    backgroundColor: '#000000',
    gap: 4,
  },
  frequencyTab: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyTabActive: {
    backgroundColor: '#FFFFFF',
  },
  frequencyTabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  frequencyTabTextActive: {
    color: '#000000',
  },
  sectionMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 4,
    borderRadius: 13,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 4,
  },
  metricTab: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    paddingHorizontal: 4,
  },
  metricTabActive: {
    backgroundColor: '#FFFFFF',
  },
  metricTabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  metricTabTextActive: {
    color: '#0F172A',
  },
  trendCard: {
    marginHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  trendSummary: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  trendCaption: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 4,
  },
  recordsList: {
    marginHorizontal: 24,
    borderRadius: 18,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  recordRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  recordIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCopy: {
    flex: 1,
    marginLeft: 11,
  },
  recordLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  recordDate: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  recordValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
  comparisonCard: {
    marginHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    padding: 14,
    marginBottom: 12,
  },
  comparisonTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
  },
  comparisonSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  comparisonEmptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comparisonDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  comparisonToggleText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  comparisonMetricsWrap: {
    marginTop: 12,
    gap: 10,
  },
  comparisonMetricCard: {
    backgroundColor: '#0B1220',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: '#1E293B',
  },
  comparisonMetricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  comparisonMetricLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  comparisonDeltaBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  comparisonBarLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  comparisonBarLabel: {
    width: 54,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  comparisonBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 999,
    overflow: 'hidden',
  },
  comparisonBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  comparisonBarFillLatest: {
    backgroundColor: '#38BDF8',
  },
  comparisonBarFillPrevious: {
    backgroundColor: '#94A3B8',
  },
  comparisonBarValue: {
    minWidth: 74,
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '700',
    textAlign: 'right',
  },
  changeUp: {
    color: '#22C55E',
  },
  changeDown: {
    color: '#F87171',
  },
  changeNeutral: {
    color: '#94A3B8',
  },
  bestToggle: {
    flexDirection: 'row',
    width: '90%',
    alignSelf: 'center',
    marginBottom: 12,
    marginLeft: 15,
    backgroundColor: '#000000',
    borderRadius: 12,
    padding:3,
  },
  bestTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  bestTabActive: {
    backgroundColor: '#FFFFFF',
  },
  bestTabText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  bestTabTextActive: {
    color: '#000000',
  },
  bestLegendRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  bestLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bestLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bestLegendText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  heatmapCard: {
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heatmapTypeTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  heatmapHint: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  monthTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
  },
  monthTab: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  monthTabActive: {
    backgroundColor: '#0F172A',
  },
  monthTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  monthTabTextActive: {
    color: '#FFFFFF',
  },
  heatmapWeekHeader: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
  heatmapWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  heatmapGridContainer: {
    width: '100%',
    gap: 6,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 6,
  },
  heatmapSquare: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 30,
  },
  heatmapSquarePressable: {
    opacity: 1,
  },
  heatmapDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  heatmapDayTextMuted: {
    color: '#94A3B8',
  },
  heatmapDayTextStrong: {
    color: '#FFFFFF',
  },
});


