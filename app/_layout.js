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
          {splashVisible ? (
            <AnimatedSplash onFinish={() => setSplashVisible(false)} />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#17191B' },
                animation: 'fade',
              }}
            />
          )}
        </BikeProvider>
      </View>
    );
  }

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#17191B',
    },
  });
