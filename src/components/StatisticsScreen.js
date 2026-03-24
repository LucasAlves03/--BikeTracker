import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-gifted-charts';
import { BikeContext } from '../context/BikeContext';

const PERFORMANCE_METRICS = [
  { key: 'distance', label: 'Melhor Distância', unit: 'km' },
  { key: 'time', label: 'Melhor Tempo', unit: 'min' },
  { key: 'calories', label: 'Melhores Calorias', unit: 'kcal' },
  { key: 'speed', label: 'Melhor Velocidade', unit: 'km/h' },
];

const ACTIVITY_COLORS = {
  indoor: '#F97316',
  walk: '#7DD3FC',
};
const BEST_POINTS = 10;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const hexToRgba = (hex, alpha) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const COMPARE_OPTIONS = [
  { key: 'distance', label: 'Distância (km)' },
  { key: 'time', label: 'Tempo (min)' },
  { key: 'calories', label: 'Calorias' },
  { key: 'speed', label: 'Velocidade (km/h)' },
];

const SESSION_COMPARISON_METRICS = [
  { key: 'distance', label: 'Distância', unit: 'km' },
  { key: 'time', label: 'Tempo', unit: 'min' },
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'speed', label: 'Velocidade', unit: 'km/h' },
];

export default function StatisticsScreen() {
  const navigation = useNavigation();
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [compareMetric, setCompareMetric] = useState('distance');
  const [bestActivityType, setBestActivityType] = useState('indoor');
  const [selectedMonths, setSelectedMonths] = useState({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const comparisonReveal = useRef(new Animated.Value(0)).current;
  const { refreshTrigger } = useContext(BikeContext);

  useFocusEffect(
    React.useCallback(() => {
      loadRecords();
    }, [refreshTrigger])
  );

  const loadRecords = async () => {
    try {
      const savedRecords = await AsyncStorage.getItem('bikeRecords');
      if (savedRecords !== null) {
        const parsedRecords = JSON.parse(savedRecords);
        setRecords(parsedRecords);
      } else {
        setRecords([]);
      }
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

  useEffect(() => {
    comparisonReveal.setValue(0);
    Animated.timing(comparisonReveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [filterType, records, comparisonReveal]);

  const formatShortDate = (date) =>
    new Date(date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });

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

  const getFilteredRecords = () => {
    if (filterType === 'all') return records;
    return records.filter((r) => getRecordType(r) === filterType);
  };

  const getLastTwoByType = (type) => {
    const sorted = records
      .filter((record) => getRecordType(record) === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (sorted.length < 2) return null;
    return { latest: sorted[0], previous: sorted[1] };
  };

  const formatMetricValue = (value, unit) => {
    const numeric = parseMetricNumber(value);
    if (unit === 'kcal' || unit === 'min') return `${Math.round(numeric)} ${unit}`;
    return `${numeric.toFixed(1)} ${unit}`;
  };

  const buildSessionComparison = (type) => {
    const pair = getLastTwoByType(type);
    if (!pair) return null;

    return SESSION_COMPARISON_METRICS.map((metric) => {
      const latestValue = parseMetricNumber(pair.latest[metric.key]);
      const previousValue = parseMetricNumber(pair.previous[metric.key]);
      const delta = latestValue - previousValue;
      const deltaPct = previousValue === 0 ? null : (delta / previousValue) * 100;

      return {
        ...metric,
        latestValue,
        previousValue,
        delta,
        deltaPct,
      };
    });
  };

  const buildBestMetricSeries = (metricKey, type) => {
    const sorted = [...records]
      .filter((r) => getRecordType(r) === type)
      .filter((r) => r[metricKey] !== undefined && r[metricKey] !== null)
      .sort((a, b) => parseFloat(b[metricKey]) - parseFloat(a[metricKey]))
      .slice(0, BEST_POINTS);

    const ranked = sorted.map((r, index) => ({
      value: parseFloat(r[metricKey]),
      label: `#${index + 1}`,
    }));

    for (let i = ranked.length; i < BEST_POINTS; i += 1) {
      ranked.push({
        value: 0,
        label: `#${i + 1}`,
      });
    }

    return {
      data: ranked,
      hasData: sorted.length > 0,
    };
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

  const renderChange = (metric) => {
    if (metric.delta > 0) {
      return {
        text: `+${formatMetricValue(metric.delta, metric.unit)}${metric.deltaPct === null ? '' : ` (${metric.deltaPct.toFixed(1)}%)`}`,
        style: styles.changeUp,
      };
    }

    if (metric.delta < 0) {
      return {
        text: `${formatMetricValue(metric.delta, metric.unit)}${metric.deltaPct === null ? '' : ` (${metric.deltaPct.toFixed(1)}%)`}`,
        style: styles.changeDown,
      };
    }

    return {
      text: 'Sem mudança',
      style: styles.changeNeutral,
    };
  };

  const getComparisonRatios = (metric) => {
    const maxValue = Math.max(metric.latestValue, metric.previousValue, 1);
    return {
      latestRatio: metric.latestValue / maxValue,
      previousRatio: metric.previousValue / maxValue,
    };
  };
  const selectedMetric = PERFORMANCE_METRICS.find((metric) => metric.key === compareMetric)
    || PERFORMANCE_METRICS[0];
  const indoorBestSeries = buildBestMetricSeries(compareMetric, 'indoor');
  const walkBestSeries = buildBestMetricSeries(compareMetric, 'walk');
  const activeBestSeries = bestActivityType === 'walk' ? walkBestSeries : indoorBestSeries;
  const activeBestColor =
    bestActivityType === 'walk' ? ACTIVITY_COLORS.walk : ACTIVITY_COLORS.indoor;
  const activeBestLabel = bestActivityType === 'walk' ? 'Caminhada' : 'Bic. Ergom\u00e9trica';
  const activeBestMaxValue = Math.max(...activeBestSeries.data.map((point) => point.value), 1);
  const frequencyTypes = filterType === 'all' ? ['indoor', 'walk'] : [filterType];

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
    navigation.navigate('History', {
      highlightDate: dayKey,
      highlightType: type,
      highlightRequestId: Date.now(),
    });
  };
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
          <Text style={styles.sectionTitle}>Comparação dos últimos Exercícios</Text>
          {records.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Sem dados ainda</Text>
              <Text style={styles.emptySubtext}>Adicione exercícios para desbloquear insights.</Text>
            </View>
          ) : (
            <>
              {(filterType === 'all' ? ['indoor', 'walk'] : [filterType]).map((type) => {
                const pair = getLastTwoByType(type);
                const comparison = buildSessionComparison(type);
                const typeLabel = type === 'indoor' ? 'Bic. Ergométrica' : 'Caminhada';

                if (!pair || !comparison) {
                  return (
                    <View style={styles.comparisonCard} key={type}>
                      <Text style={styles.comparisonTitle}>{typeLabel}</Text>
                      <Text style={styles.comparisonEmptyText}>
                        Adicione pelo menos 2 sessões de {type === 'indoor' ? 'bic. ergométrica' : 'caminhada'} para comparar desempenho.
                      </Text>
                    </View>
                  );
                }

                return (
                  <View style={styles.comparisonCard} key={type}>
                    <View style={styles.comparisonHeaderRow}>
                      <View>
                        <Text style={styles.comparisonTitle}>{typeLabel}</Text>
                        <Text style={styles.comparisonSubtitle}>
                          {formatShortDate(pair.latest.date)} vs {formatShortDate(pair.previous.date)}
                        </Text>
                      </View>
                      <View style={styles.comparisonHeaderRight}>
                        <View style={[styles.comparisonDot, { backgroundColor: ACTIVITY_COLORS[type] }]} />
                      </View>
                    </View>

                    
                      <Animated.View
                        style={[
                          styles.comparisonMetricsWrap,
                          {
                            opacity: comparisonReveal,
                            transform: [
                              {
                                translateY: comparisonReveal.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [10, 0],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {comparison.map((metric) => {
                          const change = renderChange(metric);
                          const { latestRatio, previousRatio } = getComparisonRatios(metric);
                          return (
                            <View style={styles.comparisonMetricCard} key={`${type}-${metric.key}`}>
                              <View style={styles.comparisonMetricTop}>
                                <Text style={styles.comparisonMetricLabel}>{metric.label}</Text>
                                <Text style={[styles.comparisonDeltaBadge, change.style]}>{change.text}</Text>
                              </View>

                              <View style={styles.comparisonBarLine}>
                                <Text style={styles.comparisonBarLabel}>Último</Text>
                                <View style={styles.comparisonBarTrack}>
                                  <View
                                    style={[
                                      styles.comparisonBarFill,
                                      styles.comparisonBarFillLatest,
                                      { width: `${Math.min(Math.max(latestRatio, 0), 1) * 100}%` },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.comparisonBarValue}>
                                  {formatMetricValue(metric.latestValue, metric.unit)}
                                </Text>
                              </View>

                              <View style={styles.comparisonBarLine}>
                                <Text style={styles.comparisonBarLabel}>Anterior</Text>
                                <View style={styles.comparisonBarTrack}>
                                  <View
                                    style={[
                                      styles.comparisonBarFill,
                                      styles.comparisonBarFillPrevious,
                                      { width: `${Math.min(Math.max(previousRatio, 0), 1) * 100}%` },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.comparisonBarValue}>
                                  {formatMetricValue(metric.previousValue, metric.unit)}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </Animated.View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.bestToggle}>
            {['indoor', 'walk'].map((type) => {
              const isActive = bestActivityType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.bestTab, isActive && styles.bestTabActive]}
                  onPress={() => setBestActivityType(type)}
                >
                  <Text style={[styles.bestTabText, isActive && styles.bestTabTextActive]}>
                    {type === 'walk' ? 'Caminhada' : 'Bic. Ergométrica'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.compareTabs}>
            {COMPARE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.compareTab,
                  compareMetric === option.key && styles.compareTabActive,
                ]}
                onPress={() => setCompareMetric(option.key)}
              >
                <Text
                  style={[
                    styles.compareTabText,
                    compareMetric === option.key && styles.compareTabTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
              
          <View style={styles.chartCard}>
            {!activeBestSeries.hasData ? (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>
                  {bestActivityType === 'walk' ? 'Sem registros de caminhada' : 'Sem registros de bic. ergométrica'}
                </Text>
              </View>
            ) : (
                  <LineChart
                    data={activeBestSeries.data}
                    areaChart
                    curved
                    thickness={2}
                    adjustToWidth
                    spacing={28}
                    initialSpacing={0}
                    endSpacing={0}
                    maxValue={activeBestMaxValue * 1.15}
                    color={activeBestColor}
                    startFillColor={hexToRgba(activeBestColor, 0.28)}
                    endFillColor={hexToRgba(activeBestColor, 0.05)}
                    yAxisColor="rgba(15, 23, 42, 0.2)"
                    xAxisColor="rgba(15, 23, 42, 0.2)"
                    yAxisThickness={1}
                    xAxisThickness={1}
                    noOfSections={4}
                    xAxisLabelTextStyle={styles.chartLabel}
                    yAxisTextStyle={styles.chartLabel}
                    pointerConfig={{
                      pointerColor: activeBestColor,
                      pointerStripColor: 'rgba(15, 23, 42, 0.2)',
                      pointerStripWidth: 1,
                      pointerStripUptoDataPoint: true,
                      autoAdjustPointerLabelPosition: true,
                      pointerLabelWidth: 140,
                      pointerLabelHeight: 64,
                      activatePointersOnLongPress: false,
                      activatePointersInstantlyOnTouch: true,
                      persistPointer: true,
                      resetPointerIndexOnRelease: false,
                      pointerVanishDelay: 2000,
                      pointerLabelComponent: renderTooltip({
                        unit: selectedMetric.unit,
                        showSecondary: false,
                        primaryLabel: activeBestLabel,
                        primaryColor: activeBestColor,
                      }),
                    }}
                  />
                )}
              </View>
              <View style={styles.bestLegendRow}>
                <View style={styles.bestLegendItem}>
                  <View style={[styles.bestLegendDot, { backgroundColor: activeBestColor }]} />
                  <Text style={styles.bestLegendText}>{activeBestLabel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Frequência de Exercícios</Text>
              {frequencyTypes.map((type) => {
                const label = type === 'walk' ? 'Caminhada' : 'Bic. Ergométrica';
                const color = ACTIVITY_COLORS[type];
                const months = getAvailableMonths(type);
                const selectedMonth = months.includes(selectedMonths[type])
                  ? selectedMonths[type]
                  : months[0];
                const heatmap = buildMonthHeatmap(type, selectedMonth);

                return (
                  <View style={styles.heatmapCard} key={`heatmap-${type}`}>
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
                            style={[
                              styles.monthTab,
                              isActive && styles.monthTabActive,
                            ]}
                            onPress={() =>
                              setSelectedMonths((prev) => ({ ...prev, [type]: monthKey }))
                            }
                          >
                            <Text
                              style={[
                                styles.monthTabText,
                                isActive && styles.monthTabTextActive,
                              ]}
                            >
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
              })}
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
    fontWeight: 700
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
