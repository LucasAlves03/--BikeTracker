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
  const [activityType, setActivityType] = useState('indoor');
  const [time, setTime] = useState('');
  const [speed, setSpeed] = useState('');
  const [calories, setCalories] = useState('');
  const [distance, setDistance] = useState('');
  const [steps, setSteps] = useState('');
  const [headerHeight, setHeaderHeight] = useState(0);
  const { triggerRefresh, triggerNotificationRefresh } = useContext(BikeContext);

  useEffect(() => {
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

  const sendCongratulationsNotification = async (sessionData) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Mandou bem!',
          body: `Você completou ${sessionData.time} minutos hoje! Distância: ${sessionData.distance} km, Calorias: ${sessionData.calories}`,
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending congratulations notification:', error);
    }
  };

  const saveRecord = async () => {
    if (!time || !speed || !calories || !distance || (activityType === 'walk' && !steps)) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const now = new Date();
    const newRecord = {
      id: Date.now().toString(),
      activityType,
      date: now.toISOString(),
      displayDate: now.toLocaleDateString('pt-BR', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      displayTime: now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      time,
      speed,
      calories,
      distance,
      steps: activityType === 'walk' ? steps : undefined,
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
      setDistance('');
      setCalories('');
      setSteps('');

      triggerRefresh();
      
      triggerNotificationRefresh();

      Alert.alert('Sucesso', 'Exercício salvo com sucesso!', [
        {
          text: 'OK',
          onPress: () => {
            sendCongratulationsNotification(newRecord);
            navigation.navigate('Home');
          },
        }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar exercício');
      console.error('Error saving record:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View
        style={styles.header}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <Text style={styles.headerTitle}>Adicionar Exercício</Text>
        <Text style={styles.headerSubtitle}>
          {activityType === 'walk' ? 'Registre sua caminhada' : 'Registre sua sessão de bic. ergométrica'}
        </Text>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.trackerToggle}>
          {['indoor', 'walk'].map((type) => {
            const isActive = activityType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.trackerTab, isActive && styles.trackerTabActive]}
                onPress={() => setActivityType(type)}
              >
                <Text style={[styles.trackerTabText, isActive && styles.trackerTabTextActive]}>
                  {type === 'walk' ? 'Caminhada' : 'Bic. Ergométrica'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tempo (minutos)</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              keyboardType="numeric"
              placeholder="Digite o tempo"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Velocidade (km/h)</Text>
            <TextInput
              style={styles.input}
              value={speed}
              onChangeText={setSpeed}
              keyboardType="numeric"
              placeholder="Digite a velocidade"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Distância (km)</Text>
            <TextInput
              style={styles.input}
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
              placeholder="Digite a distância"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Calorias</Text>
            <TextInput
              style={styles.input}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="Digite as calorias"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          

          {activityType === 'walk' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Passos</Text>
              <TextInput
                style={styles.input}
                value={steps}
                onChangeText={setSteps}
                keyboardType="numeric"
                placeholder="Digite os passos"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={saveRecord}>
            <Text style={styles.saveButtonText}>Salvar Exercício</Text>
          </TouchableOpacity>
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
  trackerToggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: 'black',
    borderRadius: 15,
    padding: 8,
    
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
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  trackerTabTextActive: {
    color: 'black',
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
    borderRadius: 5,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#040405',
    borderRadius: 5,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
