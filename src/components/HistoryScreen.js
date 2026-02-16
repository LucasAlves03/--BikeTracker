import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BikeContext } from '../context/BikeContext';
import Ionicons from '@expo/vector-icons/Ionicons';


const { width } = Dimensions.get('window');

export default function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('all'); 
  const [expandedCard, setExpandedCard] = useState(null);
  const [bestRecords, setBestRecords] = useState({
    distance: null,
    time: null,
    calories: null,
    speed: null,
  });
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
        calculateBestRecords(parsedRecords);
      }
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const calculateBestRecords = (allRecords) => {
    if (allRecords.length === 0) return;

    const best = {
      distance: allRecords.reduce((max, r) => 
        parseFloat(r.distance) > parseFloat(max.distance) ? r : max
      ),
      time: allRecords.reduce((max, r) => 
        parseFloat(r.time) > parseFloat(max.time) ? r : max
      ),
      calories: allRecords.reduce((max, r) => 
        parseFloat(r.calories) > parseFloat(max.calories) ? r : max
      ),
      speed: allRecords.reduce((max, r) => 
        parseFloat(r.speed) > parseFloat(max.speed) ? r : max
      ),
    };

    setBestRecords(best);
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
              calculateBestRecords(updatedRecords);
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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistics</Text>
          <Text style={styles.headerSubtitle}>Your best performances</Text>
        </View>

        {bestRecords.distance && (
          <View style={styles.bestSection}>
            <Text style={styles.sectionTitle}>Personal Records</Text>
            
            <View style={styles.bestGrid}>
              <LinearGradient
                colors={['#3B82F6', '#1E40AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bestCard}
              >
                <Text style={styles.bestLabel}>Best Distance</Text>
                <Text style={styles.bestValue}>{bestRecords.distance.distance} km</Text>
                <Text style={styles.bestDate}>
                  {new Date(bestRecords.distance.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </LinearGradient>

              <LinearGradient
                colors={['#549444', '#38C22F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bestCard}
              >
                <Text style={styles.bestLabel}>Longest Time</Text>
                <Text style={styles.bestValue}>{bestRecords.time.time} min</Text>
                <Text style={styles.bestDate}>
                  {new Date(bestRecords.time.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </LinearGradient>

              <LinearGradient
                colors={['#FF0000', '#FF6200']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bestCard}
              >
                <Text style={styles.bestLabel}>Most Calories</Text>
                <Text style={styles.bestValue}>{bestRecords.calories.calories}</Text>
                <Text style={styles.bestDate}>
                  {new Date(bestRecords.calories.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </LinearGradient>

              <LinearGradient
                colors={['#8B5CF6', '#6D28D9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bestCard}
              >
                <Text style={styles.bestLabel}>Highest Speed</Text>
                <Text style={styles.bestValue}>{bestRecords.speed.speed} km/h</Text>
                <Text style={styles.bestDate}>
                  {new Date(bestRecords.speed.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </LinearGradient>
            </View>
          </View>
        )}

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
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  bestSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  bestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  bestCard: {
    width: (width - 64) / 2,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    minHeight: 100,
    justifyContent: 'center',
  },
  bestLabel: {
    fontSize: 12,
    color: '#E0E7FF',
    marginBottom: 8,
    fontWeight: '500',
  },
  bestValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bestDate: {
    fontSize: 12,
    color: '#E0E7FF',
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