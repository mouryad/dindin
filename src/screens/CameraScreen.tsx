import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  SafeAreaView,
} from 'react-native';
import { CameraView } from 'expo-camera';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { useCamera } from '@hooks/useCamera';
import { CameraModeSwitcher } from '@components/camera/CameraModeSwitcher';
import { ShutterButton } from '@components/camera/ShutterButton';
import { AnalysisLoadingOverlay } from '@components/camera/AnalysisLoadingOverlay';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { AiMealAnalysis } from '@db/database';
import type { FridgeScanResult, WasteScanResult } from '@services/aiVision';

interface CameraScreenProps {
  onMealCaptured: (uri: string, analysis: AiMealAnalysis) => void;
  onFridgeCaptured: (uri: string, result: FridgeScanResult) => void;
  onWasteCaptured?: (uri: string, result: WasteScanResult) => void;
  onClose: () => void;
}

export function CameraScreen({ onMealCaptured, onFridgeCaptured, onWasteCaptured, onClose }: CameraScreenProps) {
  const {
    permission,
    requestPermission,
    cameraRef,
    facing,
    flash,
    toggleFacing,
    toggleFlash,
    mode,
    setMode,
    captureState,
    capturedUri,
    mealAnalysis,
    fridgeResult,
    wasteResult,
    errorMessage,
    takePicture,
    pickFromGallery,
    retake,
  } = useCamera();

  // Once analysis is done, hand off to parent
  React.useEffect(() => {
    if (captureState === 'done' && capturedUri) {
      if (mode === 'meal' && mealAnalysis) {
        onMealCaptured(capturedUri, mealAnalysis);
      } else if (mode === 'fridge' && fridgeResult) {
        onFridgeCaptured(capturedUri, fridgeResult);
      } else if (mode === 'waste' && wasteResult) {
        onWasteCaptured?.(capturedUri, wasteResult);
      }
    }
  }, [captureState, capturedUri, mealAnalysis, fridgeResult, wasteResult, mode]);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <DinText variant="heading" style={styles.permissionTitle}>
          Camera access needed
        </DinText>
        <DinText variant="body" color={Colors.textSecondary} style={styles.permissionBody}>
          Dindin uses your camera to identify meals and scan your fridge.
          Your photos are only sent to AI for analysis and never stored without your consent.
        </DinText>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <DinText style={styles.permissionBtnLabel}>Allow Camera</DinText>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
          <DinText variant="caption" color={Colors.textMuted}>Not now</DinText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isAnalyzing = captureState === 'analyzing' || captureState === 'capturing';
  const showPreview = !!capturedUri && captureState !== 'done';

  return (
    <View style={styles.root}>
      {showPreview ? (
        // Preview mode — show captured image while analyzing
        <View style={styles.previewWrap}>
          <Image source={{ uri: capturedUri! }} style={styles.previewImage} resizeMode="cover" />
          <AnalysisLoadingOverlay mode={mode} visible={isAnalyzing} />

          {/* Error state */}
          {captureState === 'error' && (
            <View style={styles.errorOverlay}>
              <DinText style={styles.errorText}>{errorMessage ?? 'Analysis failed'}</DinText>
              <TouchableOpacity onPress={retake} style={styles.retakeBtn}>
                <DinText style={styles.retakeBtnLabel}>Try again</DinText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        // Live camera view
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flash}
        >
          {/* Top controls */}
          <SafeAreaView style={styles.topControls}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <DinText style={styles.iconBtnText}>✕</DinText>
            </TouchableOpacity>
            <CameraModeSwitcher mode={mode} onChange={setMode} />
            <TouchableOpacity onPress={toggleFlash} style={styles.iconBtn}>
              <DinText style={styles.iconBtnText}>
                {flash === 'off' ? '⚡' : flash === 'on' ? '⚡' : '⚡A'}
              </DinText>
              {flash === 'off' && (
                <View style={styles.flashOffLine} />
              )}
            </TouchableOpacity>
          </SafeAreaView>

          {/* Mode hint */}
          <View style={styles.hintWrap}>
            <View style={styles.hintPill}>
              <DinText style={styles.hintText}>
                {mode === 'meal'
                  ? 'Photograph your meal — plate, bowl, or dish'
                  : mode === 'fridge'
                  ? 'Open your fridge and photograph the contents'
                  : 'Photograph uneaten food or leftovers to track waste'}
              </DinText>
            </View>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            {/* Gallery picker */}
            <TouchableOpacity onPress={pickFromGallery} style={styles.iconBtn}>
              <DinText style={styles.iconBtnText}>🖼</DinText>
            </TouchableOpacity>

            {/* Shutter */}
            <ShutterButton captureState={captureState} onPress={takePicture} />

            {/* Flip camera */}
            <TouchableOpacity onPress={toggleFacing} style={styles.iconBtn}>
              <DinText style={styles.iconBtnText}>🔄</DinText>
            </TouchableOpacity>
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: Colors.paleGoldLight,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionBody: {
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionBtn: {
    backgroundColor: Colors.deepGreen,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  permissionBtnLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 16,
    color: Colors.paleGoldLight,
  },
  // Top controls
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? Spacing.xl : Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBtnText: {
    fontSize: 18,
    color: '#fff',
  },
  flashOffLine: {
    position: 'absolute',
    width: 2,
    height: 24,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  // Mode hint
  hintWrap: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: -60,
    pointerEvents: 'none',
  },
  hintPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    maxWidth: '80%',
  },
  hintText: {
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: 'rgba(244,241,232,0.9)',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    paddingTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // Preview
  previewWrap: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  errorOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(45,58,31,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    zIndex: 20,
  },
  errorText: {
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.paleGoldLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  retakeBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  retakeBtnLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: Colors.deepGreen,
  },
});
