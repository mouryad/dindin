import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useCouple } from '@hooks/useCouple';
import { useAuth } from '@context/AuthContext';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

interface CoupleLinkScreenProps {
  onLinked: () => void;
}

export function CoupleLinkScreen({ onLinked }: CoupleLinkScreenProps) {
  const { profile } = useAuth();
  const { couple, loading, joining, error, createInvite, joinByCode } = useCouple();

  const [inviteCode, setInviteCode]   = useState<string | null>(null);
  const [joinCode, setJoinCode]       = useState('');
  const [creatingCode, setCreating]   = useState(false);
  const [view, setView]               = useState<'choose' | 'invite' | 'join'>('choose');

  // Navigate away if already linked
  useEffect(() => {
    if (couple?.status === 'active') onLinked();
  }, [couple]);

  // Entrance animation
  const cardScale = useSharedValue(0.92);
  const cardOp    = useSharedValue(0);
  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 16 });
    cardOp.value    = withTiming(1, { duration: 350 });
  }, [view]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOp.value,
  }));

  async function handleCreateInvite() {
    setCreating(true);
    try {
      const code = await createInvite();
      setInviteCode(code);
      setView('invite');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create invite');
    } finally {
      setCreating(false);
    }
  }

  async function handleShare() {
    if (!inviteCode) return;
    await Share.share({
      message: `Hey! Join me on Dindin 🥗\n\nUse my invite code to link our accounts:\n\n${inviteCode.toUpperCase()}\n\nDownload Dindin and enter this code in Settings → Link Partner.`,
      title: 'Join me on Dindin',
    });
  }

  async function handleJoin() {
    if (joinCode.trim().length < 6) {
      Alert.alert('Invalid code', 'Enter the full 8-character invite code.');
      return;
    }
    await joinByCode(joinCode);
    if (!error) onLinked();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.deepGreen} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        {/* Hero */}
        <View style={styles.hero}>
          <DinText style={styles.heroEmoji}>💚</DinText>
          <DinText variant="heading" style={styles.heroTitle}>Cook together</DinText>
          <DinText variant="body" color={Colors.textSecondary} style={styles.heroSub}>
            Link your account with your partner's to share a fridge, sync meals, and track goals together.
          </DinText>
        </View>

        {/* ── CHOOSE view ────────────────────────────────────── */}
        {view === 'choose' && (
          <Animated.View style={[styles.card, cardStyle]}>
            <OptionButton
              icon="📨"
              title="Invite my partner"
              desc="Generate a code for them to scan"
              onPress={handleCreateInvite}
              loading={creatingCode}
            />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <DinText variant="caption" color={Colors.textMuted}>or</DinText>
              <View style={styles.dividerLine} />
            </View>
            <OptionButton
              icon="🔑"
              title="Enter an invite code"
              desc="Partner already sent you one?"
              onPress={() => { setView('join'); cardScale.value = 0.92; cardOp.value = 0; }}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <DinText variant="caption" color={Colors.textMuted}>or</DinText>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={onLinked} style={styles.soloBtn} activeOpacity={0.7}>
              <DinText variant="caption" color={Colors.textSecondary} style={styles.soloBtnText}>
                Continue solo for now
              </DinText>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── INVITE view ─────────────────────────────────────── */}
        {view === 'invite' && inviteCode && (
          <Animated.View style={[styles.card, cardStyle]}>
            <DinText variant="label" style={{ textAlign: 'center' }}>
              Your invite code
            </DinText>

            {/* Animated code display */}
            <CodeDisplay code={inviteCode.toUpperCase()} />

            <DinText variant="caption" color={Colors.textSecondary} style={styles.codeHint}>
              Share this with your partner. The code expires once used.
            </DinText>

            <DinButton label="Share code" onPress={handleShare} />

            <TouchableOpacity onPress={() => setView('choose')} style={styles.backLink}>
              <DinText variant="caption" color={Colors.textMuted}>← Back</DinText>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── JOIN view ──────────────────────────────────────── */}
        {view === 'join' && (
          <Animated.View style={[styles.card, cardStyle]}>
            <DinText variant="subheading" style={{ textAlign: 'center' }}>
              Enter invite code
            </DinText>
            <DinText variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
              Ask your partner for their 8-character code
            </DinText>

            <TextInput
              value={joinCode}
              onChangeText={(v) => setJoinCode(v.toUpperCase())}
              placeholder="XXXXXXXX"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              style={styles.codeInput}
            />

            {error && (
              <DinText variant="caption" color="#C0392B" style={{ textAlign: 'center' }}>
                {error}
              </DinText>
            )}

            <DinButton
              label="Link accounts"
              onPress={handleJoin}
              loading={joining}
              disabled={joinCode.trim().length < 6 || joining}
            />

            <TouchableOpacity onPress={() => setView('choose')} style={styles.backLink}>
              <DinText variant="caption" color={Colors.textMuted}>← Back</DinText>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function OptionButton({
  icon, title, desc, onPress, loading = false,
}: {
  icon: string; title: string; desc: string; onPress: () => void; loading?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.optionBtn} activeOpacity={0.82}>
      <DinText style={styles.optionIcon}>{icon}</DinText>
      <View style={{ flex: 1 }}>
        <DinText style={styles.optionTitle}>{title}</DinText>
        <DinText variant="caption" color={Colors.textSecondary}>{desc}</DinText>
      </View>
      {loading
        ? <ActivityIndicator color={Colors.deepGreen} size="small" />
        : <DinText style={styles.optionArrow}>›</DinText>
      }
    </TouchableOpacity>
  );
}

function CodeDisplay({ code }: { code: string }) {
  // Pulse the whole code block
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View style={[styles.codeBox, style]}>
      {code.split('').map((char, i) => (
        <View key={i} style={styles.codeLetter}>
          <DinText style={styles.codeChar}>{char}</DinText>
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroEmoji: { fontSize: 52 },
  heroTitle: { textAlign: 'center', fontSize: 30 },
  heroSub: { textAlign: 'center', lineHeight: 24 },

  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },

  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  optionIcon: { fontSize: 26 },
  optionTitle: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: Colors.deepGreen,
  },
  optionArrow: {
    fontSize: 22,
    color: Colors.textMuted,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.paleGoldLight,
  },

  codeBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  codeLetter: {
    width: 36,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 22,
    color: Colors.gold,
    lineHeight: 28,
  },
  codeHint: { textAlign: 'center' },

  codeInput: {
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    fontFamily: FontFamily.frauncesBold,
    fontSize: 28,
    color: Colors.deepGreen,
    textAlign: 'center',
    letterSpacing: 6,
    borderWidth: 2,
    borderColor: Colors.gold,
  },

  backLink: {
    alignSelf: 'center',
  },
  soloBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  soloBtnText: {
    textDecorationLine: 'underline',
  },
});
