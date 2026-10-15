import AsyncStorage from '@react-native-async-storage/async-storage';

let notificationUpdateCallback = null;

const WORKOUT_NOTIFICATION_TITLES = [
  'Treino feito',
  'Na conta',
  'Ritmo em dia',
  'Sequência rolando',
  'Mais um dia',
  'Virou rotina',
  'Sem alarde, só treino',
];

export const setNotificationUpdateCallback = (callback) => {
  notificationUpdateCallback = callback;
};

export const NotificationService = {
  getWorkoutNotificationTitle(streakDays, workoutCount) {
    if (streakDays === 7) return WORKOUT_NOTIFICATION_TITLES[3];
    if (streakDays === 30) return WORKOUT_NOTIFICATION_TITLES[5];

    return WORKOUT_NOTIFICATION_TITLES[(workoutCount - 1) % WORKOUT_NOTIFICATION_TITLES.length];
  },

  async addNotification(type, title, body) {
    try {
      const notification = {
        id: Date.now().toString(),
        type, 
        title,
        body,
        timestamp: Date.now(),
        read: false,
      };

      const saved = await AsyncStorage.getItem('notifications');
      const notifications = saved ? JSON.parse(saved) : [];
      
      notifications.unshift(notification);
      
      const limited = notifications.slice(0, 50);
      
      await AsyncStorage.setItem('notifications', JSON.stringify(limited));
      
      if (notificationUpdateCallback) {
        notificationUpdateCallback();
      }
      
      return notification;
    } catch (error) {
      console.error('Error adding notification:', error);
      return null;
    }
  },

  async addWorkoutNotification(stats, title) {
    return await this.addNotification(
      'workout',
      title,
      `${stats.time} min • ${stats.distance} km • ${stats.calories} kcal`
    );
  },  async addGoalCompletedNotification() {
    return await this.addNotification(
      'goal_completed',
      'Metas Semanais Completas!',
      'Parabéns! Você atingiu todas as suas metas desta semana!'
    );
  },

  async addGoalMissedNotification(type) {
    const label = type === 'walk' ? 'caminhada' : 'bicicleta ergometrica';
    return await this.addNotification(
      'goal_missed',
      'Semana Encerrada',
      `As metas semanais de ${label} nao foram concluidas. Ajuste suas metas e tente novamente.`
    );
  },

  async addStreakNotification(days) {
    return await this.addNotification(
      'streak',
      `Sequência de ${days} Dias!`,
      `Você está em chamas! ${days} dias consecutivos de treino.`
    );
  },

  async addAchievementNotification(achievement) {
    return await this.addNotification(
      'achievement',
      'Nova Conquista Desbloqueada!',
      achievement
    );
  },

  async addPersonalRecordNotification(recordType, value) {
    const messages = {
      distance: `Novo recorde de distância: ${value} km!`,
      time: `Novo recorde de tempo: ${value} minutos!`,
      calories: `Novo recorde de calorias: ${value} kcal!`,
      speed: `Novo recorde de velocidade: ${value} km/h!`,
    };

    return await this.addNotification(
      'achievement',
      'Novo Recorde Pessoal!',
      messages[recordType] || `Novo recorde: ${value}`
    );
  },
};
