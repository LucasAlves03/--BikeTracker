import React, { useEffect, useRef } from 'react';
import LottieView from 'lottie-react-native';
import { View, StyleSheet } from 'react-native';


export default function AnimatedSplash({ onFinish }) {
  const animation = useRef(null);

  useEffect(() => {
    animation.current?.play();
    
    const timer = setTimeout(() => {
      onFinish();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <LottieView
        ref={animation}
        source={require('../../assets/Animations/cycle.json')}
        autoPlay
        loop={false}
        style={styles.animation}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  animation: {
    width: 300,
    height: 300,
  },
});