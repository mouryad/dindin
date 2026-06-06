import { useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';

const { DindinSharedStorage } = NativeModules;

export interface PendingUrl {
  url: string;
  labeled: boolean;
}

export function usePendingSharedUrls() {
  const [pendingUrls, setPendingUrls] = useState<string[]>([]);

  const check = useCallback(async () => {
    // Only available on iOS with the Share Extension built in
    if (Platform.OS !== 'ios' || !DindinSharedStorage) return;
    try {
      const urls: string[] = await DindinSharedStorage.getPendingUrls();
      if (urls.length > 0) {
        setPendingUrls(urls);
      }
    } catch { /* native module not yet built — ignore in Expo Go */ }
  }, []);

  const clear = useCallback(async () => {
    if (!DindinSharedStorage) return;
    try {
      await DindinSharedStorage.clearPendingUrls();
      setPendingUrls([]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { check(); }, [check]);

  return { pendingUrls, clear, recheck: check };
}
