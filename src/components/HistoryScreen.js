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
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { BikeContext } from '../context/BikeContext';
import Ionicons from '@expo/vector-icons/Ionicons';

const ACTIVITY_HEADER_IMAGES = {
  indoor: require('../../assets/header_indoor.png'),
  walk: require('../../assets/header_walk.png'),
};
const DETAIL_METRICS = [
  { key: 'time', label: 'Tempo', unit: 'min', color: '#38BDF8' },
  { key: 'distance', label: 'Distância', unit: 'km', color: '#22D3EE' },
  { key: 'speed', label: 'Velocidade', unit: 'km/h', color: '#34D399' },
  { key: 'calories', label: 'Calorias', unit: 'kcal', color: '#F97316' },
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
  const { refreshTrigger, triggerRefresh } = useContext(BikeContext);

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

  const getPreviousRecord = (record) => {
    if (!record) return null;

    const type = getActivityType(record);
    const sortedByDate = records
      .filter((item) => getActivityType(item) === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const currentIndex = sortedByDate.findIndex((item) => item.id === record.id);
    if (currentIndex === -1) return null;
    return sortedByDate[currentIndex + 1] || null;
  };

  const getDeltaText = (current, previous, unit) => {
    const currentValue = parseMetricNumber(current);
    const previousValue = parseMetricNumber(previous);
    const delta = currentValue - previousValue;
    if (delta === 0) return 'Sem mudança';
    const prefix = delta > 0 ? '+' : '';
    return `${prefix}${delta.toFixed(1)} ${unit}`;
  };

  const getDeltaValue = (current, previous) =>
    parseMetricNumber(current) - parseMetricNumber(previous);

  const getDeltaStyle = (current, previous) => {
    const delta = getDeltaValue(current, previous);
    if (delta > 0) return styles.summaryDeltaUp;
    if (delta < 0) return styles.summaryDeltaDown;
    return styles.summaryDeltaNeutral;
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

  const previousRecord = getPreviousRecord(selectedRecord);

  const getValidDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  };

  const sanitizeRecord = (record, index) => {
    if (!record || typeof record !== 'object') return null;

    const date = getValidDate(record.date);
    const activityType = record.activityType === 'walk' ? 'walk' : 'indoor';
    const rawId = record.id ?? `${date.getTime()}-${index}`;
    const id = String(rawId);

    return {
      ...record,
      id,
      activityType,
      date: date.toISOString(),
      displayDate: record.displayDate || date.toLocaleDateString('pt-BR', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      displayTime: record.displayTime || date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const sortRecordsByDateDesc = (list) =>
    [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const extractImportedRecords = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.records)) return payload.records;
    return null;
  };

  const saveRecords = async (nextRecords) => {
    await AsyncStorage.setItem('bikeRecords', JSON.stringify(nextRecords));
    setRecords(nextRecords);
    triggerRefresh();
  };

  const exportHistoryToJson = async () => {
    try {
      const payload = {
        app: 'BikeTracker',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        records,
      };
      const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `bike-backup-${safeTimestamp}.json`;
      const directory = FileSystem.documentDirectory;

      if (!directory) {
        Alert.alert('Erro', 'Não foi possível acessar a pasta de documentos.');
        return;
      }

      const fileUri = `${directory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exportar backup do histórico',
          UTI: 'public.json',
        });
      }

      Alert.alert(
        'Backup criado',
        `Arquivo gerado com ${records.length} sessões. Guarde o JSON em local seguro.`
      );
    } catch (error) {
      console.error('Error exporting history:', error);
      Alert.alert('Erro', 'Não foi possível exportar o backup.');
    }
  };

  const applyImportedRecords = async (importedRecords, mode) => {
    const sanitized = importedRecords
      .map((item, index) => sanitizeRecord(item, index))
      .filter(Boolean);

    if (!sanitized.length) {
      Alert.alert('Arquivo inválido', 'O arquivo não contém sessões válidas.');
      return;
    }

    let nextRecords;
    if (mode === 'replace') {
      nextRecords = sortRecordsByDateDesc(sanitized);
    } else {
      const mergedMap = new Map(records.map((record) => [String(record.id), record]));
      sanitized.forEach((record) => mergedMap.set(record.id, record));
      nextRecords = sortRecordsByDateDesc(Array.from(mergedMap.values()));
    }

    await saveRecords(nextRecords);

    Alert.alert(
      'Importação concluída',
      `Agora você tem ${nextRecords.length} sessões no histórico.`
    );
  };

  const importHistoryFromJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets?.[0]?.uri;
      if (!fileUri) {
        Alert.alert('Erro', 'Não foi possível ler o arquivo selecionado.');
        return;
      }

      const rawContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = JSON.parse(rawContent);
      const importedRecords = extractImportedRecords(parsed);
      if (!importedRecords) {
        Alert.alert(
          'Formato inválido',
          'Use um backup JSON gerado pelo app (com lista de sessões).'
        );
        return;
      }

      Alert.alert(
        'Importar backup',
        `Arquivo com ${importedRecords.length} sessões. Deseja mesclar com o histórico atual ou substituir tudo?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Mesclar',
            onPress: () => {
              applyImportedRecords(importedRecords, 'merge');
            },
          },
          {
            text: 'Substituir',
            style: 'destructive',
            onPress: () => {
              applyImportedRecords(importedRecords, 'replace');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error importing history:', error);
      Alert.alert('Erro', 'Não foi possível importar o backup JSON.');
    }
  };

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

        <View style={styles.backupSection}>
          <Text style={styles.backupTitle}>Backup de Dados</Text>
          <Text style={styles.backupSubtitle}>
            Exporte para JSON e importe quando precisar recuperar suas sessões.
          </Text>
          <View style={styles.backupActions}>
            <TouchableOpacity style={styles.backupButtonPrimary} onPress={exportHistoryToJson}>
              <Text style={styles.backupButtonPrimaryText}>Exportar JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backupButtonSecondary} onPress={importHistoryFromJson}>
              <Text style={styles.backupButtonSecondaryText}>Importar JSON</Text>
            </TouchableOpacity>
          </View>
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
                    <View style={styles.modalHeaderOverlay}>
                      <Text style={styles.modalHeaderTitle}>
                        {getRecordTitle(getActivityType(selectedRecord))}
                      </Text>
                      <Text style={styles.modalHeaderSubtitle}>
                        {selectedRecord.displayDate} - {selectedRecord.displayTime}
                      </Text>
                    </View>
                  </ImageBackground>

                  <ScrollView
                    style={styles.modalBodyScroll}
                    contentContainerStyle={styles.modalBodyContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.modalSectionTitle}>Resumo da Sessão</Text>
                    <View style={styles.detailCardsWrap}>
                      {[
                        ...DETAIL_METRICS,
                        ...(getActivityType(selectedRecord) === 'walk' && selectedRecord.steps
                          ? [{ key: 'steps', label: 'Passos', unit: 'steps', color: '#A78BFA' }]
                          : []),
                      ].map((metric) => {
                        const currentValue = getMetricNumericValue(selectedRecord, metric.key);
                        const previousValue = getMetricNumericValue(previousRecord, metric.key);
                        const maxValue = Math.max(currentValue, previousValue, 1);
                        const currentRatio = currentValue / maxValue;
                        const previousRatio = previousRecord ? previousValue / maxValue : 0;

                        return (
                          <View style={styles.detailMetricCard} key={metric.key}>
                            <View style={styles.detailMetricTop}>
                              <Text style={styles.detailMetricLabel}>{metric.label}</Text>
                              {previousRecord ? (
                                <Text
                                  style={[
                                    styles.detailMetricDelta,
                                    getDeltaStyle(currentValue, previousValue),
                                  ]}
                                >
                                  {getDeltaText(currentValue, previousValue, metric.unit === 'steps' ? '' : metric.unit)}
                                </Text>
                              ) : (
                                <Text style={styles.detailMetricDeltaMuted}>Sem compara??o</Text>
                              )}
                            </View>

                            <View style={styles.detailBarLine}>
                              <Text style={styles.detailBarLabel}>Sessão selecionada</Text>
                              <View style={styles.detailBarTrack}>
                                <View
                                  style={[
                                    styles.detailBarFill,
                                    { width: `${Math.min(Math.max(currentRatio, 0), 1) * 100}%`, backgroundColor: metric.color },
                                  ]}
                                />
                              </View>
                              <Text style={styles.detailBarValue}>
                                {formatMetricDisplayValue(currentValue, metric.unit)}
                              </Text>
                            </View>

                            {previousRecord ? (
                              <View style={styles.detailBarLine}>
                                <Text style={styles.detailBarLabel}>Sessão anterior</Text>
                                <View style={styles.detailBarTrack}>
                                  <View
                                    style={[
                                      styles.detailBarFill,
                                      styles.detailBarFillPrevious,
                                      { width: `${Math.min(Math.max(previousRatio, 0), 1) * 100}%` },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.detailBarValue}>
                                  {formatMetricDisplayValue(previousValue, metric.unit)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    {!previousRecord ? (
                      <Text style={styles.noPreviousText}>
                        Ainda não há sessão anterior de {getRecordTitle(getActivityType(selectedRecord)).toLowerCase()} para comparar.
                      </Text>
                    ) : null}

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.modalCloseButton}
                        onPress={() => setSelectedRecord(null)}
                      >
                        <Text style={styles.modalCloseButtonText}>Fechar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteRecord(selectedRecord.id)}
                      >
                        <Text style={styles.deleteButtonText}>Excluir</Text>
                      </TouchableOpacity>
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
  backupSection: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  backupTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  backupSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 10,
  },
  backupButtonPrimary: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backupButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  backupButtonSecondary: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 10,
    alignItems: 'center',
  },
  backupButtonSecondaryText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
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
  modalHeaderImage: {
    height: 350,
    justifyContent: 'flex-end',
  },
  modalHeaderImageStyle: {
    opacity: 0.78,
  },
  modalHeaderOverlay: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: 'rgba(2, 6, 23, 0.34)',
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalHeaderSubtitle: {
    color: '#E5E7EB',
    fontSize: 14,
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
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  detailCardsWrap: {
    gap: 10,
  },
  detailMetricCard: {
    backgroundColor: '#0B1220',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  detailMetricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailMetricLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  detailMetricDelta: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailMetricDeltaMuted: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  detailBarLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  detailBarLabel: {
    width: 108,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  detailBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  detailBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  detailBarFillPrevious: {
    backgroundColor: '#64748B',
  },
  detailBarValue: {
    minWidth: 74,
    textAlign: 'right',
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    gap: 12,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDelta: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryDeltaUp: {
    color: '#22C55E',
  },
  summaryDeltaDown: {
    color: '#F87171',
  },
  summaryDeltaNeutral: {
    color: '#A1A1AA',
  },
  noPreviousText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionDivider: {
    paddingVertical: 16,
  },
  sectionDividerLine: {
    height: 1,
    backgroundColor: '#374151',
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  modalCloseButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '600',
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
