import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-gifted-charts';
import { BikeContext } from '../context/BikeContext';

const METRICS = [
  { key: 'distance', label: 'Top 10 Distance', unit: 'km', color: '#111827' },
  { key: 'time', label: 'Top 10 Longest Time', unit: 'min', color: '#111827' },
  { key: 'calories', label: 'Top 10 Calories', unit: 'kcal', color: '#111827' },
  { key: 'speed', label: 'Top 10 Speed', unit: 'km/h', color: '#111827' },
];

const COMPARE_OPTIONS = [
  { key: 'distance', label: 'Distance (km)' },
  { key: 'time', label: 'Time (min)' },
  { key: 'calories', label: 'Calories' },
  { key: 'speed', label: 'Speed (km/h)' },
];

export default function StatisticsScreen() {
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [compareMetric, setCompareMetric] = useState('distance');
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

  const formatShortDate = (date) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });


  const getFilteredRecords = () => {
    if (filterType === 'all') return records;
    return records.filter((r) => r.activityType === filterType);
  };

  const buildTop10Data = (metricKey, color) => {
    const filtered = getFilteredRecords();
    const sorted = [...filtered]
      .filter((r) => r[metricKey] !== undefined && r[metricKey] !== null)
      .sort((a, b) => parseFloat(b[metricKey]) - parseFloat(a[metricKey]))
      .slice(0, 10);

    return sorted.map((r) => ({
      value: parseFloat(r[metricKey]),
      label: formatShortDate(r.date),
      frontColor: color,
    }));
  };

  const getLastMonths = (count) => {
    const months = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return months;
  };

  const buildMonthlySeries = (type, metricKey) => {
    const months = getLastMonths(6);
    const buckets = months.reduce((acc, month) => {
      acc[month.key] = { total: 0, count: 0 };
      return acc;
    }, {});

    records.forEach((r) => {
      const recordType = r.activityType || 'indoor';
      if (recordType !== type) return;

      const date = new Date(r.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets[key]) return;

      const value = parseFloat(r[metricKey] || 0);
      buckets[key].total += value;
      buckets[key].count += 1;
    });

    return months.map((month) => {
      const { total, count } = buckets[month.key];
      const value =
        metricKey === 'speed' ? (count > 0 ? total / count : 0) : total;
      return {
        value: parseFloat(value.toFixed(1)),
        label: month.label,
      };
    });
  };

  const indoorSeries = buildMonthlySeries('indoor', compareMetric);
  const walkSeries = buildMonthlySeries('walk', compareMetric);
  const comparisonData =
    filterType === 'walk' ? walkSeries : indoorSeries;
  const comparisonData2 = filterType === 'all' ? walkSeries : null;
  const maxComparisonValue = Math.max(
    ...comparisonData.map((item) => item.value),
    ...(comparisonData2 ? comparisonData2.map((item) => item.value) : []),
    1
  );

  const getPointerItem = (items, index = 0) => {
    if (!items) return null;
    if (Array.isArray(items)) return items[index] || items[0] || null;
    return items;
  };

  const renderTooltip =
    ({ unit, showSecondary, primaryLabel = 'Value', secondaryLabel = 'Walk' }) =>
    // eslint-disable-next-line react/display-name
    (items, secondaryItems) => {
    const primaryItem = getPointerItem(items, 0);
    const secondaryItem = getPointerItem(secondaryItems, 0);
    const label = primaryItem?.label || secondaryItem?.label || '';

    return (
      <View style={styles.tooltipContainer}>
        <Text style={styles.tooltipTitle}>{label}</Text>
        <View style={styles.tooltipRow}>
          <View style={[styles.tooltipDot, { backgroundColor: '#111827' }]} />
          <Text style={styles.tooltipText}>
            {primaryLabel}: {primaryItem?.value ?? 0} {unit}
          </Text>
        </View>
        {showSecondary && (
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: '#6B7280' }]} />
            <Text style={styles.tooltipText}>
              {secondaryLabel}: {secondaryItem?.value ?? 0} {unit}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
        <Text style={styles.headerSubtitle}>Insights from your sessions</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >


        <View style={styles.filterSection}>
          {['all', 'indoor', 'walk'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterButton, filterType === type && styles.filterButtonActive]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.filterText, filterType === type && styles.filterTextActive]}>
                {type === 'all' ? 'All' : type === 'indoor' ? 'Indoor' : 'Walk'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No data yet</Text>
            <Text style={styles.emptySubtext}>Add exercises to unlock insights.</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Indoor vs Walk</Text>
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
                <LineChart
                  data={comparisonData}
                  data2={comparisonData2 || undefined}
                  curved
                  thickness={2}
                  spacing={42}
                  maxValue={maxComparisonValue * 1.15}
                  color="#111827"
                  color2="#6B7280"
                  yAxisColor="rgba(15, 23, 42, 0.2)"
                  xAxisColor="rgba(15, 23, 42, 0.2)"
                  yAxisThickness={1}
                  xAxisThickness={1}
                  noOfSections={4}
                  xAxisLabelTextStyle={styles.chartLabel}
                  yAxisTextStyle={styles.chartLabel}
                  pointerConfig={{
                    pointerColor: '#111827',
                    pointer2Color: '#6B7280',
                    pointerStripColor: 'rgba(15, 23, 42, 0.2)',
                    pointerStripWidth: 1,
                    pointerStripUptoDataPoint: true,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelWidth: 160,
                    pointerLabelHeight: 72,
                    activatePointersOnLongPress: false,
                    activatePointersInstantlyOnTouch: true,
                    persistPointer: true,
                    resetPointerIndexOnRelease: false,
                    pointerVanishDelay: 2000,
                    pointerLabelComponent: renderTooltip({
                      unit:
                        compareMetric === 'calories'
                          ? 'kcal'
                          : compareMetric === 'time'
                          ? 'min'
                          : compareMetric === 'speed'
                          ? 'km/h'
                          : 'km',
                      showSecondary: filterType === 'all',
                      primaryLabel: filterType === 'walk' ? 'Walk' : 'Indoor',
                      secondaryLabel: 'Walk',
                    }),
                  }}
                />
              </View>
            </View>

            {METRICS.map((metric) => {
              const data = buildTop10Data(metric.key, metric.color);
              const maxValue = Math.max(...data.map((d) => d.value), 1);
              return (
                <View style={styles.section} key={metric.key}>
                  <Text style={styles.sectionTitle}>{metric.label}</Text>
                  <View style={styles.chartCard}>
                    {data.length === 0 ? (
                      <View style={styles.emptyChart}>
                        <Text style={styles.emptyChartText}>No records for this filter</Text>
                      </View>
                    ) : (
                      <LineChart
                        data={data}
                        areaChart
                        curved
                        thickness={2}
                        spacing={26}
                        maxValue={maxValue * 1.15}
                        color={metric.color}
                        startFillColor="rgba(15, 23, 42, 0.2)"
                        endFillColor="rgba(15, 23, 42, 0.02)"
                        hideDataPoints
                        yAxisColor="rgba(15, 23, 42, 0.2)"
                        xAxisColor="rgba(15, 23, 42, 0.2)"
                        yAxisThickness={1}
                        xAxisThickness={1}
                        noOfSections={4}
                        xAxisLabelTextStyle={styles.chartLabel}
                        yAxisTextStyle={styles.chartLabel}
                        pointerConfig={{
                          pointerColor: '#111827',
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
                            unit: metric.unit,
                            showSecondary: false,
                            primaryLabel: 'Value',
                          }),
                        }}
                      />
                    )}
                  </View>
                  <Text style={styles.metricFootnote}>Units: {metric.unit}</Text>
                </View>
              );
            })}
          </>
        )}

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
    paddingBottom: 16,
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
    paddingHorizontal: 24,
    marginTop: 15,
    marginBottom: 24,
    gap: 12,
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
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    paddingHorizontal: 24,
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
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  compareTabActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  compareTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  compareTabTextActive: {
    color: '#FFFFFF',
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
  metricFootnote: {
    color: '#64748B',
    fontSize: 12,
    paddingHorizontal: 24,
    marginTop: 6,
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
});
