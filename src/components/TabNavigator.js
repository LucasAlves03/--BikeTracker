import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import HomeScreen from './HomeScreen';
import AddExerciseScreen from './AddExerciseScreen';
import StatisticsScreen from './StatisticsScreen';
import HistoryScreen from './HistoryScreen';
import DbDebugScreen from './DbDebugScreen';
import Ionicons from '@expo/vector-icons/Ionicons';

const Tab = createBottomTabNavigator();

const HomeIcon = ({ focused }) => (
  <Ionicons name="home" size={64} style={styles.icon} color={focused ? '#3B82F6' : '#fff'} />
);

const AddIcon = ({ focused }) => (
  <Ionicons name="add-circle-sharp" size={64} style={styles.icon} color={focused ? '#3B82F6' : '#fff'} />
);

const HistoryIcon = ({ focused }) => (
  <Ionicons name="time" size={64} style={styles.icon} color={focused ? '#3B82F6' : '#fff'} />
);

const StatisticsIcon = ({ focused }) => (
  <Ionicons name="stats-chart" size={64} style={styles.icon} color={focused ? '#3B82F6' : '#fff'} />
);

const DebugIcon = ({ focused }) => (
  <Ionicons name="bug" size={64} style={styles.icon} color={focused ? '#3B82F6' : '#fff'} />
);

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
          tabBarLabel: 'Início',
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddExerciseScreen}
        options={{
          tabBarIcon: ({ focused }) => <AddIcon focused={focused} />,
          tabBarLabel: 'Adicionar',
        }}
      />
      <Tab.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{
          tabBarIcon: ({ focused }) => <StatisticsIcon focused={focused} />,
          tabBarLabel: 'Estatísticas',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => <HistoryIcon focused={focused} />,
          tabBarLabel: 'Histórico',
        }}
      />
      {__DEV__ && (
        <Tab.Screen
          name="DBDebug"
          component={DbDebugScreen}
          options={{
            tabBarIcon: ({ focused }) => <DebugIcon focused={focused} />,
            tabBarLabel: 'DB Debug',
          }}
        />
      )}
    </Tab.Navigator>
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
    fontSize: 24,
    opacity: 0.6,
  },
});
