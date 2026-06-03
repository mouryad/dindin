import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useAuth } from '@context/AuthContext';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

type AuthMode = 'signin' | 'signup';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card entrance
  const cardY = useSharedValue(30);
  const cardOp = useSharedValue(0);

  // Logo subtle float
  const logoY = useSharedValue(0);

  useEffect(() => {
    cardY.value = withSpring(0, { damping: 18 });
    cardOp.value = withTiming(1, { duration: 500 });

    logoY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOp.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoY.value }],
  }));

  function switchMode(m: AuthMode) {
    setMode(m);
    setError(null);
    cardY.value = withSpring(0, { damping: 18 }, () => {});
    cardY.value = 12;
    cardY.value = withSpring(0, { damping: 18 });
  }

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      setError('Enter your name to get started.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim());
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg.replace(/\[.*?\]/g, '').trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Organic background blobs */}
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo area */}
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <DinText style={styles.logoText}>Dindin</DinText>
            <DinText style={styles.tagline}>Nourish together</DinText>
          </Animated.View>

          {/* Auth card */}
          <Animated.View style={[styles.card, cardStyle]}>
            {/* Mode toggle */}
            <View style={styles.modeRow}>
              <ModeChip
                label="Sign in"
                active={mode === 'signin'}
                onPress={() => switchMode('signin')}
              />
              <ModeChip
                label="Create account"
                active={mode === 'signup'}
                onPress={() => switchMode('signup')}
              />
            </View>

            {/* Fields */}
            {mode === 'signup' && (
              <Field
                placeholder="Your name"
                value={displayName}
                onChangeText={setDisplayName}
                autoComplete="name"
              />
            )}
            <Field
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />

            {/* Error */}
            {error && (
              <DinText style={styles.errorText}>{error}</DinText>
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.deepGreen} size="small" />
              ) : (
                <DinText style={styles.submitLabel}>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </DinText>
              )}
            </TouchableOpacity>

            {/* Fine print */}
            <DinText variant="caption" color={Colors.textSecondary} style={styles.finePrint}>
              {mode === 'signup'
                ? 'By creating an account you agree to our terms of service.'
                : 'Track meals, share your fridge, and grow together.'}
            </DinText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.modeChip, active && styles.modeChipActive]}
      activeOpacity={0.8}
    >
      <DinText style={[styles.modeChipLabel, active && styles.modeChipLabelActive]}>
        {label}
      </DinText>
    </TouchableOpacity>
  );
}

function Field({
  placeholder, value, onChangeText, secureTextEntry = false,
  autoComplete, keyboardType, autoCapitalize,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
}) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      secureTextEntry={secureTextEntry}
      autoComplete={autoComplete}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'words'}
      autoCorrect={false}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.field, focused && styles.fieldFocused]}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.deepGreen },
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.xl,
  },

  // Background organic blobs
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#3A4D28',
  },
  blobTop: {
    width: 280,
    height: 280,
    top: -80,
    right: -60,
    opacity: 0.6,
  },
  blobBottom: {
    width: 200,
    height: 200,
    bottom: -40,
    left: -60,
    opacity: 0.45,
  },

  // Logo
  logoWrap: { alignItems: 'center', gap: 8 },
  logoText: {
    fontFamily: FontFamily.frauncesItalic,
    fontSize: 52,
    color: Colors.gold,
    lineHeight: 60,
  },
  tagline: {
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: 'rgba(184,166,120,0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },

  // Card
  card: {
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },

  // Mode toggle
  modeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full,
    padding: 4,
    gap: 4,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: Colors.deepGreen,
  },
  modeChipLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  modeChipLabelActive: {
    color: Colors.paleGoldLight,
  },

  // Fields
  field: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fieldFocused: {
    borderColor: Colors.gold,
    backgroundColor: Colors.paleGoldLight,
  },

  // Error
  errorText: {
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },

  // Submit button — gold on white card
  submitBtn: {
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 16,
    color: Colors.deepGreen,
    letterSpacing: 0.3,
  },

  finePrint: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
