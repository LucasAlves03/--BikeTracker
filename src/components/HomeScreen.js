import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  TouchableOpacity,
  ImageBackground,
  Animated,
  Easing,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProgressChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BikeContext } from '../context/BikeContext';
import NotificationBell from './NotificationBell';
import { NotificationService } from '../utils/NotificationService';
import WeeklyGoalsSetupModal from './WeeklyGoalsSetupModal';
import { listExerciseRecords } from '../utils/exerciseStorage';
import {
  DEFAULT_WEEKLY_GOALS,
  COMPLETED_WEEKLY_GOALS_KEY,
  WEEKLY_GOALS_KEY,
  getMondayOfWeek,
  getNextMondayOfWeek,
  normalizeWeeklyGoals,
  normalizeStepsGoal,
} from '../utils/weeklyGoals';



const { width } = Dimensions.get('window');
const PROFILE_STORAGE_KEY = 'userProfile';
const ACTIVITY_HEADER_IMAGES = {
  indoor: require('../../assets/header_indoor.png'),
  walk: require('../../assets/header_walk.png'),
};
const CELEBRATION_CARD_CONFIG = [
  {
    key: 'time',
    label: 'Tempo ativo',
    icon: 'time-outline',
    color: '#60A5FA',
    targetLabel: 'Meta semanal',
  },
  {
    key: 'calories',
    label: 'Calorias',
    icon: 'flame-outline',
    color: '#F97316',
    targetLabel: 'Meta semanal',
  },
  {
    key: 'distance',
    label: 'Distancia',
    icon: 'map-outline',
    color: '#22D3EE',
    targetLabel: 'Meta semanal',
  },
  {
    key: 'averageSpeed',
    label: 'Velocidade media',
    icon: 'speedometer-outline',
    color: '#34D399',
    targetLabel: 'Ritmo da semana',
  },
];

const parseDecimalValue = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).trim().replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseStepsValue = normalizeStepsGoal;

const formatIntegerPtBr = (value) => new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [activeTracker, setActiveTracker] = useState('indoor');
  const [greeting, setGreeting] = useState('Painel');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showGoalsSetup, setShowGoalsSetup] = useState(false);
  const [weeklyStatsByType, setWeeklyStatsByType] = useState({
    indoor: {
      totalDistance: 0,
      totalTime: 0,
      totalCalories: 0,
      totalSteps: 0,
      averageSpeed: 0,
      sessionsCount: 0,
    },
    walk: {
      totalDistance: 0,
      totalTime: 0,
      totalCalories: 0,
      totalSteps: 0,
      averageSpeed: 0,
      sessionsCount: 0,
    },
  });
  const [weeklyGoalsByType, setWeeklyGoalsByType] = useState(DEFAULT_WEEKLY_GOALS);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState('indoor');
  const [celebrationPercents, setCelebrationPercents] = useState(() =>
    CELEBRATION_CARD_CONFIG.reduce((acc, card) => ({ ...acc, [card.key]: 0 }), {})
  );
  const [goalsCompletedByType, setGoalsCompletedByType] = useState({
    indoor: false,
    walk: false,
  });
  const titleReveal = useRef(new Animated.Value(0)).current;
  const messageReveal = useRef(new Animated.Value(0)).current;
  const cardRevealAnims = useRef(
    CELEBRATION_CARD_CONFIG.reduce((acc, card) => {
      acc[card.key] = new Animated.Value(0);
      return acc;
    }, {})
  ).current;
  const cardProgressAnims = useRef(
    CELEBRATION_CARD_CONFIG.reduce((acc, card) => {
      acc[card.key] = new Animated.Value(0);
      return acc;
    }, {})
  ).current;
  const { refreshTrigger, triggerRefresh } = useContext(BikeContext);

  useFocusEffect(
    React.useCallback(() => {
      const refreshHome = async () => {
        await checkWeekReset();
        await loadData();
        await loadProfile();
      };

      refreshHome();
    }, [refreshTrigger])
  );

  useEffect(() => {
    loadWeeklyGoals();
  }, []);

  useEffect(() => {
    calculateWeeklyStats(records);
  }, [weeklyGoalsByType]);

  useEffect(() => {
    const listeners = CELEBRATION_CARD_CONFIG.map(({ key }) =>
      cardProgressAnims[key].addListener(({ value }) => {
        const nextPercent = Math.min(100, Math.round(value * 100));
        setCelebrationPercents((prev) => (prev[key] === nextPercent ? prev : { ...prev, [key]: nextPercent }));
      })
    );

    return () => {
      CELEBRATION_CARD_CONFIG.forEach((_, index) => {
        cardProgressAnims[CELEBRATION_CARD_CONFIG[index].key].removeListener(listeners[index]);
      });
    };
  }, [cardProgressAnims]);

  const getGreetingForHour = (hour) => {
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const loadWeeklyGoals = async () => {
    try {
      const savedGoals = await AsyncStorage.getItem(WEEKLY_GOALS_KEY);
      if (!savedGoals) return;

      setWeeklyGoalsByType(normalizeWeeklyGoals(JSON.parse(savedGoals)));
    } catch (error) {
      console.error('Error loading weekly goals:', error);
    }
  };

  const saveWeeklyGoals = async (nextGoals) => {
    try {
      const normalizedGoals = normalizeWeeklyGoals(nextGoals);
      setWeeklyGoalsByType(normalizedGoals);
      await AsyncStorage.setItem(WEEKLY_GOALS_KEY, JSON.stringify(normalizedGoals));
      setShowGoalsSetup(false);
      await calculateWeeklyStats(records, normalizedGoals, { allowCelebration: true });
      triggerRefresh();
    } catch (error) {
      console.error('Error saving weekly goals:', error);
    }
  };

  useEffect(() => {
    const updateGreeting = () => {
      const now = new Date();
      setGreeting(getGreetingForHour(now.getHours()));
    };

    updateGreeting();
    const intervalId = setInterval(updateGreeting, 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const checkWeekReset = async () => {
    try {
      const lastResetDate = await AsyncStorage.getItem('lastWeekReset');
      const monday = getMondayOfWeek();
      
      if (!lastResetDate || new Date(lastResetDate) < monday) {
        if (lastResetDate) {
          const completedIndoor = await AsyncStorage.getItem('goalsCompletedThisWeek:indoor');
          const completedWalk = await AsyncStorage.getItem('goalsCompletedThisWeek:walk');

          if (completedIndoor !== 'true') {
            await NotificationService.addGoalMissedNotification('indoor');
          }
          if (completedWalk !== 'true') {
            await NotificationService.addGoalMissedNotification('walk');
          }
        }

        await AsyncStorage.setItem('lastWeekReset', monday.toISOString());
        await AsyncStorage.setItem('goalsCompletedThisWeek:indoor', 'false');
        await AsyncStorage.setItem('goalsCompletedThisWeek:walk', 'false');
        setGoalsCompletedByType({ indoor: false, walk: false });
      } else {
        const completedIndoor = await AsyncStorage.getItem('goalsCompletedThisWeek:indoor');
        const completedWalk = await AsyncStorage.getItem('goalsCompletedThisWeek:walk');
        setGoalsCompletedByType({
          indoor: completedIndoor === 'true',
          walk: completedWalk === 'true',
        });
      }
    } catch (error) {
      console.error('Error checking week reset:', error);
    }
  };

  const loadData = async () => {
    try {
      const savedRecords = await listExerciseRecords();
      setRecords(savedRecords);
      const latestActivityType = savedRecords[0]?.activityType;
      setActiveTracker(latestActivityType === 'walk' ? 'walk' : 'indoor');
      await calculateWeeklyStats(savedRecords);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadProfile = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      setProfile(savedProfile ? JSON.parse(savedProfile) : null);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const profileInitials = `${profile?.firstName?.trim()?.[0] || ''}${profile?.lastName?.trim()?.[0] || ''}`.toUpperCase() || 'BT';

  const areGoalsCompletedForType = (type, stats, goalsByType = weeklyGoalsByType) => {
    const goals = goalsByType[type];
    return (
      parseDecimalValue(stats.totalDistance) >= parseDecimalValue(goals.distance) &&
      parseDecimalValue(stats.totalTime) >= parseDecimalValue(goals.time) &&
      parseDecimalValue(stats.totalCalories) >= parseDecimalValue(goals.calories) &&
      (type !== 'walk' || parseStepsValue(stats.totalSteps) >= parseStepsValue(goals.steps || 0))
    );
  };

  const syncGoalCompletionState = async (
    type,
    isCompletedNow,
    stats,
    goalsByType,
    options = { allowCelebration: true }
  ) => {
    const wasCompleted = goalsCompletedByType[type];
    if (isCompletedNow === wasCompleted) return;

    setGoalsCompletedByType((prev) => ({ ...prev, [type]: isCompletedNow }));
    await AsyncStorage.setItem(`goalsCompletedThisWeek:${type}`, isCompletedNow ? 'true' : 'false');

    if (isCompletedNow && !wasCompleted && options.allowCelebration) {
      const weekStart = getMondayOfWeek();
      const weekEnd = getNextMondayOfWeek();
      const savedCompletions = await AsyncStorage.getItem(COMPLETED_WEEKLY_GOALS_KEY);
      const completions = savedCompletions ? JSON.parse(savedCompletions) : [];
      const alreadyRecorded = completions.some(
        (completion) => completion.weekStart === weekStart.toISOString() && completion.type === type
      );

      if (!alreadyRecorded) {
        const completion = {
          id: `${weekStart.toISOString()}-${type}`,
          type,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          stats,
          goals: goalsByType[type],
          completedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(
          COMPLETED_WEEKLY_GOALS_KEY,
          JSON.stringify([completion, ...completions].slice(0, 52))
        );
        setShowCelebration(true);
        setCelebrationType(type);
        await NotificationService.addGoalCompletedNotification();
      }
      return;
    }

    if (!isCompletedNow && wasCompleted && showCelebration && celebrationType === type) {
      setShowCelebration(false);
    }
  };

  const calculateWeeklyStats = async (
    allRecords,
    goalsByType = weeklyGoalsByType,
    options = { allowCelebration: true }
  ) => {
    const monday = getMondayOfWeek();
    const nextMonday = getNextMondayOfWeek();

    const weeklyRecords = allRecords.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= monday && recordDate < nextMonday;
    });

    const byType = {
      indoor: weeklyRecords.filter(r => r.activityType === 'indoor'),
      walk: weeklyRecords.filter(r => r.activityType === 'walk'),
    };

    const buildStats = (typeRecords) => {
      const totalDistance = typeRecords.reduce((sum, r) => sum + parseDecimalValue(r.distance), 0);
      const totalTime = typeRecords.reduce((sum, r) => sum + parseDecimalValue(r.time), 0);
      const totalCalories = typeRecords.reduce((sum, r) => sum + parseDecimalValue(r.calories), 0);
      const totalSteps = typeRecords.reduce((sum, r) => sum + parseStepsValue(r.steps), 0);
      const totalSpeed = typeRecords.reduce((sum, r) => sum + parseDecimalValue(r.speed), 0);

      return {
        totalDistance: totalDistance.toFixed(1),
        totalTime: Math.round(totalTime),
        totalCalories: Math.round(totalCalories),
        totalSteps: Math.round(totalSteps),
        averageSpeed: typeRecords.length > 0 ? (totalSpeed / typeRecords.length).toFixed(1) : 0,
        sessionsCount: typeRecords.length,
      };
    };

    const nextWeeklyStatsByType = {
      indoor: buildStats(byType.indoor),
      walk: buildStats(byType.walk),
    };

    setWeeklyStatsByType(nextWeeklyStatsByType);

    const indoorCompletedNow = areGoalsCompletedForType('indoor', nextWeeklyStatsByType.indoor, goalsByType);
    const walkCompletedNow = areGoalsCompletedForType('walk', nextWeeklyStatsByType.walk, goalsByType);

    await syncGoalCompletionState('indoor', indoorCompletedNow, nextWeeklyStatsByType.indoor, goalsByType, options);
    await syncGoalCompletionState('walk', walkCompletedNow, nextWeeklyStatsByType.walk, goalsByType, options);
  };




  const getProgressData = () => {
    const stats = weeklyStatsByType[activeTracker];
    const goals = weeklyGoalsByType[activeTracker];
    const safeProgress = (current, goal) => {
      const goalNumber = parseDecimalValue(goal);
      if (goalNumber <= 0) return 0;
      return Math.min(parseDecimalValue(current) / goalNumber, 1);
    };
    const labels = ['Distancia', 'Tempo', 'Calorias'];
    const data = [
      safeProgress(stats.totalDistance, goals.distance),
      safeProgress(stats.totalTime, goals.time),
      safeProgress(stats.totalCalories, goals.calories),
    ];

    return { labels, data };
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
    const currentValue = parseDecimalValue(current);
    const goalValue = parseDecimalValue(goal);
    if (!goalValue || goalValue <= 0) return 0;
    return Math.min(Math.round((currentValue / goalValue) * 100), 100);
  };

  const formatDate = (date) => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return new Date(date).toLocaleDateString('pt-BR', options);
  };

  const getTrackerLabel = (type) => (type === 'walk' ? 'Caminhada' : 'Bic. Ergométrica');

  const combinedWeeklySessions = weeklyStatsByType.indoor.sessionsCount + weeklyStatsByType.walk.sessionsCount;
  const activeWeeklyStats = weeklyStatsByType[activeTracker];
  const activeWeeklyGoals = weeklyGoalsByType[activeTracker];
  const latestRecord = records[0];
  const latestRecordLabel = latestRecord
    ? `${getTrackerLabel(latestRecord.activityType)} · ${latestRecord.displayDate || formatDate(latestRecord.date)}`
    : 'Nenhuma atividade registrada ainda';
  const latestRecordSummary = latestRecord
    ?   `${latestRecord.time || 0} min · ${latestRecord.distance || 0} km`
    : 'Registre um exercício para acompanhar sua evolução.';
  const currentStreak = getStreak();
  const insight = goalsCompletedByType[activeTracker]
    ? `Meta de ${getTrackerLabel(activeTracker).toLowerCase()} concluída nesta semana.`
    : `Você completou ${getProgressPercentage(activeWeeklyStats.totalTime, activeWeeklyGoals.time)}% da meta de tempo.`;
  const celebrationStats = weeklyStatsByType[celebrationType];
  const celebrationGoals = weeklyGoalsByType[celebrationType];
  const goalMetricCards = useMemo(
    () =>
      CELEBRATION_CARD_CONFIG.map((card) => {
        if (card.key === 'time') {
          return {
            ...card,
            value: `${celebrationStats.totalTime} min`,
            target: `${celebrationGoals.time} min`,
            progress: getProgressPercentage(celebrationStats.totalTime, celebrationGoals.time),
          };
        }
        if (card.key === 'calories') {
          return {
            ...card,
            value: `${celebrationStats.totalCalories} kcal`,
            target: `${celebrationGoals.calories} kcal`,
            progress: getProgressPercentage(celebrationStats.totalCalories, celebrationGoals.calories),
          };
        }
        if (card.key === 'distance') {
          return {
            ...card,
            value: `${celebrationStats.totalDistance} km`,
            target: `${celebrationGoals.distance} km`,
            progress: getProgressPercentage(celebrationStats.totalDistance, celebrationGoals.distance),
          };
        }
        return {
          ...card,
          value: `${celebrationStats.averageSpeed} km/h`,
          target: card.targetLabel,
          progress: parseFloat(celebrationStats.averageSpeed || 0) > 0 ? 100 : 0,
        };
      }),
    [celebrationStats, celebrationGoals]
  );
  const celebrationSummary = `Essa semana voce se exercitou por ${celebrationStats.totalTime} minutos, queimou ${celebrationStats.totalCalories} calorias e percorreu ${celebrationStats.totalDistance} km com velocidade media de ${celebrationStats.averageSpeed} km/h.`;

  useEffect(() => {
    if (!showCelebration) return;

    titleReveal.setValue(0);
    messageReveal.setValue(0);
    CELEBRATION_CARD_CONFIG.forEach(({ key }) => {
      cardRevealAnims[key].setValue(0);
      cardProgressAnims[key].setValue(0);
    });
    setCelebrationPercents(
      CELEBRATION_CARD_CONFIG.reduce((acc, card) => ({ ...acc, [card.key]: 0 }), {})
    );

    const sequence = [
      Animated.timing(titleReveal, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(messageReveal, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...goalMetricCards.map((card) =>
        Animated.sequence([
          Animated.timing(cardRevealAnims[card.key], {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cardProgressAnims[card.key], {
            toValue: card.progress / 100,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ])
      ),
    ];

    Animated.sequence(sequence).start();
  }, [
    showCelebration,
    celebrationType,
    goalMetricCards,
    titleReveal,
    messageReveal,
    cardRevealAnims,
    cardProgressAnims,
  ]);

  return (
    <View style={styles.container}>
      <View
        style={styles.header}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <View>
          <Text style={styles.headerTitle}>{greeting}</Text>
          <Text style={styles.headerSubtitle}>{formatDate(new Date())}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            {profile?.pictureUri ? (
              <Image source={{ uri: profile.pictureUri }} style={styles.profileImage} />
            ) : (
              <Text style={styles.profileInitials}>{profileInitials}</Text>
            )}
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: headerHeight + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >

      <Modal
        visible={showCelebration}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCelebration(false)}
      >
        <View style={styles.goalModalOverlay}>
          <View style={styles.goalModalCard}>
            <ImageBackground
              source={ACTIVITY_HEADER_IMAGES[celebrationType]}
              style={styles.goalHeaderImage}
              imageStyle={styles.goalHeaderImageStyle}
              resizeMode="cover"
            />

            <ScrollView
              style={styles.goalBodyScroll}
              contentContainerStyle={styles.goalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.goalBodyHeader}>
                <Text style={styles.goalSectionTitle}>
                  Resumo da semana ({getTrackerLabel(celebrationType)})
                </Text>
              </View>
              <View style={styles.goalMetricsGrid}>
                {goalMetricCards.map((card) => (
                  <View key={card.key} style={styles.goalMetricCard}>
                    <View style={styles.goalMetricHeader}>
                      <Ionicons name={card.icon} size={28} color="#E2E8F0" />
                      <Text style={styles.goalMetricLabel}>{card.label}</Text>
                    </View>
                    <Text style={styles.goalMetricValue}>{card.value}</Text>
                    <Text style={styles.goalMetricTarget}>Meta: {card.target}</Text>
                    <View style={styles.goalMetricTrack}>
                      <View
                        style={[
                          styles.goalMetricFill,
                          { width: `${Math.min(card.progress, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.goalMetricPercent}>{card.progress}%</Text>
                  </View>
                ))}
              </View>

              <View style={styles.goalActions}>
                <TouchableOpacity
                  style={styles.goalGhostButton}
                  onPress={() =>
                    setCelebrationType((prev) => (prev === 'indoor' ? 'walk' : 'indoor'))
                  }
                >
                  <Text style={styles.goalGhostButtonText}>Trocar tipo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.goalPrimaryButton}
                  onPress={() => setShowCelebration(false)}
                >
                  <Text style={styles.goalPrimaryButtonText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <WeeklyGoalsSetupModal
        visible={showGoalsSetup}
        onClose={() => setShowGoalsSetup(false)}
        onSave={saveWeeklyGoals}
        goalsByType={weeklyGoalsByType}
        statsByType={weeklyStatsByType}
      />

      <View style={styles.trackerToggle}>
        {['indoor', 'walk'].map((type) => {
          const isActive = activeTracker === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.trackerTab, isActive && styles.trackerTabActive]}
              onPress={() => setActiveTracker(type)}
            >
              <Text style={[styles.trackerTabText, isActive && styles.trackerTabTextActive]}>
                {getTrackerLabel(type)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.progressSection}>
        <View style={styles.sectionTitleRow}>
          
          <Text style={styles.sectionTitleCompact}>Metas Semanais</Text>
          <TouchableOpacity
            style={styles.editGoalsButton}
            onPress={() => setShowGoalsSetup(true)}
          >
            <Ionicons name="options-outline" size={14} color="#E2E8F0" />
            <Text style={styles.editGoalsButtonText}>Ajustar</Text>
          </TouchableOpacity>
        </View>
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
                    {Math.round((getProgressData().data.reduce((a, b) => a + b, 0) / getProgressData().data.length) * 100)}%
                  </Text>
                  <Text style={styles.progressCenterLabel}>Concluído</Text>
                </View>
              </View>
              
              <View style={styles.progressLegend}>
                <View style={styles.legendRow}>
                  <View style={styles.legendItemHeader}>
                    <Text style={styles.legendLabel}>Distância</Text>
                    <Text style={styles.legendPercent}>
                      {getProgressPercentage(activeWeeklyStats.totalDistance, activeWeeklyGoals.distance)}%
                    </Text>
                  </View>
                  <Text style={styles.legendValue}>
                    {activeWeeklyStats.totalDistance}/{activeWeeklyGoals.distance} km
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(getProgressPercentage(activeWeeklyStats.totalDistance, activeWeeklyGoals.distance), 100)}%`,
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
                    <Text style={styles.legendLabel}>Tempo</Text>
                    <Text style={styles.legendPercent}>
                      {getProgressPercentage(activeWeeklyStats.totalTime, activeWeeklyGoals.time)}%
                    </Text>
                  </View>
                  <Text style={styles.legendValue}>
                    {activeWeeklyStats.totalTime}/{activeWeeklyGoals.time} min
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(getProgressPercentage(activeWeeklyStats.totalTime, activeWeeklyGoals.time), 100)}%`,
                            backgroundColor: '#98f84a',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.legendRow}>
                  <View style={styles.legendItemHeader}>
                    <Text style={styles.legendLabel}>Calorias</Text>
                    <Text style={styles.legendPercent}>
                      {getProgressPercentage(activeWeeklyStats.totalCalories, activeWeeklyGoals.calories)}%
                    </Text>
                  </View>
                  <Text style={styles.legendValue}>
                    {activeWeeklyStats.totalCalories}/{activeWeeklyGoals.calories}
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(getProgressPercentage(activeWeeklyStats.totalCalories, activeWeeklyGoals.calories), 100)}%`,
                            backgroundColor: '#db374f',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {activeTracker === 'walk' && parseStepsValue(activeWeeklyGoals.steps || 0) > 0 && (
                  <View style={styles.legendRow}>
                    <View style={styles.legendItemHeader}>
                      <Text style={styles.legendLabel}>Passos</Text>
                      <Text style={styles.legendPercent}>
                        {getProgressPercentage(parseStepsValue(activeWeeklyStats.totalSteps), parseStepsValue(activeWeeklyGoals.steps))}%
                      </Text>
                    </View>
                    <Text style={styles.legendValue}>
                      {formatIntegerPtBr(parseStepsValue(activeWeeklyStats.totalSteps))}/{formatIntegerPtBr(parseStepsValue(activeWeeklyGoals.steps))}
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(148, 163, 184, 0.2)' }]}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(getProgressPercentage(parseStepsValue(activeWeeklyStats.totalSteps), parseStepsValue(activeWeeklyGoals.steps)), 100)}%`,
                              backgroundColor: '#38BDF8',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.homeSummaryList}>
        <View style={[styles.homeSummaryCard, styles.homeSummaryCardBlue]}>
          <View style={styles.homeSummaryIcon}>
            <Ionicons name="pulse-outline" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.homeSummaryCopy}>
            <Text style={styles.homeSummaryLabel}>Atividade recente</Text>
            <Text style={styles.homeSummaryValue} numberOfLines={1}>{latestRecordLabel}</Text>
            <Text style={styles.homeSummarySubtitle} numberOfLines={2}>{latestRecordSummary}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </View>

        <View style={[styles.homeSummaryCard, styles.homeSummaryCardGreen]}>
          <View style={styles.homeSummaryIcon}>
            <Ionicons name="flame-outline" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.homeSummaryCopy}>
            <Text style={styles.homeSummaryLabel}>Sequência semanal</Text>
            <Text style={styles.homeSummaryValue}>{currentStreak} {currentStreak === 1 ? 'dia' : 'dias'}</Text>
            <Text style={styles.homeSummarySubtitle}>Dias consecutivos com exercício</Text>
          </View>
        </View>

        <View style={[styles.homeSummaryCard, styles.homeSummaryCardPurple]}>
          <View style={styles.homeSummaryIcon}>
            <Ionicons name="bulb-outline" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.homeSummaryCopy}>
            <Text style={styles.homeSummaryLabel}>Insight da semana</Text>
            <Text style={styles.homeSummaryValue} numberOfLines={2}>{insight}</Text>
            <Text style={styles.homeSummarySubtitle}>{combinedWeeklySessions} sessões nesta semana</Text>
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  trackerToggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: 'black',
    borderRadius: 15,
    padding: 8
  },
  trackerTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  trackerTabActive: {
    backgroundColor: '#fff',
  },
  trackerTabText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  trackerTabTextActive: {
    color: 'black',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16, 
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#212529',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
  sectionTitleRow: {
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingRight: 24,
    paddingBottom: 10,
    minHeight: 36,
  },
  sectionTitleCompact: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editGoalsButton: {
    position: 'absolute',
    right: 24,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  editGoalsButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
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
  homeSummaryList: {
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  homeSummaryCard: {
    minHeight: 94,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeSummaryCardBlue: {
    backgroundColor: '#668DC4',
  },
  homeSummaryCardGreen: {
    backgroundColor: '#62A77C',
  },
  homeSummaryCardPurple: {
    backgroundColor: '#624E8C',
  },
  homeSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  homeSummaryCopy: {
    flex: 1,
  },
  homeSummaryLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  homeSummaryValue: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  homeSummarySubtitle: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 3,
    opacity: 0.9,
  },
  glassStatCard: {
    backgroundColor: '#040404',
    width: (width - 64) / 2,
    marginBottom: 16,
    borderRadius: 16,
  },
  statGradient: {
    padding: 16,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#0078d4',
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
    color: '#d61919',
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
  goalModalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  goalModalCard: {
    flex: 1,
    width: '100%',
    borderRadius: 0,
    backgroundColor: '#050505',
    overflow: 'hidden',
  },
  goalHeaderImage: {
    height: 300,
    justifyContent: 'flex-end',
  },
  goalHeaderImageStyle: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  goalBodyHeader: {
    paddingTop: 5,
    paddingBottom: 0,
   
  },
 
  goalBody: {
    backgroundColor: '#050505',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
  },
  goalBodyScroll: {
    flex: 1,
    backgroundColor: '#050505',
  },
  goalSectionTitle: {
    marginBottom: 4,
    fontSize: 21,
    fontWeight: '700',
    color: '#fff',
  },
  goalMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    columnGap: 10,
  },
  goalMetricCard: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 15,
    backgroundColor: '#0B0B0B',
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#282828d1'
  },
  goalMetricHeader: {
   
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  goalMetricLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    
  },
  goalMetricValue: {
    fontSize: 16,
    color: '#ff581b',
    fontWeight: '800',
  },
  goalMetricTarget: {
    marginTop: 2,
    fontSize: 12,
    color: '#94A3B8',
  },
  goalMetricTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1F2937',
    overflow: 'hidden',
  },
  goalMetricFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#ff581b',
  },
  goalMetricPercent: {
    marginTop: 6,
    fontSize: 12,
    color: '#ff581b',
    fontWeight: '700',
  },
  goalActions: {
    marginTop: 15,
    flexDirection: 'row',
    gap: 12,
  },
  goalGhostButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4e4e4f80',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalGhostButtonText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 14,
  },
  goalPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0683cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});


