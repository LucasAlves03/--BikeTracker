import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { BikeContext } from '../context/BikeContext';
import { listExerciseRecords } from '../utils/exerciseStorage';
import {
  DEFAULT_WEEKLY_GOALS,
  WEEKLY_GOALS_KEY,
  normalizeWeeklyGoals,
} from '../utils/weeklyGoals';

const PROFILE_STORAGE_KEY = 'userProfile';

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  age: '',
  sex: '',
  goal: '',
  pictureUri: '',
};

const SEX_OPTIONS = ['Feminino', 'Masculino', 'Outro'];

// Weekly targets used to fill the "Metas Semanais" progress bars.
// Tune these to whatever makes sense for your users (or make them editable later).
const STEPS_PER_KM = 1300;

const parseMetricNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).trim().replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const estimateSteps = (record) => {
  const explicitSteps = parseMetricNumber(record.steps);
  if (explicitSteps > 0) return explicitSteps;
  return Math.round(parseMetricNumber(record.distance) * STEPS_PER_KM);
};

const formatShortDate = (dateValue) =>
  new Date(dateValue).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

const formatPerformanceDate = (dateValue) =>
  new Date(dateValue).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const getActivityLabel = (type) => (type === 'walk' ? 'Caminhada' : 'Bic. Ergonometrica');

const formatMetricValue = (value, unit) => {
  const numeric = parseMetricNumber(value);
  if (unit === 'min' || unit === 'kcal' || unit === 'Kcal') return `${Math.round(numeric)} ${unit}`;
  return `${numeric.toFixed(1)} ${unit}`;
};

const formatSteps = (value) => {
  const numeric = Math.round(parseMetricNumber(value));
  if (numeric >= 1000) {
    const thousands = numeric / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return `${numeric}`;
};

const formatInlineNumber = (value) =>
  Math.round(parseMetricNumber(value)).toLocaleString('en-US');

const formatDuration = (minutes) => {
  const total = Math.round(parseMetricNumber(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
};

const buildInitials = (profile) => {
  const first = profile?.firstName?.trim()?.[0] || '';
  const last = profile?.lastName?.trim()?.[0] || '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || 'BT';
};

const normalizeProfile = (form) => ({
  firstName: form.firstName.trim(),
  lastName: form.lastName.trim(),
  age: form.age.trim(),
  sex: form.sex.trim(),
  goal: form.goal.trim(),
  pictureUri: form.pictureUri || '',
  updatedAt: new Date().toISOString(),
});

const getProgressPercent = (value, goal) => {
  if (!goal) return 0;
  return Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [weeklyGoalsByType, setWeeklyGoalsByType] = useState(DEFAULT_WEEKLY_GOALS);
  const { refreshTrigger } = React.useContext(BikeContext);

  const loadProfile = useCallback(async () => {
    try {
      const savedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      setProfile(savedProfile ? JSON.parse(savedProfile) : null);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Erro', 'Falha ao carregar perfil');
    }
  }, []);

  const loadWeeklyGoals = useCallback(async () => {
    try {
      const savedGoals = await AsyncStorage.getItem(WEEKLY_GOALS_KEY);
      setWeeklyGoalsByType(normalizeWeeklyGoals(savedGoals ? JSON.parse(savedGoals) : null));
    } catch (error) {
      console.error('Error loading profile weekly goals:', error);
      setWeeklyGoalsByType(DEFAULT_WEEKLY_GOALS);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const savedRecords = await listExerciseRecords();
      setRecords(savedRecords);
    } catch (error) {
      console.error('Error loading profile records:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (refreshTrigger >= 0) {
        loadProfile();
        loadRecords();
        loadWeeklyGoals();
      }
    }, [loadProfile, loadRecords, loadWeeklyGoals, refreshTrigger])
  );

  const stats = useMemo(() => {
    const totalDistance = records.reduce((sum, record) => sum + parseMetricNumber(record.distance), 0);
    const totalTime = records.reduce((sum, record) => sum + parseMetricNumber(record.time), 0);
    const totalCalories = records.reduce((sum, record) => sum + parseMetricNumber(record.calories), 0);
    const totalSteps = records.reduce((sum, record) => sum + estimateSteps(record), 0);

    const now = new Date();
    const day = now.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const weeklyRecords = records.filter((record) => {
      const time = new Date(record.date).getTime();
      return Number.isFinite(time) && time >= weekStart.getTime() && time < weekEnd.getTime();
    });
    const weeklyTime = weeklyRecords.reduce((sum, record) => sum + parseMetricNumber(record.time), 0);
    const weeklyDistance = weeklyRecords.reduce((sum, record) => sum + parseMetricNumber(record.distance), 0);
    const weeklyCalories = weeklyRecords.reduce((sum, record) => sum + parseMetricNumber(record.calories), 0);
    const weeklySteps = weeklyRecords.reduce((sum, record) => sum + estimateSteps(record), 0);

    const latestRecords = [...records]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    const getBestRecord = (metric, valueGetter = (record) => parseMetricNumber(record[metric])) => {
      return records.reduce((best, record) => {
        const value = valueGetter(record);
        if (value <= 0 || !Number.isFinite(new Date(record.date).getTime())) return best;
        return !best || value > best.value ? { record, value } : best;
      }, null);
    };

    const bestPerformance = {
      calories: getBestRecord('calories'),
      steps: getBestRecord('steps', estimateSteps),
      time: getBestRecord('time'),
      distance: getBestRecord('distance'),
    };
    const weeklyGoals = {
      time: parseMetricNumber(weeklyGoalsByType.indoor.time) + parseMetricNumber(weeklyGoalsByType.walk.time),
      distance: parseMetricNumber(weeklyGoalsByType.indoor.distance) + parseMetricNumber(weeklyGoalsByType.walk.distance),
      calories: parseMetricNumber(weeklyGoalsByType.indoor.calories) + parseMetricNumber(weeklyGoalsByType.walk.calories),
      steps: parseMetricNumber(weeklyGoalsByType.indoor.steps) + parseMetricNumber(weeklyGoalsByType.walk.steps),
    };

    return {
      totalExercises: records.length,
      totalDistance,
      totalTime,
      totalCalories,
      totalSteps,
      bestPerformance,
      weeklyProgress: {
        time: getProgressPercent(weeklyTime, weeklyGoals.time),
        distance: getProgressPercent(weeklyDistance, weeklyGoals.distance),
        calories: getProgressPercent(weeklyCalories, weeklyGoals.calories),
        steps: getProgressPercent(weeklySteps, weeklyGoals.steps),
      },
      latestRecords,
    };
  }, [records, weeklyGoalsByType]);

  const openCreateForm = () => {
    setForm(INITIAL_FORM);
    setShowForm(true);
  };

  const openEditForm = () => {
    setForm({
      ...INITIAL_FORM,
      ...profile,
      age: profile?.age ? String(profile.age) : '',
    });
    setShowForm(true);
  };

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickImage = async (onPicked) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissao necessaria',
          'Precisamos de acesso as suas fotos para definir a imagem de perfil.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        onPicked(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erro', 'Falha ao selecionar imagem');
    }
  };

  // Tapping the avatar on the profile card updates + saves the picture immediately.
  const handleAvatarPress = () => {
    if (!profile) return;
    pickImage(async (uri) => {
      const nextProfile = { ...profile, pictureUri: uri, updatedAt: new Date().toISOString() };
      try {
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
        setProfile(nextProfile);
      } catch (error) {
        console.error('Error saving picture:', error);
        Alert.alert('Erro', 'Falha ao salvar imagem');
      }
    });
  };

  // Picking a photo inside the edit form only stages it until "Salvar" is pressed.
  const handleFormImagePick = () => {
    pickImage((uri) => updateForm('pictureUri', uri));
  };

  const saveProfile = async () => {
    const nextProfile = normalizeProfile(form);

    if (!nextProfile.firstName || !nextProfile.lastName || !nextProfile.age || !nextProfile.sex || !nextProfile.goal) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatorios');
      return;
    }

    const parsedAge = parseInt(nextProfile.age, 10);
    if (!Number.isFinite(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
      Alert.alert('Erro', 'Informe uma idade valida');
      return;
    }

    try {
      const profileToSave = { ...nextProfile, age: String(parsedAge) };
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileToSave));
      setProfile(profileToSave);
      setShowForm(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Erro', 'Falha ao salvar perfil');
    }
  };

  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View
        style={styles.header}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <Text style={styles.headerTitle}>Perfil</Text>
        <Text style={styles.headerSubtitle}>Suas informacoes e desempenho</Text>
      </View>

      {!profile ? (
        <View style={[styles.emptyContainer, { paddingTop: headerHeight }]}>
          <View style={styles.emptyAvatar}>
            <Ionicons name="person-outline" size={56} color="#E2E8F0" />
          </View>
          <Text style={styles.emptyTitle}>Crie seu perfil</Text>
          <Text style={styles.emptySubtitle}>
            Salve seus dados basicos para acompanhar sua jornada de treino.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openCreateForm}>
            <Text style={styles.primaryButtonText}>Criar perfil</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ---- Profile card (light card with picture, name, badge, quick stats) ---- */}
          <View style={styles.profileCard}>
            <View style={styles.profileCardTop}>
              <TouchableOpacity style={styles.avatarWrap} onPress={handleAvatarPress} activeOpacity={0.8}>
                {profile.pictureUri ? (
                  <Image source={{ uri: profile.pictureUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={28} color="#94A3B8" />
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={11} color="#0F172A" />
                </View>
              </TouchableOpacity>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>{fullName}</Text>
                <Text style={styles.profileMeta}>
                  {profile.age} Anos | {profile.sex}
                </Text>
              </View>

              <TouchableOpacity style={styles.editBadge} onPress={openEditForm}>
                <Text style={styles.editBadgeText}>EDITAR</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.objectiveSection}>
              <Text style={styles.objectiveLabel}>Objetivo</Text>
              <Text style={styles.objectiveText} numberOfLines={2} ellipsizeMode="tail">
                {profile.goal}
              </Text>
            </View>

            <View style={styles.metricSummary}>
              <View style={styles.metricSummaryItem}>
                <Text style={styles.metricSummaryValue}>{stats.totalExercises}</Text>
                <Text style={styles.metricSummaryLabel}>Exercícios</Text>
              </View>
              <View style={styles.metricSummaryDivider} />
              <View style={styles.metricSummaryItem}>
                <Text style={styles.metricSummaryValue}>{formatInlineNumber(stats.totalCalories)}</Text>
                <Text style={styles.metricSummaryLabel}>Kcal</Text>
              </View>
              <View style={styles.metricSummaryDivider} />
              <View style={styles.metricSummaryItem}>
                <Text style={styles.metricSummaryValue}>{formatSteps(stats.totalSteps)}</Text>
                <Text style={styles.metricSummaryLabel}>Passos</Text>
              </View>
            </View>
          </View>

          {/* ---- Melhor Performance grid ---- */}
          <Text style={styles.sectionTitle}>Melhor Performance</Text>
          <View style={styles.performanceGrid}>
            <View style={[styles.performanceCard, styles.performanceCardPeach]}>
              <View style={styles.performanceHeader}>
                <Text style={styles.performanceLabel}>Calorias</Text>
                <View style={styles.performanceIconWrap}>
                  <Ionicons name="flame-outline" size={28} color="#FCA5A5" />
                </View>
              </View>
              {stats.bestPerformance.calories ? (
                <>
                  <View style={styles.performanceValueRow}>
                    <Text style={styles.performanceValue}>{Math.round(stats.bestPerformance.calories.value)}</Text>
                    <Text style={styles.performanceUnit}>Kcal</Text>
                  </View>
                  <Text style={styles.performanceDate}>{formatPerformanceDate(stats.bestPerformance.calories.record.date)}</Text>
                </>
              ) : <Text style={styles.performanceEmpty}>Sem dados</Text>}
            </View>

            <View style={[styles.performanceCard, styles.performanceCardLavender]}>
              <View style={styles.performanceHeader}>
                <Text style={styles.performanceLabel}>Passos</Text>
                <View style={styles.performanceIconWrap}>
                  <Ionicons name="footsteps-outline" size={28} color="#E9D5FF" />
                </View>
              </View>
              {stats.bestPerformance.steps ? (
                <>
                  <View style={styles.performanceValueRow}>
                    <Text style={styles.performanceValue}>{formatSteps(stats.bestPerformance.steps.value)}</Text>
                  </View>
                  <Text style={styles.performanceDate}>{formatPerformanceDate(stats.bestPerformance.steps.record.date)}</Text>
                </>
              ) : <Text style={styles.performanceEmpty}>Sem dados</Text>}
            </View>

            <View style={[styles.performanceCard, styles.performanceCardMint]}>
              <View style={styles.performanceHeader}>
                <Text style={styles.performanceLabel}>Tempo</Text>
                <View style={styles.performanceIconWrap}>
                  <Ionicons name="time-outline" size={28} color="#BBF7D0" />
                </View>
              </View>
              {stats.bestPerformance.time ? (
                <>
                  <View style={styles.performanceValueRow}>
                    <Text style={styles.performanceValue}>{formatDuration(stats.bestPerformance.time.value)}</Text>
                    <Text style={styles.performanceUnit}>h</Text>
                  </View>
                  <Text style={styles.performanceDate}>{formatPerformanceDate(stats.bestPerformance.time.record.date)}</Text>
                </>
              ) : <Text style={styles.performanceEmpty}>Sem dados</Text>}
            </View>

            <View style={[styles.performanceCard, styles.performanceCardBlue]}>
              <View style={styles.performanceHeader}>
                <Text style={styles.performanceLabel}>Distância</Text>
                <View style={styles.performanceIconWrap}>
                  <Ionicons name="location-outline" size={28} color="#BFDBFE" />
                </View>
              </View>
              {stats.bestPerformance.distance ? (
                <>
                  <View style={styles.performanceValueRow}>
                    <Text style={styles.performanceValue}>{stats.bestPerformance.distance.value.toFixed(1)}</Text>
                    <Text style={styles.performanceUnit}>Km</Text>
                  </View>
                  <Text style={styles.performanceDate}>{formatPerformanceDate(stats.bestPerformance.distance.record.date)}</Text>
                </>
              ) : <Text style={styles.performanceEmpty}>Sem dados</Text>}
            </View>
          </View>

          {/* ---- Metas Semanais progress bars ---- */}
          <Text style={styles.sectionTitle}>Metas Semanais</Text>
          <View style={styles.goalsList}>
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Tempo</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, styles.fillGreen, { width: `${stats.weeklyProgress.time}%` }]} />
                <Text style={styles.progressText}>{stats.weeklyProgress.time}%</Text>
              </View>
            </View>

            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Distancia</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, styles.fillBlue, { width: `${stats.weeklyProgress.distance}%` }]} />
                <Text style={styles.progressText}>{stats.weeklyProgress.distance}%</Text>
              </View>
            </View>

            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Calorias</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, styles.fillRed, { width: `${stats.weeklyProgress.calories}%` }]} />
                <Text style={styles.progressText}>{stats.weeklyProgress.calories}%</Text>
              </View>
            </View>

            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Passos</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, styles.fillPurple, { width: `${stats.weeklyProgress.steps}%` }]} />
                <Text style={styles.progressText}>{stats.weeklyProgress.steps}%</Text>
              </View>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{profile ? 'Editar perfil' : 'Criar perfil'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formAvatarPreview}>
                <TouchableOpacity onPress={handleFormImagePick} activeOpacity={0.8}>
                  {form.pictureUri ? (
                    <Image source={{ uri: form.pictureUri }} style={styles.formAvatarImage} />
                  ) : (
                    <View style={styles.formAvatar}>
                      <Text style={styles.formAvatarText}>{buildInitials(form)}</Text>
                    </View>
                  )}
                  <View style={styles.formAvatarEditBadge}>
                    <Ionicons name="camera" size={13} color="#0F172A" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.formAvatarHint}>Toque para escolher uma foto</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={form.firstName}
                  onChangeText={(text) => updateForm('firstName', text)}
                  placeholder="Digite seu nome"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sobrenome</Text>
                <TextInput
                  style={styles.input}
                  value={form.lastName}
                  onChangeText={(text) => updateForm('lastName', text)}
                  placeholder="Digite seu sobrenome"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Idade</Text>
                <TextInput
                  style={styles.input}
                  value={form.age}
                  onChangeText={(text) => updateForm('age', text.replace(/[^\d]/g, ''))}
                  keyboardType="numeric"
                  placeholder="Digite sua idade"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sexo</Text>
                <View style={styles.sexOptions}>
                  {SEX_OPTIONS.map((option) => {
                    const isActive = form.sex === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[styles.sexOption, isActive && styles.sexOptionActive]}
                        onPress={() => updateForm('sex', option)}
                      >
                        <Text style={[styles.sexOptionText, isActive && styles.sexOptionTextActive]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Objetivo</Text>
                <TextInput
                  style={[styles.input, styles.goalInput]}
                  value={form.goal}
                  onChangeText={(text) => updateForm('goal', text)}
                  multiline
                  placeholder="Ex: Melhorar condicionamento e manter constancia"
                  placeholderTextColor="#64748B"
                />
              </View>
            </ScrollView>

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyAvatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    minWidth: 190,
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // ---- Profile card ----
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 18,
    position: 'relative',
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingRight: 34,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    marginRight: 14,
    position: 'relative',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginRight: 10,
  },
  profileName: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 3,
  },
  profileMeta: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  editBadge: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  objectiveSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginBottom: 14,
  },
  objectiveLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  objectiveText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  metricSummary: {
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricSummaryValue: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 23,
  },
  metricSummaryLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  metricSummaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#CBD5E1',
  },

  // ---- Section titles ----
  section: {
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },

  // ---- Melhor Performance grid ----
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
    rowGap: 12,
  },
  performanceCard: {
    width: '48%',
    borderRadius: 18,
    padding: 16,
    minHeight: 132,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  performanceCardPeach: {
    backgroundColor: '#C95C5C',
  },
  performanceCardLavender: {
    backgroundColor: '#624E8C',
  },
  performanceCardMint: {
    backgroundColor: '#62A77C',
  },
  performanceCardBlue: {
    backgroundColor: '#668DC4',
  },
  performanceHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  performanceLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  performanceValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 15,
  },
  performanceValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  performanceUnit: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    marginBottom: 4,
  },
  performanceDate: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  performanceEmpty: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 22,
    textAlign: 'center',
  },
  performanceIconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ---- Metas Semanais ----
  goalsList: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  goalRow: {
    marginBottom: 16,
  },
  goalLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  progressTrack: {
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 17,
  },
  fillGreen: {
    backgroundColor: '#62A77C',
  },
  fillBlue: {
    backgroundColor: '#668DC4',
  },
  fillRed: {
    backgroundColor: '#C95C5C',
  },
  fillPurple: {
    backgroundColor: '#624E8C',
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  

  // ---- Edit / create profile modal ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  formCard: {
    maxHeight: '88%',
    backgroundColor: '#0B1220',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  formAvatarPreview: {
    alignItems: 'center',
    marginBottom: 16,
  },
  formAvatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formAvatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  formAvatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formAvatarText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },
  formAvatarHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 13,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    minHeight: 46,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
  },
  goalInput: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  sexOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sexOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sexOptionActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  sexOptionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  sexOptionTextActive: {
    color: '#020617',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800',
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '900',
  },
});