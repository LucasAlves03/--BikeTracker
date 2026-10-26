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
import { getExerciseStreak, listExerciseRecords } from '../utils/exerciseStorage';
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
const formatDecimalPtBr = (value) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
const formatWorkoutMinutes = (value) => {
  const minutes = Math.max(0, Math.round(parseDecimalValue(value)));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} min`;
};
const getLocalDateKey = (date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
const getLongestExerciseStreak = (exerciseRecords) => {
  const dayNumbers = Array.from(
    new Set(
      exerciseRecords
        .map((record) => new Date(record.date))
        .filter((date) => Number.isFinite(date.getTime()))
        .map((date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
    )
  ).sort((a, b) => a - b);

  let longestStreak = 0;
  let currentStreak = 0;
  let previousDay;
  dayNumbers.forEach((day) => {
    currentStreak = day === previousDay + 1 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previousDay = day;
  });
  return longestStreak;
};

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [activeTracker, setActiveTracker] = useState('indoor');
  const [greeting, setGreeting] = useState('Painel');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showGoalsSetup, setShowGoalsSetup] = useState(false);
  const [insightProgressTrackWidth, setInsightProgressTrackWidth] = useState(0);
  const [weeklyStatsByType, setWeeklyStatsByType] = useState({
    indoor: {
      totalDistance: 0,
      totalTime: 0,
      totalCalories: 0,
      totalSteps: 0,
      totalRunningTime: 0,
      averageSpeed: 0,
      sessionsCount: 0,
    },
    walk: {
      totalDistance: 0,
      totalTime: 0,
      totalCalories: 0,
      totalSteps: 0,
      totalRunningTime: 0,
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
  const goalsCompletedByTypeRef = useRef({ indoor: false, walk: false });
  const titleReveal = useRef(new Animated.Value(0)).current;
  const messageReveal = useRef(new Animated.Value(0)).current;
  const activityCardPress = useRef(new Animated.Value(0)).current;
  const insightProgressAnimation = useRef(new Animated.Value(0)).current;
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
  const activityCardBackground = activityCardPress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#212529', '#2B3035'],
  });
  const insightProgressWidth = insightProgressAnimation.interpolate({
    inputRange: [0, 100],
    outputRange: [0, insightProgressTrackWidth],
    extrapolate: 'clamp',
  });

  useFocusEffect(
    React.useCallback(() => {
      let isFocused = true;
      let resetTimeout;
      const refreshHome = async () => {
        await checkWeekReset();
        await loadData();
        await loadProfile();
      };

      const scheduleNextWeekReset = () => {
        const nextMonday = getNextMondayOfWeek();
        const delay = Math.max(nextMonday.getTime() - Date.now() + 100, 1);
        resetTimeout = setTimeout(async () => {
          await refreshHome();
          if (isFocused) scheduleNextWeekReset();
        }, delay);
      };

      refreshHome();
      scheduleNextWeekReset();

      return () => {
        isFocused = false;
        clearTimeout(resetTimeout);
      };
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
        const resetCompletionState = { indoor: false, walk: false };
        goalsCompletedByTypeRef.current = resetCompletionState;
      } else {
        const completedIndoor = await AsyncStorage.getItem('goalsCompletedThisWeek:indoor');
        const completedWalk = await AsyncStorage.getItem('goalsCompletedThisWeek:walk');
        const completionState = {
          indoor: completedIndoor === 'true',
          walk: completedWalk === 'true',
        };
        goalsCompletedByTypeRef.current = completionState;
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
      (type !== 'walk' || parseDecimalValue(goals.runningTime) <= 0 ||
        parseDecimalValue(stats.totalRunningTime) >= parseDecimalValue(goals.runningTime)) &&
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
    const wasCompleted = goalsCompletedByTypeRef.current[type];
    if (isCompletedNow === wasCompleted) return;

    const nextCompletionState = {
      ...goalsCompletedByTypeRef.current,
      [type]: isCompletedNow,
    };
    goalsCompletedByTypeRef.current = nextCompletionState;
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
      const totalRunningTime = typeRecords.reduce((sum, r) => sum + parseDecimalValue(r.runningTime), 0);
      const totalSpeed = typeRecords.reduce((sum, r) => sum + parseDecimalValue(r.speed), 0);

      return {
        totalDistance: totalDistance.toFixed(1),
        totalTime: Math.round(totalTime),
        totalCalories: Math.round(totalCalories),
        totalSteps: Math.round(totalSteps),
        totalRunningTime: Math.round(totalRunningTime),
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

  const getStreak = () => getExerciseStreak(records);

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

  const activeWeeklyStats = weeklyStatsByType[activeTracker];
  const activeWeeklyGoals = weeklyGoalsByType[activeTracker];
  const latestRecord = records[0];
  const latestActivityIsWalk = latestRecord?.activityType === 'walk';
  const latestActivityColor = latestActivityIsWalk ? '#38BDF8' : '#C6F432';
  const latestActivityLabel = latestActivityIsWalk ? 'Caminhada' : 'Bicicleta ergométrica';
  const latestRecordLabel = latestRecord
    ? `${latestActivityLabel} · ${new Date(latestRecord.date).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })}`
    : 'Nenhuma atividade registrada ainda';
  const currentStreak = getStreak();
  const longestStreak = getLongestExerciseStreak(records);
  const streakCaption =
    currentStreak > 0
      ? `Continue assim, faltam ${Math.max(longestStreak - currentStreak, 0)} dias para bater seu recorde.`
      : 'Dias consecutivos com exercício. Treine hoje para começar.';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = getMondayOfWeek();
    date.setDate(date.getDate() + index);
    return {
      date,
      key: getLocalDateKey(date),
      label: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][index],
    };
  });
  const completedWeekDays = new Set(
    records
      .map((record) => new Date(record.date))
      .filter((date) => Number.isFinite(date.getTime()))
      .map(getLocalDateKey)
  );
  const insightWeekStart = getMondayOfWeek().getTime();
  const insightWeekEnd = getNextMondayOfWeek().getTime();
  const insightWeeklyRecords = records.filter((record) => {
    const recordDate = new Date(record.date).getTime();
    return (
      record.activityType === activeTracker &&
      Number.isFinite(recordDate) &&
      recordDate >= insightWeekStart &&
      recordDate < insightWeekEnd
    );
  });
  const timeGoal = parseDecimalValue(activeWeeklyGoals.time);
  const weeklyTime = insightWeeklyRecords.reduce(
    (total, record) => total + parseDecimalValue(record.time),
    0
  );
  const insightPercent = timeGoal > 0 ? Math.round((weeklyTime / timeGoal) * 100) : 0;
  const insightProgressPercent = timeGoal > 0 ? Math.min((weeklyTime / timeGoal) * 100, 100) : 0;
  const insightTitle =
    insightPercent >= 100
      ? 'Meta de tempo batida'
      : insightPercent > 0
        ? `Você já completou ${insightPercent}% da meta de tempo`
        : `Você está em ${insightPercent}% da meta de tempo`;
  const insightSupportingCopy =
    insightPercent >= 100
      ? 'Parabéns! Você superou sua meta de tempo nesta semana.'
      : insightPercent > 0
        ? `Faltam ${formatIntegerPtBr(Math.max(timeGoal - weeklyTime, 0))} min para alcançar sua meta esta semana.`
        : `${insightWeeklyRecords.length} ${
          insightWeeklyRecords.length === 1 ? 'sessão' : 'sessões'
        } nesta semana. Que tal 30 min hoje?`;
  const insightProgressLabel = `${formatIntegerPtBr(weeklyTime)}/${formatIntegerPtBr(timeGoal)} min`;
  const insightProgressTarget =
    insightProgressPercent > 0 ? Math.max(insightProgressPercent, 2) : 0;

  useEffect(() => {
    Animated.timing(insightProgressAnimation, {
      toValue: insightProgressTarget,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [insightProgressTarget, insightProgressAnimation]);

  const animateActivityCardPress = (toValue) => {
    Animated.timing(activityCardPress, {
      toValue,
      duration: 120,
      useNativeDriver: false,
    }).start();
  };
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
            colors={['rgba(39, 43, 47, 0.6)', 'rgba(23, 25, 27, 0.6)']}
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

                {activeTracker === 'walk' && (
                  <View style={styles.legendRow}>
                    <View style={styles.legendItemHeader}>
                      <Text style={styles.legendLabel}>Tempo de corrida</Text>
                      {parseDecimalValue(activeWeeklyGoals.runningTime) > 0 && (
                        <Text style={styles.legendPercent}>
                          {getProgressPercentage(activeWeeklyStats.totalRunningTime, activeWeeklyGoals.runningTime)}%
                        </Text>
                      )}
                    </View>
                    <Text style={styles.legendValue}>
                      {parseDecimalValue(activeWeeklyGoals.runningTime) > 0
                        ? `${activeWeeklyStats.totalRunningTime}/${activeWeeklyGoals.runningTime} min`
                        : `${activeWeeklyStats.totalRunningTime} min acumulados`}
                    </Text>
                    {parseDecimalValue(activeWeeklyGoals.runningTime) > 0 ? (
                      <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(34, 211, 238, 0.2)' }]}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.min(getProgressPercentage(activeWeeklyStats.totalRunningTime, activeWeeklyGoals.runningTime), 100)}%`,
                                backgroundColor: '#22D3EE',
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.legendValue}>Defina uma meta semanal em Ajustar</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.homeSummaryList}>
        <TouchableOpacity
          disabled={!latestRecord}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={latestRecord ? `Abrir ${latestRecordLabel} no Histórico` : undefined}
          onPress={() =>
            latestRecord &&
            router.push({
              pathname: '/(tabs)/history',
              params: { recordId: String(latestRecord.id) },
            })
          }
          onPressIn={() => animateActivityCardPress(1)}
          onPressOut={() => animateActivityCardPress(0)}
        >
          <Animated.View style={[styles.homeCard, { backgroundColor: activityCardBackground }]}>
            <View style={styles.activityHeader}>
              <View style={styles.homeCardIcon}>
                <Ionicons
                  name={latestActivityIsWalk ? 'walk-outline' : 'bicycle-outline'}
                  size={22}
                  color={latestActivityColor}
                />
              </View>
              <View style={styles.activityHeaderCopy}>
                <Text style={styles.homeCardCaption}>Última atividade</Text>
                <Text style={styles.activityTitle} numberOfLines={1} ellipsizeMode="tail">
                  {latestRecordLabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </View>
            <View style={styles.homeCardDivider} />
            <View style={styles.activityStatsRow}>
              <View style={styles.activityStat}>
                <Text style={styles.activityStatValue} numberOfLines={1}>
                  {formatWorkoutMinutes(latestRecord?.time)}
                </Text>
                <Text style={styles.activityStatLabel}>Tempo</Text>
              </View>
              <View style={styles.activityStatDivider} />
              <View style={[styles.activityStat, styles.activityStatSeparated]}>
                <View style={styles.activityStatValueRow}>
                  <Text style={styles.activityStatValue} numberOfLines={1}>
                    {formatDecimalPtBr(parseDecimalValue(latestRecord?.distance))}
                  </Text>
                  <Text style={styles.activityStatUnit}>km</Text>
                </View>
                <Text style={styles.activityStatLabel}>Distância</Text>
              </View>
              <View style={styles.activityStatDivider} />
              <View style={[styles.activityStat, styles.activityStatSeparated]}>
                <View style={styles.activityStatValueRow}>
                  <Text style={styles.activityStatValue} numberOfLines={1}>
                    {formatIntegerPtBr(parseDecimalValue(latestRecord?.runningTime))}
                  </Text>
                  <Text style={styles.activityStatUnit}>min</Text>
                </View>
                <Text style={styles.activityStatLabel}>Corrida</Text>
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <View style={styles.homeCard}>
          <View style={styles.streakHeader}>
            <Text style={styles.streakTitle}>Sequência semanal</Text>
            <View style={styles.streakPill}>
              <Ionicons name="flame" size={16} color="#C6F432" />
              <Text style={styles.streakPillText}>
                {currentStreak} {currentStreak === 1 ? 'dia' : 'dias'}
              </Text>
            </View>
          </View>
          <View style={styles.streakDaysRow}>
            {weekDays.map(({ date, key, label }) => {
              const hasWorkout = completedWeekDays.has(key);
              const isToday = date.getTime() === today.getTime();
              return (
                <View key={key} style={styles.streakDay}>
                  <View
                    style={[
                      styles.streakDayCircle,
                      hasWorkout
                        ? styles.streakDayCompleted
                        : isToday
                          ? styles.streakDayToday
                          : styles.streakDayInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.streakDayLetter,
                        hasWorkout
                          ? styles.streakDayLetterCompleted
                          : isToday
                            ? styles.streakTodayText
                            : styles.streakDayLetterInactive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                  <Text style={[styles.streakTodayCaption, isToday && !hasWorkout && styles.streakTodayText]}>
                    {isToday && !hasWorkout ? 'Hoje' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.streakCaption}>{streakCaption}</Text>
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.insightIcon}>
              <Ionicons name="bulb-outline" size={22} color="#C6F432" />
            </View>
            <View style={styles.insightCopy}>
              <Text style={styles.homeCardCaption}>Insight da semana</Text>
              <Text style={styles.insightTitle}>{insightTitle}</Text>
              <Text style={styles.insightSupportingCopy}>{insightSupportingCopy}</Text>
            </View>
          </View>
          <View style={styles.insightProgressRow}>
            <View
              style={styles.insightProgressTrack}
              onLayout={(event) =>
                setInsightProgressTrackWidth(event.nativeEvent.layout.width)
              }
            >
              <Animated.View
                style={[styles.insightProgressFill, { width: insightProgressWidth }]}
              />
            </View>
            <Text style={styles.insightProgressLabel}>{insightProgressLabel}</Text>
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
    backgroundColor: '#17191B',
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
    backgroundColor: '#17191B',
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
    backgroundColor: '#000',
    borderRadius: 15,
    padding: 6
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
    backgroundColor: '#272B2F',
    borderWidth: 1,
    borderColor: '#17191B',
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
    backgroundColor: '#000',
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
  homeCard: {
    backgroundColor: '#212529',
    borderRadius: 20,
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityHeaderCopy: {
    flex: 1,
  },
  homeCardCaption: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  activityTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  homeCardDivider: {
    height: 1,
    backgroundColor: '#363B40',
    marginTop: 14,
    marginBottom: 14,
  },
  activityStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  activityStat: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  activityStatSeparated: {
    paddingLeft: 14,
  },
  activityStatDivider: {
    width: 1,
    backgroundColor: '#363B40',
  },
  activityStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  activityStatValue: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 1,
  },
  activityStatUnit: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 4,
  },
  activityStatLabel: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  streakTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  streakPillText: {
    color: '#C6F432',
    fontSize: 13,
    fontWeight: '500',
  },
  streakDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakDay: {
    alignItems: 'center',
    flex: 1,
  },
  streakDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
  },
  streakDayCompleted: {
    backgroundColor: '#C6F432',
  },
  streakDayToday: {
    backgroundColor: '#2B3035',
  },
  streakDayInactive: {
    backgroundColor: '#2B3035',
  },
  streakDayLetter: {
    fontSize: 12,
    fontWeight: '600',
  },
  streakDayLetterCompleted: {
    color: '#17191B',
  },
  streakDayLetterInactive: {
    color: '#94A3B8',
  },
  streakTodayCaption: {
    color: 'transparent',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  streakTodayText: {
    color: '#C6F432',
  },
  streakCaption: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  insightCard: {
    backgroundColor: '#212529',
    borderRadius: 20,
    padding: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightCopy: {
    flex: 1,
  },
  insightTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 1,
  },
  insightSupportingCopy: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  insightProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  insightProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#2B3035',
  },
  insightProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#C6F432',
  },
  insightProgressLabel: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
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
    backgroundColor: '#17191B',
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
    backgroundColor: '#17191B',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
  },
  goalBodyScroll: {
    flex: 1,
    backgroundColor: '#17191B',
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
    backgroundColor: '#202428',
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
    backgroundColor: '#272B2F',
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
    backgroundColor: '#272B2F',
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
