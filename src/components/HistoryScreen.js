import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ImageBackground,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BikeContext } from '../context/BikeContext';
import Ionicons from '@expo/vector-icons/Ionicons';

const ACTIVITY_HEADER_IMAGES = {
  indoor: require('../../assets/header_indoor.png'),
  walk: require('../../assets/header_walk.png'),
};

const DETAIL_METRICS = [
  { key: 'time', label: 'Tempo', unit: 'min' },
  { key: 'distance', label: 'Distância', unit: 'km' },
  { key: 'speed', label: 'Velocidade', unit: 'km/h' },
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
];

export default function HistoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('all'); 
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const scrollViewRef = useRef(null);
  const cardPositionsRef = useRef({});
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
      }
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };
  const getDayKey = (dateValue) => {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const formatDayKey = (dayKey) => {
    const [year, month, day] = dayKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
              await AsyncStorage.setItem('bikeRecords', JSON.stringify(updatedRecords));
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

  const getRecordTitle = (type) => (type === 'walk' ? 'Caminhada' : 'Bic. Ergométrica');

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

  const getMetricIcon = (key) => {
    switch (key) {
      case 'time':
        return 'time-outline';
      case 'distance':
        return 'map-outline';
      case 'speed':
        return 'speedometer-outline';
      case 'calories':
        return 'flame-outline';
      case 'steps':
        return 'footsteps-outline';
      default:
        return 'stats-chart-outline';
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const highlightDate = route.params?.highlightDate;
      if (highlightDate) {
        setFilter('all');
        setActiveHighlight({
          date: highlightDate,
          type: route.params?.highlightType || null,
          requestId: route.params?.highlightRequestId || Date.now(),
        });
        navigation.setParams({
          highlightDate: undefined,
          highlightType: undefined,
          highlightRequestId: undefined,
        });
      }
    }, [
      navigation,
      route.params?.highlightDate,
      route.params?.highlightType,
      route.params?.highlightRequestId,
    ])
  );

  const filteredRecords = getFilteredRecords();
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
          <TouchableOpacity
            style={[styles.filterButton, filter === 'week' && styles.filterButtonActive]}
            onPress={() => setFilter('week')}
          >
              <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>
              Semana
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'month' && styles.filterButtonActive]}
            onPress={() => setFilter('month')}
          >
              <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>
              Mês
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Tudo
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.historySection}>
          {!!activeHighlight?.date && (
            <View style={styles.highlightBanner}>
              <Text style={styles.highlightBannerText}>
                Destacando sessões de {
                  activeHighlight.type === 'walk'
                    ? 'caminhada'
                    : activeHighlight.type === 'indoor'
                      ? 'bic. ergométrica'
                      : 'todos os tipos'
                } em {formatDayKey(activeHighlight.date)}
              </Text>
              <TouchableOpacity onPress={() => setActiveHighlight(null)}>
                <Text style={styles.highlightBannerAction}>Limpar</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.sectionTitle}>
            Todas as Sessões ({filteredRecords.length})
          </Text>

          {filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nenhuma sessão encontrada</Text>
              <Text style={styles.emptySubtext}>Comece a registrar seus exercícios!</Text>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {filteredRecords.map((record) => (
                <View
                  key={record.id}
                  onLayout={(event) => {
                    cardPositionsRef.current[record.id] = event.nativeEvent.layout.y;
                  }}
                  style={[
                    styles.modernCard,
                    highlightRecordIds.includes(record.id) && styles.modernCardHighlighted,
                  ]}
                >
                  <View style={styles.horizontalCardContent}>
                    <View style={styles.horizontalCardInfo}>
                      <Text style={styles.modernCardDate}>{record.displayDate}</Text>
                      <Text style={styles.modernCardTime}>{record.displayTime}</Text>
                      <Text style={styles.activityTypeText}>
                        {getRecordTitle(getActivityType(record))}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.viewButton}
                      onPress={() => setSelectedRecord(record)}
                    >
                      <Text style={styles.viewButtonText}>
                        <Ionicons name='chevron-forward' color={'white'} size={28} />
                      </Text>
                    </TouchableOpacity>
                  </View>
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
                  <ImageBackground
                    source={ACTIVITY_HEADER_IMAGES[getActivityType(selectedRecord)]}
                    style={styles.modalHeaderImage}
                    imageStyle={styles.modalHeaderImageStyle}
                    resizeMode="cover"
                  >
                    <TouchableOpacity
                      style={styles.modalImageCloseButton}
                      onPress={() => setSelectedRecord(null)}
                    >
                      <Ionicons name="close" size={20} color="#E2E8F0" />
                    </TouchableOpacity>
                  </ImageBackground>

                  <ScrollView
                    style={styles.modalBodyScroll}
                    contentContainerStyle={styles.modalBodyContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.summaryHeaderRow}>

                      <Text style={styles.modalSectionTitle}>Resumo da Sessão</Text>

                      <TouchableOpacity

                        style={styles.summaryDeleteButton}

                        onPress={() => deleteRecord(selectedRecord.id)}

                      >

                        <Ionicons name="trash-outline" size={18} color="#fff" />

                      </TouchableOpacity>

                    </View>
                    <View style={styles.sessionMetaCard}>
                      <Text style={styles.sessionMetaTitle}>
                        {getRecordTitle(getActivityType(selectedRecord))}
                      </Text>
                      <Text style={styles.sessionMetaText}>
                        {selectedRecord.displayDate} - {selectedRecord.displayTime}
                      </Text>
                    </View>

                    <View style={styles.chipsWrap}>
                      {(() => {
                        const metrics = [
                        ...DETAIL_METRICS,
                        ...(getActivityType(selectedRecord) === 'walk' && selectedRecord.steps
                          ? [{ key: 'steps', label: 'Passos', unit: 'steps' }]
                          : []),
                        ];
                        const hasFiveOrMore = metrics.length > 4;

                        return metrics.map((metric, index) => {
                        const currentValue = getMetricNumericValue(selectedRecord, metric.key);
                        const isLastAndFullWidth = hasFiveOrMore && index === metrics.length - 1;
                        const useInlineStepsLayout = isLastAndFullWidth && metric.key === 'steps';

                        return (
                          <View
                            style={[styles.metricChip, isLastAndFullWidth && styles.metricChipFullWidth]}
                            key={metric.key}
                          >
                            {useInlineStepsLayout ? (
                              <>
                                <View style={styles.metricChipIcon}>
                                  <Ionicons name={getMetricIcon(metric.key)} size={18} color="#fff" />
                                </View>
                                <Text style={styles.metricChipInlineText}>
                                  {`${Math.round(currentValue)} passos`}
                                </Text>
                              </>
                            ) : (
                              <>
                                <View style={styles.metricChipIcon}>
                                  <Ionicons name={getMetricIcon(metric.key)} size={18} color="#fff" />
                                </View>
                                <View style={styles.metricChipContent}>
                                  <Text style={styles.metricChipValue}>
                                    {formatMetricDisplayValue(currentValue, metric.unit)}
                                  </Text>
                                  <Text style={styles.metricChipLabel}>{metric.label}</Text>
                                </View>
                              </>
                            )}
                          </View>
                        );
                      });
                      })()}
                    </View>
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
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
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
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  historySection: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  highlightBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  highlightBannerText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  highlightBannerAction: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  cardsContainer: {
    gap: 12,
  },
  modernCard: {
    backgroundColor: '#040404',
    borderRadius: 13,
  },
  modernCardHighlighted: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  horizontalCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  horizontalCardInfo: {
    flex: 1,
  },
  modernCardDate: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modernCardTime: {
    fontSize: 14,
    color: '#94A3B8',
  },
  activityTypeText: {
    marginTop: 8,
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 5,
  },
  viewButtonText: {
    color: '#fff',
    borderWidth: 2,
    padding: 10
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
  modalBodyScroll: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  modalSectionTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  summaryDeleteButton: {
    backgroundColor: '#7F1D1D',
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderImage: {
    height: 400,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  modalHeaderImageStyle: {
    opacity: 0.78,
  },
  modalImageCloseButton: {
    marginTop: 14,
    marginRight: 14,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionMetaCard: {
    backgroundColor: '#0B1220',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.4,
    borderColor: '#212529',
    marginBottom: 14,
  },
  sessionMetaTitle: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sessionMetaText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricChip: {
    width: '48%',
    minHeight: 106,
    borderRadius: 16,
    backgroundColor: '#0B1220',
    borderWidth: 0.4,
    borderColor: '#212529',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricChipFullWidth: {
    width: '100%',
    minHeight: 6,

  },
  metricChipInlineText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  metricChipIcon: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#212529',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricChipContent: {
    flex: 1,
  },
  metricChipValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricChipLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 60,
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
});
