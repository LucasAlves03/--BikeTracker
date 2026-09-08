import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function AnimatedSplash({ onFinish }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 240,
        delay: 900,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });
  }, [onFinish, opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity, transform: [{ scale }] }]}
    >
      <Text style={styles.title}>BikeTracker</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    zIndex: 999,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
});
