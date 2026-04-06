import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { BikeProvider } from '../src/context/BikeContext';
import AnimatedSplash from '../src/components/AnimatedSplash';
import { bootstrapExercisesDb } from '../src/db/exercisesDb';

export default function Layout() {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const initLocalDb = async () => {
      try {
        const result = await bootstrapExercisesDb();
        if (__DEV__ && result) {
          console.log('DB bootstrap result:', result);
        }
      } catch (error) {
        console.error('Failed to bootstrap local exercises DB:', error);
      }
    };

    initLocalDb();
  }, []);

  return (
    <View style={styles.root}>
      <BikeProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0F172A' },
            animation: 'fade',
          }}
        />
      </BikeProvider>

      {splashVisible && (
        <AnimatedSplash onFinish={() => setSplashVisible(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
