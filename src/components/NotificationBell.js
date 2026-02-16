import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';


const { width } = Dimensions.get('window');

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem('notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        setNotifications(parsed);
        const unread = parsed.filter(n => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const updated = notifications.map(n => ({ ...n, read: true }));
      await AsyncStorage.setItem('notifications', JSON.stringify(updated));
      setNotifications(updated);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const updated = notifications.filter(n => n.id !== id);
      await AsyncStorage.setItem('notifications', JSON.stringify(updated));
      setNotifications(updated);
      const unread = updated.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAll = async () => {
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify([]));
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'goal_completed':
        return '🎯';
      case 'streak':
        return '🔥';
      case 'achievement':
        return '🏆';
      case 'workout':
        return '💪';
      default:
        return '🔔';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}min atrás`;
    } else if (diffHours < 24) {
      return `${diffHours}h atrás`;
    } else if (diffDays < 7) {
      return `${diffDays}d atrás`;
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.bellContainer}
        onPress={() => {
          setShowModal(true);
          markAllAsRead();
        }}
      >
        <View style={styles.bellIcon}>
          <Ionicons name='notifications' color={'white'} size={40} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notificações</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {notifications.length > 0 && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={clearAll}
                  >
                    <Text style={styles.actionButtonText}>Limpar Tudo</Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView 
                style={styles.notificationsList}
                showsVerticalScrollIndicator={false}
              >
                {notifications.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name='notifications-off' style={styles.emptyEmoji} color={'white'}/>
                    <Text style={styles.emptyText}>Sem notificações</Text>
                    <Text style={styles.emptySubtext}>
                      Você receberá notificações aqui
                    </Text>
                  </View>
                ) : (
                  notifications.map((notification) => (
                    <View 
                      key={notification.id} 
                      style={[
                        styles.notificationCard,
                        !notification.read && styles.unreadCard
                      ]}
                    >
                      <View style={styles.notificationContent}>
                        <Text style={styles.notificationIcon}>
                          {getNotificationIcon(notification.type)}
                        </Text>
                        <View style={styles.notificationText}>
                          <Text style={styles.notificationTitle}>
                            {notification.title}
                          </Text>
                          <Text style={styles.notificationBody}>
                            {notification.body}
                          </Text>
                          <Text style={styles.notificationTime}>
                            {formatTime(notification.timestamp)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => deleteNotification(notification.id)}
                        >
                          <Text style={styles.deleteButtonText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellContainer: {
    padding: 8,
  },
  bellIcon: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
  },
  notificationCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  unreadCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A5C',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  notificationIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#64748B',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
});