import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
} from '@expo-google-fonts/sora';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { useCouple } from './src/hooks/useCouple';
import { requestNotificationPermissions } from './src/services/notifications';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DailyQuoteScreen } from './src/screens/DailyQuoteScreen';
import { CoupleLinkScreen } from './src/screens/CoupleLinkScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { DinText } from './src/components/ui/DinText';
import { Colors, FontFamily } from './src/constants/theme';

// Keep the native splash screen visible until fonts are ready
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 600 });

type Tab = 'home' | 'fridge' | 'progress' | 'calendar';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'home',     label: 'Today',    icon: '🏠' },
  { id: 'fridge',   label: 'Fridge',   icon: '🧊' },
  { id: 'progress', label: 'Progress', icon: '📊' },
  { id: 'calendar', label: 'Our Story', icon: '📅' },
];

function TabBar({ active, onPress }: { active: Tab; onPress: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          onPress={() => onPress(tab.id)}
          style={styles.tabItem}
          activeOpacity={0.7}
        >
          <DinText style={[styles.tabIcon, active === tab.id && styles.tabIconActive]}>
            {tab.icon}
          </DinText>
          <DinText style={[styles.tabLabel, active === tab.id && styles.tabLabelActive]}>
            {tab.label}
          </DinText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RootNavigator() {
  const { profile, user, loading } = useAuth();
  const { couple, loading: coupleLoading } = useCouple();

  const [onboardingDone, setOnboardingDone] = useState(false);
  const [quoteDismissed, setQuoteDismissed] = useState(false);
  const [coupleSkipped,  setCoupleSkipped]  = useState(false);
  const [activeTab, setActiveTab]           = useState<Tab>('home');

  // Request notification permissions once logged in
  useEffect(() => {
    if (user) requestNotificationPermissions().catch(() => {});
  }, [user]);

  if (loading || coupleLoading) {
    return (
      <View style={styles.authLoading}>
        <ActivityIndicator color={Colors.deepGreen} size="large" />
      </View>
    );
  }

  // 0. Auth gate — must be logged in before anything else
  if (!user) {
    return <AuthScreen />;
  }

  // 1. Onboarding gate
  const needsOnboarding = !profile?.onboarding_complete && !onboardingDone;
  if (needsOnboarding) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  }

  // 2. Daily quote splash (once per session)
  if (!quoteDismissed) {
    return <DailyQuoteScreen onDismiss={() => setQuoteDismissed(true)} />;
  }

  // 3. Couple linking (skippable)
  const needsCoupleLink = !couple && !coupleSkipped;
  if (needsCoupleLink) {
    return (
      <CoupleLinkScreen
        onLinked={() => setCoupleSkipped(true)}
      />
    );
  }

  // 4. Main app
  const coupleId = couple?.id ?? null;

  return (
    <View style={styles.appRoot}>
      <View style={styles.screenArea}>
        {activeTab === 'home'     && <HomeScreen />}
        {activeTab === 'fridge'   && coupleId && user && (
          <InventoryScreen coupleId={coupleId} userId={user.id} />
        )}
        {activeTab === 'fridge'   && !coupleId && (
          <CoupleLinkScreen onLinked={() => setActiveTab('fridge')} />
        )}
        {activeTab === 'progress' && <ProgressScreen />}
        {activeTab === 'calendar' && <CalendarScreen />}
      </View>
      <TabBar active={activeTab} onPress={setActiveTab} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_700Bold,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
  });

  // Hide the native splash as soon as fonts resolve (success or error)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Splash is still visible — render nothing behind it
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  authLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paleGoldLight,
  },
  appRoot: { flex: 1 },
  screenArea: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.paleGoldLight,
    borderTopWidth: 1,
    borderTopColor: Colors.paleGoldMedium,
    paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon:        { fontSize: 20, opacity: 0.4 },
  tabIconActive:  { opacity: 1 },
  tabLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontFamily: FontFamily.soraSemibold,
    color: Colors.deepGreen,
  },
});
