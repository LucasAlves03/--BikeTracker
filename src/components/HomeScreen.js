import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProgressChart, LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { BikeContext } from '../context/BikeContext';
import NotificationBell from './NotificationBell';
import { NotificationService } from '../utils/NotificationService';



const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [records, setRecords] = useState([]);
  const [lastExercise, setLastExercise] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState({
    totalDistance: 0,
    totalTime: 0,
    totalCalories: 0,
    averageSpeed: 0,
    sessionsCount: 0,
  });
  const [weeklyGoals, setWeeklyGoals] = useState({
    distance: 80,
    time: 300,
    calories: 1125,
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [goalsCompleted, setGoalsCompleted] = useState(false);
  const { refreshTrigger, triggerNotificationRefresh } = useContext(BikeContext);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      checkWeekReset();
    }, [refreshTrigger])
  );

  const getMondayOfWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; 
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getSundayOfWeek = () => {
    const monday = getMondayOfWeek();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };

  const checkWeekReset = async () => {
    try {
      const lastResetDate = await AsyncStorage.getItem('lastWeekReset');
      const monday = getMondayOfWeek();
      
      if (!lastResetDate || new Date(lastResetDate) < monday) {
        await AsyncStorage.setItem('lastWeekReset', monday.toISOString());
        await AsyncStorage.setItem('goalsCompletedThisWeek', 'false');
        setGoalsCompleted(false);
      } else {
        const completed = await AsyncStorage.getItem('goalsCompletedThisWeek');
        setGoalsCompleted(completed === 'true');
      }
    } catch (error) {
      console.error('Error checking week reset:', error);
    }
  };

  const loadData = async () => {
    try {
      const savedRecords = await AsyncStorage.getItem('bikeRecords');
      if (savedRecords !== null) {
        const parsedRecords = JSON.parse(savedRecords);
        setRecords(parsedRecords);
        
        if (parsedRecords.length > 0) {
          setLastExercise(parsedRecords[0]);
        }
        
        await calculateWeeklyStats(parsedRecords);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const calculateWeeklyStats = async (allRecords) => {
    const monday = getMondayOfWeek();
    const sunday = getSundayOfWeek();

    const weeklyRecords = allRecords.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= monday && recordDate <= sunday;
    });

    const totalDistance = weeklyRecords.reduce((sum, r) => sum + parseFloat(r.distance || 0), 0);
    const totalTime = weeklyRecords.reduce((sum, r) => sum + parseFloat(r.time || 0), 0);
    const totalCalories = weeklyRecords.reduce((sum, r) => sum + parseFloat(r.calories || 0), 0);
    const totalSpeed = weeklyRecords.reduce((sum, r) => sum + parseFloat(r.speed || 0), 0);

    setWeeklyStats({
      totalDistance: totalDistance.toFixed(1),
      totalTime: Math.round(totalTime),
      totalCalories: Math.round(totalCalories),
      averageSpeed: weeklyRecords.length > 0 ? (totalSpeed / weeklyRecords.length).toFixed(1) : 0,
      sessionsCount: weeklyRecords.length,
    });

    const allGoalsCompleted = 
      totalDistance >= weeklyGoals.distance &&
      totalTime >= weeklyGoals.time &&
      totalCalories >= weeklyGoals.calories;

    if (allGoalsCompleted && !goalsCompleted) {
      setShowCelebration(true);
      setGoalsCompleted(true);
      await AsyncStorage.setItem('goalsCompletedThisWeek', 'true');

      await NotificationService.addGoalCompletedNotification();
    }
  };



  const getProgressData = () => {
    return {
      labels: ['Distância', 'Tempo', 'Calorias'],
      data: [
        Math.min(parseFloat(weeklyStats.totalDistance) / weeklyGoals.distance, 1),
        Math.min(parseFloat(weeklyStats.totalTime) / weeklyGoals.time, 1),
        Math.min(parseFloat(weeklyStats.totalCalories) / weeklyGoals.calories, 1),
      ],
    };
  };

  const getLast7DaysData = () => {
    const monday = getMondayOfWeek();
    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date.toISOString().split('T')[0];
    });

    const dailyData = last7Days.map(date => {
      const dayRecords = records.filter(r => r.date.startsWith(date));
      return dayRecords.reduce((sum, r) => sum + parseFloat(r.distance || 0), 0);
    });

    return {
      labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
      datasets: [{
        data: dailyData.length > 0 && dailyData.some(d => d > 0) ? dailyData : [0, 0, 0, 0, 0, 0, 0],
      }],
    };
  };

  const getStreak = () => {
    if (records.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < records.length; i++) {
      const recordDate = new Date(records[i].date);
      recordDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
      } else if (diffDays > streak) {
        break;
      }
    }
    
    return streak;
  };

  const getProgressPercentage = (current, goal) => {
    return Math.min(Math.round((current / goal) * 100), 100);
  };

  const formatDate = (date) => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return new Date(date).toLocaleDateString('en-US', options);
  };

  const formatTime = (time) => {
    return time; 
  };

 

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Modal
        visible={showCelebration}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCelebration(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={[ '#122640', '#122640']}
            style={styles.celebrationCard}
          >
            <View style={styles.ContainerHandle}>
            <Text style={styles.celebrationTitle}>Congratulations!</Text>
            <Text style={styles.celebrationText}>
              You completed all your weekly goals!
            </Text>
            
            <LottieView
              source={require('../../assets/Animations/cycle.json')}
              autoPlay
              loop
              style={styles.lottieAnimation}
            />
            <Text style={styles.resultText}>Your results this week</Text>

            <View style={styles.modalStatsGrid}>
              <View style={styles.modalStatCard}>
                <Text style={styles.modalStatValue}>{weeklyStats.totalTime}</Text>
                <Text style={styles.modalStatLabel}>minutes</Text>
              </View>
              <View style={styles.modalStatCard}>
                <Text style={styles.modalStatValue}>{weeklyStats.averageSpeed}</Text>
                <Text style={styles.modalStatLabel}>avg speed</Text>
              </View>
              <View style={styles.modalStatCard}>
                <Text style={styles.modalStatValue}>{weeklyStats.totalCalories}</Text>
                <Text style={styles.modalStatLabel}>calories</Text>
              </View>
              <View style={styles.modalStatCard}>
                <Text style={styles.modalStatValue}>{weeklyStats.totalDistance}</Text>
                <Text style={styles.modalStatLabel}>Distance</Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.celebrationButton}
              onPress={() => setShowCelebration(false)}
            >
              <Text style={styles.celebrationButtonText}>Continuar</Text>
            </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>{formatDate(new Date())}</Text>
        </View>
        <NotificationBell/>
      </View>

      {lastExercise && (
        <View style={styles.glassCard}>
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.3)', 'rgba(30, 64, 175, 0.3)']}
            style={styles.glassGradient}
          >
            <View style={styles.glassContent}>
              <View style={styles.lastExerciseHeader}>
                <Text style={styles.lastExerciseTitle}>Last Workout</Text>
                <Text style={styles.lastExerciseDate}>{formatTime(lastExercise.displayTime)}</Text>
              </View>
              
              <View style={styles.lastExerciseGrid}>
                <View style={styles.lastExerciseStat}>
                  <Text style={styles.lastExerciseValue}>{lastExercise.time}</Text>
                  <Text style={styles.lastExerciseLabel}>Min</Text>
                </View>
                <View style={styles.lastExerciseStat}>
                  <Text style={styles.lastExerciseValue}>{lastExercise.distance}</Text>
                  <Text style={styles.lastExerciseLabel}>Km</Text>
                </View>
                <View style={styles.lastExerciseStat}>
                  <Text style={styles.lastExerciseValue}>{lastExercise.speed}</Text>
                  <Text style={styles.lastExerciseLabel}>Km/h</Text>
                </View>
                <View style={styles.lastExerciseStat}>
                  <Text style={styles.lastExerciseValue}>{lastExercise.calories}</Text>
                  <Text style={styles.lastExerciseLabel}>Kcal</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      <View style={styles.progressSection}>
        <Text style={styles.sectionTitle}>Weekly Goals</Text>
        <View style={styles.glassCard}>
          <LinearGradient
            colors={['rgba(30, 41, 59, 0.6)', 'rgba(15, 23, 42, 0.6)']}
            style={styles.glassGradient}
          >
            <View style={styles.glassContent}>
              <View style={styles.progressChartContainer}>
                <ProgressChart
                  data={getProgressData()}
                  width={width - 96}
                  height={305}
                  strokeWidth={30}
                  radius={50}
                  chartConfig={{
                     backgroundColor: 'transparent',
                     backgroundGradientFromOpacity: 1,
                     backgroundGradientToOpacity: 0,
                    color: (opacity = 1, index) => {
                      const colors = [
                        `rgba(0, 238, 255, ${opacity})`,
                        `rgba(102, 255, 0, ${opacity})`,
                        `rgba(250, 0, 58, ${opacity})`,

                      ];
                      return colors[index];
                    },
                    labelColor: () => 'transparent',
                  }}
                  hideLegend={true}
                  style={styles.progressChart}
                />
                <View style={styles.progressCenter}>
                  <Text style={styles.progressCenterValue}>
                    {Math.round((getProgressData().data.reduce((a, b) => a + b, 0) / 3) * 100)}%
                  </Text>
                  <Text style={styles.progressCenterLabel}>Complete</Text>
                </View>
              </View>
              
              <View style={styles.progressLegend}>
                <View style={styles.legendRow}>
                  <View style={styles.legendItemHeader}>
                    <Text style={styles.legendLabel}>Distance</Text>
                    <Text style={styles.legendPercent}>
                      {getProgressPercentage(weeklyStats.totalDistance, weeklyGoals.distance)}%
                    </Text>
                  </View>
                  <Text style={styles.legendValue}>
                    {weeklyStats.totalDistance}/{weeklyGoals.distance} km
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(getProgressPercentage(weeklyStats.totalDistance, weeklyGoals.distance), 100)}%`,
                            backgroundColor: '#63dae6',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* Time */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItemHeader}>
                    <Text style={styles.legendLabel}>Time</Text>
                    <Text style={styles.legendPercent}>
                      {getProgressPercentage(weeklyStats.totalTime, weeklyGoals.time)}%
                    </Text>
                  </View>
                  <Text style={styles.legendValue}>
                    {weeklyStats.totalTime}/{weeklyGoals.time} min
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(getProgressPercentage(weeklyStats.totalTime, weeklyGoals.time), 100)}%`,
                            backgroundColor: '#98f84a',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.legendRow}>
                  <View style={styles.legendItemHeader}>
                    <Text style={styles.legendLabel}>Calories</Text>
                    <Text style={styles.legendPercent}>
                      {getProgressPercentage(weeklyStats.totalCalories, weeklyGoals.calories)}%
                    </Text>
                  </View>
                  <Text style={styles.legendValue}>
                    {weeklyStats.totalCalories}/{weeklyGoals.calories}
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(getProgressPercentage(weeklyStats.totalCalories, weeklyGoals.calories), 100)}%`,
                            backgroundColor: '#db374f',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.statsGrid}>
        {[
          { value: weeklyStats.sessionsCount, label: 'Sessions', subtitle: 'This Week' },
          { value: weeklyStats.averageSpeed, label: 'Avg Speed', subtitle: 'Km/h' },
          { value: getStreak(), label: 'Streak', subtitle: 'Days' },
          { value: records.length, label: 'Total', subtitle: 'Sessions' },
        ].map((stat, index) => (
          <View key={index} style={styles.glassStatCard}>
            <LinearGradient
              colors={['rgba(30, 41, 59, 0.5)', 'rgba(15, 23, 42, 0.5)']}
              style={styles.statGradient}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
            </LinearGradient>
          </View>
        ))}
      </View>

      <View style={styles.trendSection}>
        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.glassCard}>
          <LinearGradient
            colors={['rgba(30, 41, 59, 0.6)', 'rgba(15, 23, 42, 0.6)']}
            style={styles.glassGradient}
          >
            <View style={styles.glassContent}>
              <LineChart
                data={getLast7DaysData()}
                width={width - 80}
                height={200}
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: 'transparent',
                  backgroundGradientTo: 'transparent',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#3B82F6',
                  },
                }}
                bezier
                style={styles.lineChart}
              />
              <Text style={styles.chartLabel}>Distance (km)</Text>
            </View>
          </LinearGradient>
        </View>
      </View>

      {weeklyStats.sessionsCount > 0 && (
        <View style={styles.glassCard}>
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.6)', 'rgba(5, 150, 105, 0.6)']}
            style={styles.glassGradient}
          >
            <View style={[styles.glassContent, { alignItems: 'center' }]}>
              <Text style={styles.motivationText}>
                {weeklyStats.sessionsCount >= 4 
                  ? "Amazing week! Keep it up!"
                  : weeklyStats.sessionsCount >= 2
                  ? "Great progress!"
                  : "Good start! Let's keep the momentum!"}
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    textTransform: 'capitalize',
  },
  glassCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  glassGradient: {
    borderRadius: 20,
  },
  glassContent: {
    padding: 20,
  },
  lastExerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 13,
  },
  lastExerciseTitle: {
    fontSize: 25,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lastExerciseDate: {
    fontSize: 20,
    color: '#E0E7FF',
  },
  lastExerciseGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lastExerciseStat: {
    alignItems: 'center',
  },
  lastExerciseValue: {
    fontSize: 25,
    fontWeight: 'bold',
    backgroundColor: '#16191C',
    color: 'white',
    padding: 8,
    borderRadius: 10,
    boxShadow: '3px 4px 6px rgba(0, 0, 0, 0.5)',
  },
  lastExerciseLabel: {
    fontSize: 18,
    fontWeight: '300',
    color: '#E0E7FF',
    marginTop: 4,
  },
  progressSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  progressChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressChart: {
    borderRadius: 20,
  },
  progressCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCenterValue: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#FFFFFF',

  },
  progressCenterLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  progressLegend: {
    marginTop: 20,
  },
  legendRow: {
    marginBottom: 16,
  },
  legendItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  legendPercent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressBarContainer: {
    overflow: 'hidden',
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  glassStatCard: {
    width: (width - 64) / 2,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statGradient: {
    padding: 16,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  trendSection: {
    marginBottom: 24,
  },
  lineChart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  motivationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    
  },
  ContainerHandle: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 30,
  },
  celebrationCard: {
    width: width,
    height: '100%',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    
  },
  
  celebrationTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingTop: 50,

  },
  celebrationText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  lottieAnimation: {
    width: 300,
    height: 300,
    alignSelf: 'center',
  },
  resultText: {
    marginBottom: 14,
    fontSize: 21,
    color: '#fff',
    fontWeight: '600',
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  modalStatCard: {
    width: (width - 80) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  celebrationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    width: 200
  },
  celebrationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});