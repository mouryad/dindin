import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, Spacing } from '@constants/theme';
import { getDailyQuote } from '@services/quotes';

interface DailyQuoteScreenProps {
  onDismiss: () => void;
}

export function DailyQuoteScreen({ onDismiss }: DailyQuoteScreenProps) {
  const quote = getDailyQuote();

  // Animation values
  const bgOp        = useSharedValue(0);
  const quoteOp     = useSharedValue(0);
  const quoteY      = useSharedValue(24);
  const authorOp    = useSharedValue(0);
  const btnOp       = useSharedValue(0);
  const dotScale    = useSharedValue(0);
  const logoOp      = useSharedValue(0);

  useEffect(() => {
    bgOp.value     = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    logoOp.value   = withDelay(300, withTiming(1, { duration: 500 }));
    dotScale.value = withDelay(400, withSpring(1, { damping: 10, stiffness: 120 }));
    quoteOp.value  = withDelay(700, withTiming(1, { duration: 700 }));
    quoteY.value   = withDelay(700, withSpring(0, { damping: 18 }));
    authorOp.value = withDelay(1200, withTiming(1, { duration: 500 }));
    btnOp.value    = withDelay(1800, withTiming(1, { duration: 500 }));
  }, []);

  const bgStyle     = useAnimatedStyle(() => ({ opacity: bgOp.value }));
  const logoStyle   = useAnimatedStyle(() => ({ opacity: logoOp.value }));
  const dotStyle    = useAnimatedStyle(() => ({ transform: [{ scale: dotScale.value }] }));
  const quoteStyle  = useAnimatedStyle(() => ({ opacity: quoteOp.value, transform: [{ translateY: quoteY.value }] }));
  const authorStyle = useAnimatedStyle(() => ({ opacity: authorOp.value }));
  const btnStyle    = useAnimatedStyle(() => ({ opacity: btnOp.value }));

  return (
    <Animated.View style={[styles.root, bgStyle]}>
      {/* Organic blobs — soft background texture */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <DinText style={styles.logoText}>Dindin</DinText>
      </Animated.View>

      {/* Decorative dot */}
      <Animated.View style={[styles.dot, dotStyle]} />

      {/* Quote */}
      <View style={styles.quoteWrap}>
        <Animated.View style={quoteStyle}>
          <DinText style={styles.openQuote}>"</DinText>
          <DinText style={styles.quoteText}>{quote.text}</DinText>
          <DinText style={styles.closeQuote}>"</DinText>
        </Animated.View>

        <Animated.View style={[styles.authorWrap, authorStyle]}>
          <View style={styles.authorLine} />
          <DinText style={styles.authorText}>— {quote.author}</DinText>
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View style={[styles.btnWrap, btnStyle]}>
        <TouchableOpacity onPress={onDismiss} style={styles.btn} activeOpacity={0.82}>
          <DinText style={styles.btnLabel}>Begin today</DinText>
        </TouchableOpacity>
        <DinText style={styles.dateHint}>
          {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        </DinText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.deepGreen,
    paddingHorizontal: Spacing.xl,
    paddingTop: 80,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Organic blobs for visual warmth
  blobTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(184,166,120,0.12)',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(184,166,120,0.08)',
  },
  logoWrap: {
    alignSelf: 'center',
  },
  logoText: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 28,
    color: Colors.gold,
    letterSpacing: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gold,
    opacity: 0.7,
  },
  quoteWrap: {
    gap: Spacing.xl,
    flex: 1,
    justifyContent: 'center',
  },
  openQuote: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 72,
    color: Colors.gold,
    opacity: 0.35,
    lineHeight: 60,
    marginBottom: -8,
  },
  quoteText: {
    fontFamily: FontFamily.frauncesItalic ?? FontFamily.fraunces,
    fontSize: 26,
    color: Colors.paleGoldLight,
    lineHeight: 38,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  closeQuote: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 72,
    color: Colors.gold,
    opacity: 0.35,
    lineHeight: 60,
    textAlign: 'right',
    marginTop: -8,
  },
  authorWrap: {
    alignItems: 'center',
    gap: 10,
  },
  authorLine: {
    width: 32,
    height: 1.5,
    backgroundColor: Colors.gold,
    opacity: 0.5,
  },
  authorText: {
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: Colors.gold,
    opacity: 0.8,
    letterSpacing: 0.5,
  },
  btnWrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  btn: {
    backgroundColor: Colors.gold,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
  },
  btnLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 17,
    color: Colors.deepGreen,
    letterSpacing: 0.3,
  },
  dateHint: {
    fontFamily: FontFamily.sora,
    fontSize: 12,
    color: 'rgba(244,241,232,0.4)',
    letterSpacing: 0.5,
  },
});
