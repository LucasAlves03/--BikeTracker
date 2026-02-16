import { Stack } from 'expo-router';
import { BikeProvider } from '../src/context/BikeContext';
import { useState } from 'react';
import AnimatedSplash from '../src/components/AnimatedSplash';
export default function Layout() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return <AnimatedSplash onFinish={() => setSplashDone(true)} />;
  }

  return (
    <BikeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F172A' },
          animation: 'fade',
        }}
      />
    </BikeProvider>
  );
}
