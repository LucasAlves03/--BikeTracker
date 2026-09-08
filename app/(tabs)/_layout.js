import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const TabIcon = ({ name, focused }) => (
  <Ionicons name={name} size={24} style={styles.icon} color={focused ? '#3B82F6' : '#fff'} />
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          tabBarLabel: 'Início',
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="add-circle-sharp" focused={focused} />,
          tabBarLabel: 'Adicionar',
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="stats-chart" focused={focused} />,
          tabBarLabel: 'Estatísticas',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="time" focused={focused} />,
          tabBarLabel: 'Histórico',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person-circle" focused={focused} />,
          tabBarLabel: 'Perfil',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    height: 95,
    paddingBottom: 8,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  icon: {
    opacity: 0.6,
  },
});
