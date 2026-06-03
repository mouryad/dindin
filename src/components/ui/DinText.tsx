import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { Colors, FontFamily } from '@constants/theme';

interface DinTextProps extends TextProps {
  variant?: 'heading' | 'subheading' | 'body' | 'caption' | 'label';
  color?: string;
}

export function DinText({ variant = 'body', color, style, children, ...rest }: DinTextProps) {
  return (
    <Text style={[styles[variant], color ? { color } : undefined, style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 32,
    color: Colors.deepGreen,
    lineHeight: 40,
  },
  subheading: {
    fontFamily: FontFamily.frauncesMedium,
    fontSize: 22,
    color: Colors.deepGreen,
    lineHeight: 30,
  },
  body: {
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 23,
  },
  caption: {
    fontFamily: FontFamily.sora,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  label: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
