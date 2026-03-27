import React, { useEffect, useRef, useState } from 'react';
import LottieView from 'lottie-react-native';
import { StyleSheet, Animated } from 'react-native';

export default function AnimatedSplash({ onFinish }) {
  const CYCLE_DURATION_MS = 1500;
  const RUNNING_MAX_DURATION_MS = 2200;

  const finishGuard = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const [showRunning, setShowRunning] = useState(false);

  useEffect(() => {
    const switchTimer = setTimeout(() => {
      setShowRunning(true);
    }, CYCLE_DURATION_MS);

    return () => {
      clearTimeout(switchTimer);
    };
  }, []);

  const handleExit = () => {
    if (finishGuard.current) return;
    finishGuard.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });
  };

  useEffect(() => {
    if (!showRunning) return;

    const earlyExitTimer = setTimeout(() => {
      handleExit();
    }, RUNNING_MAX_DURATION_MS);

    return () => {
      clearTimeout(earlyExitTimer);
    };
  }, [showRunning]);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents='none'>
      {!showRunning && (
        <LottieView
          source={require('../../assets/Animations/cycle.json')}
          autoPlay
          loop={false}
          style={styles.animation}
          resizeMode='cover'
        />
      )}
      {showRunning && (
        <LottieView
          source={require('../../assets/Animations/running.json')}
          autoPlay
          loop={false}
          onAnimationFinish={handleExit}
          style={styles.animation}
          resizeMode='cover'
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 999,
  },
  animation: {
    width: 300,
    height: 300,
  },
});
