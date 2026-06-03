// Minimal sparkline chart — drawn with View segments, no SVG.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';
import type { WeightTrend } from '@hooks/useWeightLog';
import { format, parseISO } from 'date-fns';

interface WeightChartProps {
  trend: WeightTrend;
  targetKg: number | null;
  goal: string;
}

const CHART_H = 80;
const DOT_SIZE = 8;

export function WeightChart({ trend, targetKg, goal }: WeightChartProps) {
  const { logs, latestKg, changeKg, progressPct, onTrack } = trend;

  if (logs.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <DinText variant="caption" color={Colors.textMuted}>
          No weight logs yet. Log your first weight below.
        </DinText>
      </View>
    );
  }

  // Compute chart geometry
  const weights = logs.map((l) => l.weight_kg);
  const minW = Math.min(...weights, targetKg ?? Infinity) - 1;
  const maxW = Math.max(...weights, targetKg ?? -Infinity) + 1;
  const range = maxW - minW || 1;

  function yPct(w: number): number {
    return 1 - (w - minW) / range;   // 0 = top, 1 = bottom
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <DinText style={styles.currentWeight}>
            {latestKg?.toFixed(1)} kg
          </DinText>
          <DinText variant="caption" color={Colors.textSecondary}>
            Current weight
          </DinText>
        </View>
        {changeKg !== null && (
          <View style={styles.changeBadge}>
            <DinText style={[
              styles.changeText,
              { color: changeDirectionColor(changeKg, goal) },
            ]}>
              {changeKg >= 0 ? '+' : ''}{changeKg.toFixed(1)} kg
            </DinText>
            <DinText variant="caption" color={Colors.textMuted}>this month</DinText>
          </View>
        )}
        {progressPct !== null && (
          <View style={styles.progressBadge}>
            <DinText style={styles.progressPct}>{progressPct}%</DinText>
            <DinText variant="caption" color={Colors.textMuted}>to goal</DinText>
            {onTrack !== null && (
              <DinText style={styles.onTrack}>
                {onTrack ? '↑ On track' : '↓ Off track'}
              </DinText>
            )}
          </View>
        )}
      </View>

      {/* Sparkline */}
      <View style={[styles.chartArea, { height: CHART_H + DOT_SIZE }]}>
        {/* Target line */}
        {targetKg !== null && (
          <View style={[
            styles.targetLine,
            { top: yPct(targetKg) * CHART_H },
          ]}>
            <DinText style={styles.targetLineLabel}>{targetKg} kg goal</DinText>
          </View>
        )}

        {/* Data points + connecting segments */}
        {logs.map((log, i) => {
          const x = logs.length > 1 ? (i / (logs.length - 1)) * 100 : 50;
          const y = yPct(log.weight_kg) * CHART_H;

          return (
            <React.Fragment key={log.id}>
              {/* Connecting line to next point */}
              {i < logs.length - 1 && (
                <ConnectingLine
                  x1Pct={x}
                  y1={y}
                  x2Pct={logs.length > 1 ? ((i + 1) / (logs.length - 1)) * 100 : 50}
                  y2={yPct(logs[i + 1].weight_kg) * CHART_H}
                  delay={i * 60}
                />
              )}
              {/* Dot */}
              <AnimatedDot x={x} y={y} isLatest={i === logs.length - 1} delay={i * 60} />
            </React.Fragment>
          );
        })}
      </View>

      {/* Date range labels */}
      {logs.length > 1 && (
        <View style={styles.dateRow}>
          <DinText variant="caption" color={Colors.textMuted}>
            {format(parseISO(logs[0].logged_at), 'MMM d')}
          </DinText>
          <DinText variant="caption" color={Colors.textMuted}>
            {format(parseISO(logs[logs.length - 1].logged_at), 'MMM d')}
          </DinText>
        </View>
      )}
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function AnimatedDot({ x, y, isLatest, delay }: { x: number; y: number; isLatest: boolean; delay: number }) {
  const op = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 250 }));
    scale.value = withDelay(delay, withTiming(1, { duration: 300, easing: Easing.out(Easing.back(2)) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left: `${x}%` as unknown as number,
          top: y,
          backgroundColor: isLatest ? Colors.deepGreen : Colors.gold,
          width: isLatest ? DOT_SIZE + 4 : DOT_SIZE,
          height: isLatest ? DOT_SIZE + 4 : DOT_SIZE,
          borderRadius: isLatest ? (DOT_SIZE + 4) / 2 : DOT_SIZE / 2,
          marginLeft: isLatest ? -(DOT_SIZE + 4) / 2 : -DOT_SIZE / 2,
        },
        style,
      ]}
    />
  );
}

function ConnectingLine({ x1Pct, y1, x2Pct, y2, delay }: {
  x1Pct: number; y1: number; x2Pct: number; y2: number; delay: number;
}) {
  const scaleX = useSharedValue(0);

  useEffect(() => {
    scaleX.value = withDelay(delay + 120, withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }));
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: scaleX.value }] }));

  // We approximate the line as a horizontal segment at the average y
  // A true angled line would require transform: rotate, which is complex without SVG
  const avgY = (y1 + y2) / 2;
  const widthPct = Math.abs(x2Pct - x1Pct);

  return (
    <Animated.View
      style={[
        styles.segment,
        {
          left: `${Math.min(x1Pct, x2Pct)}%` as unknown as number,
          top: avgY + DOT_SIZE / 2 - 1,
          width: `${widthPct}%` as unknown as number,
        },
        style,
      ]}
    />
  );
}

function changeDirectionColor(changeKg: number, goal: string): string {
  if (goal === 'lose') return changeKg < 0 ? '#27AE60' : '#C0392B';
  if (goal === 'gain') return changeKg > 0 ? '#27AE60' : '#C0392B';
  return Math.abs(changeKg) < 1 ? '#27AE60' : Colors.gold;
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  currentWeight: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 28,
    color: Colors.deepGreen,
    lineHeight: 34,
  },
  changeBadge: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.sm,
    padding: 8,
    gap: 2,
    alignItems: 'center',
  },
  changeText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 16,
  },
  progressBadge: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.sm,
    padding: 8,
    gap: 2,
    alignItems: 'center',
    marginLeft: 'auto',
  },
  progressPct: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.deepGreen,
  },
  onTrack: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 10,
    color: '#27AE60',
  },
  chartArea: {
    position: 'relative',
    width: '100%',
    marginVertical: 4,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.gold,
    opacity: 0.6,
  },
  targetLineLabel: {
    position: 'absolute',
    right: 0,
    top: -14,
    fontFamily: FontFamily.sora,
    fontSize: 9,
    color: Colors.gold,
  },
  dot: {
    position: 'absolute',
  },
  segment: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.paleGoldMedium,
    transformOrigin: 'left center',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
