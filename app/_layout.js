import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { BikeProvider } from '../src/context/BikeContext';
import AnimatedSplash from '../src/components/AnimatedSplash';

export default function Layout() {
  const [splashVisible, setSplashVisible] = useState(true);

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
