import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
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
  retryCount: number;
  takePicture: () => Promise<void>;
  pickFromGallery: () => Promise<void>;
  retake: () => void;
}

export function useCamera(initialMode: CameraMode = 'meal'): UseCameraReturn {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [mode, setMode] = useState<CameraMode>(initialMode);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [mealAnalysis, setMealAnalysis] = useState<AiMealAnalysis | null>(null);
  const [fridgeResult, setFridgeResult] = useState<FridgeScanResult | null>(null);
  const [wasteResult, setWasteResult] = useState<WasteScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
        // Extra guard: if no dish name at all, reject regardless of other values
        if (!result.dish_name?.trim()) {
          throw new Error('NOT_RECOGNIZED');
        }
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
      const raw = err instanceof Error ? err.message : 'Analysis failed';
      let msg = raw;
      if (raw === 'NOT_FOOD') {
        const quips = [
          "My food radar drew a blank 📡 That's not a meal — show me what's on your plate!",
          "I see no food here! 🙈 Aim at your dish and snap again.",
          "That's definitely not going on your calorie log 😄 Try pointing at your meal!",
          "Hmm, my plate sensor disagrees 🤔 Is that food? I don't think so — reshoot!",
        ];
        msg = quips[Math.floor(Math.random() * quips.length)];
      } else if (raw === 'NOT_RECOGNIZED') {
        const quips = [
          "Squinting really hard and still can't tell 🧐 Get a bit closer and try again!",
          "My AI eyes are struggling here 👀 Better light and a closer shot should do it!",
          "Blurry food = blurry calories 😅 Hold steady and reshoot!",
          "Too dark for my taste 🌑 A touch more light and snap again!",
        ];
        msg = quips[Math.floor(Math.random() * quips.length)];
      }
      setErrorMessage(msg);
      setRetryCount((n) => n + 1);
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
    // retryCount intentionally NOT reset so flash tip accumulates across retakes
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
    retryCount,
    takePicture,
    pickFromGallery,
    retake,
  };
}
