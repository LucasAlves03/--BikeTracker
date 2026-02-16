import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from './HomeScreen';
import AddExerciseScreen from './AddExerciseScreen';
import HistoryScreen from './HistoryScreen';
import Ionicons from '@expo/vector-icons/Ionicons';


const Tab = createBottomTabNavigator();

const HomeIcon = ({ focused }) => (
    <Ionicons name='home' size={64} style={styles.icon} color={focused ? "#3B82F6" : "#fff"}/>
);

const AddIcon = ({ focused }) => (
     <Ionicons name='add-circle-sharp' size={64} style={styles.icon} color={focused ? "#3B82F6" : "#fff"}/>
);

const HistoryIcon = ({ focused }) => (
    <Ionicons name='stats-chart' size={64} style={styles.icon} color={focused ? "#3B82F6" : "#fff"} />
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
          tabBarIcon: ({ focused, color, size }) => <HomeIcon focused={focused} />,
    tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddExerciseScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => <AddIcon focused={focused} />,
      tabBarLabel: 'Add Exercise',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => <HistoryIcon focused={focused} />,
    tabBarLabel: 'Statistics',
        }}
      />
   
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
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});