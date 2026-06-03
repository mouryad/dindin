import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { analyzeMeal, scanFridge, analyzeWaste, type CameraMode, type FridgeScanResult, type WasteScanResult } from '@services/aiVision';
import type { AiMealAnalysis } from '@db/database';

export type CaptureState = 'idle' | 'capturing' | 'analyzing' | 'done' | 'error';

interface UseCameraReturn {
  // Permissions
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: () => void;
  // Camera control
  cameraRef: React.RefObject<CameraView | null>;
  facing: 'front' | 'back';
  flash: 'off' | 'on' | 'auto';
  toggleFacing: () => void;
  toggleFlash: () => void;
  // Mode
  mode: CameraMode;
  setMode: (m: CameraMode) => void;
  // Capture
  captureState: CaptureState;
  capturedUri: string | null;
  mealAnalysis: AiMealAnalysis | null;
  fridgeResult: FridgeScanResult | null;
  wasteResult: WasteScanResult | null;
  errorMessage: string | null;
  takePicture: () => Promise<void>;
  pickFromGallery: () => Promise<void>;
  retake: () => void;
}

export function useCamera(): UseCameraReturn {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [mode, setMode] = useState<CameraMode>('meal');
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [mealAnalysis, setMealAnalysis] = useState<AiMealAnalysis | null>(null);
  const [fridgeResult, setFridgeResult] = useState<FridgeScanResult | null>(null);
  const [wasteResult, setWasteResult] = useState<WasteScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleFacing() {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }

  function toggleFlash() {
    setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'));
  }

  const runAnalysis = useCallback(async (uri: string) => {
    setCaptureState('analyzing');
    setErrorMessage(null);
    try {
      if (mode === 'meal') {
        const result = await analyzeMeal(uri);
        setMealAnalysis(result);
      } else if (mode === 'fridge') {
        const result = await scanFridge(uri);
        setFridgeResult(result);
      } else {
        const result = await analyzeWaste(uri);
        setWasteResult(result);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCaptureState('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setErrorMessage(msg);
      setCaptureState('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [mode]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || captureState === 'capturing' || captureState === 'analyzing') return;
    setCaptureState('capturing');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.82,
        base64: false,
        skipProcessing: false,
      });
      const uri = photo?.uri;
      if (!uri) throw new Error('Camera returned no image');
      setCapturedUri(uri);
      await runAnalysis(uri);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Capture failed';
      setErrorMessage(msg);
      setCaptureState('error');
    }
  }, [cameraRef, captureState, runAnalysis]);

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setCapturedUri(uri);
    await runAnalysis(uri);
  }, [runAnalysis]);

  function retake() {
    setCapturedUri(null);
    setMealAnalysis(null);
    setFridgeResult(null);
    setWasteResult(null);
    setErrorMessage(null);
    setCaptureState('idle');
  }

  return {
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
  };
}
