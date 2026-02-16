import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { BikeContext } from '../context/BikeContext';
import { NotificationService } from '../utils/NotificationService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function AddExerciseScreen({ navigation }) {
  const [time, setTime] = useState('');
  const [speed, setSpeed] = useState('');
  const [calories, setCalories] = useState('');
  const [distance, setDistance] = useState('');
  const [averageStats, setAverageStats] = useState(null);
  const { triggerRefresh, triggerNotificationRefresh } = useContext(BikeContext);

  useEffect(() => {
    loadAverageStats();
    registerForPushNotifications();
  }, []);

  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const loadAverageStats = async () => {
    try {
      const savedRecords = await AsyncStorage.getItem('bikeRecords');
      if (savedRecords !== null) {
        const records = JSON.parse(savedRecords);
        if (records.length > 0) {
          const avgTime = records.reduce((sum, r) => sum + parseFloat(r.time || 0), 0) / records.length;
          const avgSpeed = records.reduce((sum, r) => sum + parseFloat(r.speed || 0), 0) / records.length;
          const avgCalories = records.reduce((sum, r) => sum + parseFloat(r.calories || 0), 0) / records.length;
          const avgDistance = records.reduce((sum, r) => sum + parseFloat(r.distance || 0), 0) / records.length;
          
          setAverageStats({
            time: Math.round(avgTime),
            speed: avgSpeed.toFixed(1),
            calories: Math.round(avgCalories),
            distance: avgDistance.toFixed(1),
          });
        }
      }
    } catch (error) {
      console.error('Error loading average stats:', error);
    }
  };

  const quickFill = () => {
    if (averageStats) {
      setTime(averageStats.time.toString());
      setSpeed(averageStats.speed.toString());
      setCalories(averageStats.calories.toString());
      setDistance(averageStats.distance.toString());
    }
  };

  const sendCongratulationsNotification = async (sessionData) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Great job!',
          body: `You completed ${sessionData.time} minutes today! Distance: ${sessionData.distance} km, Calories: ${sessionData.calories}`,
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending congratulations notification:', error);
    }
  };

  const saveRecord = async () => {
    if (!time || !speed || !calories || !distance) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const now = new Date();
    const newRecord = {
      id: Date.now().toString(),
      date: now.toISOString(),
      displayDate: now.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      displayTime: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      time,
      speed,
      calories,
      distance,
    };

    try {
      const savedRecords = await AsyncStorage.getItem('bikeRecords');
      const records = savedRecords ? JSON.parse(savedRecords) : [];
      const updatedRecords = [newRecord, ...records];

      await AsyncStorage.setItem('bikeRecords', JSON.stringify(updatedRecords));
      
      await NotificationService.addWorkoutNotification({
        time,
        distance,
        calories,
      });

      setTime('');
      setSpeed('');
      setCalories('');
      setDistance('');

      triggerRefresh();
      
      triggerNotificationRefresh();

      Alert.alert('Success', 'Record saved successfully!', [
        {
          text: 'OK',
          onPress: () => {
            sendCongratulationsNotification(newRecord);
            navigation.navigate('Home');
          },
        }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save record');
      console.error('Error saving record:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Exercise</Text>
          <Text style={styles.headerSubtitle}>Log your bike session</Text>
        </View>

        {averageStats && (
          <TouchableOpacity style={styles.quickFillButton} onPress={quickFill}>
            <Text style={styles.quickFillText}>Quick Fill (Average)</Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time (minutes)</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              keyboardType="numeric"
              placeholder="Enter time"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Speed (km/h)</Text>
            <TextInput
              style={styles.input}
              value={speed}
              onChangeText={setSpeed}
              keyboardType="numeric"
              placeholder="Enter speed"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              style={styles.input}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="Enter calories"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Distance (km)</Text>
            <TextInput
              style={styles.input}
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
              placeholder="Enter distance"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={saveRecord}>
            <Text style={styles.saveButtonText}>Save Exercise</Text>
          </TouchableOpacity>
        </View>

        {averageStats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Your Averages</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{averageStats.time}</Text>
                <Text style={styles.statLabel}>min</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{averageStats.speed}</Text>
                <Text style={styles.statLabel}>km/h</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{averageStats.calories}</Text>
                <Text style={styles.statLabel}>kcal</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{averageStats.distance}</Text>
                <Text style={styles.statLabel}>km</Text>
              </View>
            </View>
          </View>
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
  quickFillButton: {
    backgroundColor: '#10B981',
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  quickFillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inputSection: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 24,
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
});