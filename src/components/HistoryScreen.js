import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BikeContext } from '../context/BikeContext';
import Ionicons from '@expo/vector-icons/Ionicons';


export default function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('all'); 
  const [expandedCard, setExpandedCard] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0);
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

  const getFilteredRecords = () => {
    const now = new Date();
    
    if (filter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return records.filter(r => new Date(r.date) >= oneWeekAgo);
    } else if (filter === 'month') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return records.filter(r => new Date(r.date) >= oneMonthAgo);
    }
    
    return records;
  };

  const deleteRecord = async (id) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedRecords = records.filter(record => record.id !== id);
            try {
              await AsyncStorage.setItem('bikeRecords', JSON.stringify(updatedRecords));
              setRecords(updatedRecords);
              setExpandedCard(null);
            } catch (error) {
              console.error('Error deleting record:', error);
            }
          },
        },
      ]
    );
  };

  const toggleCard = (id) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const filteredRecords = getFilteredRecords();

  return (
    <View style={styles.container}>
      <View
        style={styles.header}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>All your sessions</Text>
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
          <TouchableOpacity
            style={[styles.filterButton, filter === 'week' && styles.filterButtonActive]}
            onPress={() => setFilter('week')}
          >
            <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'month' && styles.filterButtonActive]}
            onPress={() => setFilter('month')}
          >
            <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>
            All Sessions ({filteredRecords.length})
          </Text>

          {filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No sessions found</Text>
              <Text style={styles.emptySubtext}>Start tracking your exercises!</Text>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {filteredRecords.map((record) => (
                <TouchableOpacity
                  key={record.id}
                  activeOpacity={0.8}
                  onPress={() => toggleCard(record.id)}
                >
                  <LinearGradient
                    colors={['#1E293B', '#0F172A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.modernCard,
                      expandedCard === record.id && styles.modernCardExpanded
                    ]}
                  >
                    <View style={styles.modernCardHeader}>
                      <View style={styles.modernCardTitleRow}>
                        <View>
                          <Text style={styles.modernCardDate}>{record.displayDate}</Text>
                          <Text style={styles.modernCardTime}>{record.displayTime}</Text>
                        </View>
                        <Text style={styles.expandIcon}>
                          <Ionicons 
                          name={expandedCard === record.id ? 'chevron-down-outline' : 'chevron-forward-outline'}
                          size={32}
                          />                          
                        </Text>
                      </View>
                    </View>

                    {expandedCard === record.id && (
                      <View style={styles.modernCardContent}>
                        <View style={styles.statsRow}>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxLabel}>Time</Text>
                            <Text style={styles.statBoxValue}>{record.time} min</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxLabel}>Speed</Text>
                            <Text style={styles.statBoxValue}>{record.speed} km/h</Text>
                          </View>
                        </View>

                        <View style={styles.statsRow}>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxLabel}>Calories</Text>
                            <Text style={styles.statBoxValue}>{record.calories}</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxLabel}>Distance</Text>
                            <Text style={styles.statBoxValue}>{record.distance} km</Text>
                          </View>
                        </View>

                        {record.activityType === 'walk' && record.steps && (
                          <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                              <Text style={styles.statBoxLabel}>Steps</Text>
                              <Text style={styles.statBoxValue}>{record.steps}</Text>
                            </View>
                          </View>
                        )}

                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => deleteRecord(record.id)}
                        >
                          <Text style={styles.deleteButtonText}>Delete Session</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  cardsContainer: {
    gap: 12,
  },
  modernCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  modernCardExpanded: {
    borderColor: '#3B82F6',
  },
  modernCardHeader: {
    padding: 16,
  },
  modernCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  expandIcon: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  modernCardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 6,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#7F1D1D',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
