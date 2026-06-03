// ─── Wearable Integration Placeholder ────────────────────────────────────────
//
// Architecture scaffold for Apple Health (react-native-health) and
// Android Health Connect (react-native-health-connect).
//
// To activate on iOS:
//   npm install react-native-health
//   Add NSHealthShareUsageDescription + NSHealthUpdateUsageDescription to Info.plist
//   Call WearableService.initialize() on app start
//
// To activate on Android:
//   npm install react-native-health-connect
//   Add HEALTH_CONNECT permission to AndroidManifest.xml
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import { supabase } from '@lib/supabase';
import { format } from 'date-fns';

export interface DailyActivityData {
  date: string;                    // 'YYYY-MM-DD'
  activeCaloriesBurned: number;
  restingCalories: number;
  steps: number;
  activeMinutes: number;
  sleepHours: number;
  heartRateAvg: number | null;
  hrvMs: number | null;
  source: 'apple_health' | 'health_connect' | 'manual';
}

// ─────────────────────────────────────────────────────────────
// Abstract interface — swapped per platform at runtime
// ─────────────────────────────────────────────────────────────
interface WearableProvider {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  fetchDailyActivity(date: Date): Promise<DailyActivityData | null>;
}

// ─────────────────────────────────────────────────────────────
// iOS — Apple Health via react-native-health (placeholder)
// ─────────────────────────────────────────────────────────────
class AppleHealthProvider implements WearableProvider {
  async isAvailable(): Promise<boolean> {
    // TODO: import AppleHealthKit from 'react-native-health'
    // return AppleHealthKit.isAvailable()
    return false;
  }

  async requestPermissions(): Promise<boolean> {
    // TODO:
    // const perms = { permissions: { read: ['ActiveEnergyBurned','StepCount','SleepAnalysis','HeartRateVariabilitySDNN'] } }
    // return new Promise(resolve => AppleHealthKit.initHealthKit(perms, err => resolve(!err)))
    return false;
  }

  async fetchDailyActivity(date: Date): Promise<DailyActivityData | null> {
    // TODO: AppleHealthKit.getActiveEnergyBurned, getDailyStepCountSamples, getSleepSamples, getHeartRateSamples
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Android — Health Connect (placeholder)
// ─────────────────────────────────────────────────────────────
class HealthConnectProvider implements WearableProvider {
  async isAvailable(): Promise<boolean> {
    // TODO: import { initialize } from 'react-native-health-connect'
    // return initialize()
    return false;
  }

  async requestPermissions(): Promise<boolean> {
    // TODO: requestPermission([{ accessType:'read', recordType:'ActiveCaloriesBurned' }, ...])
    return false;
  }

  async fetchDailyActivity(date: Date): Promise<DailyActivityData | null> {
    // TODO: readRecords('ActiveCaloriesBurned', { timeRangeFilter: {...} })
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Public singleton — platform-agnostic
// ─────────────────────────────────────────────────────────────
class WearableServiceClass {
  private provider: WearableProvider =
    Platform.OS === 'ios' ? new AppleHealthProvider() : new HealthConnectProvider();

  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  async requestPermissions(): Promise<boolean> {
    return this.provider.requestPermissions();
  }

  async syncToday(userId: string): Promise<DailyActivityData | null> {
    const data = await this.provider.fetchDailyActivity(new Date());
    if (!data) return null;
    await this.saveToSupabase(userId, data);
    return data;
  }

  async syncDate(userId: string, date: Date): Promise<DailyActivityData | null> {
    const data = await this.provider.fetchDailyActivity(date);
    if (!data) return null;
    await this.saveToSupabase(userId, data);
    return data;
  }

  private async saveToSupabase(userId: string, data: DailyActivityData): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('health_data').upsert({
      user_id: userId,
      data_date: data.date,
      source: data.source,
      active_calories_burned: data.activeCaloriesBurned,
      resting_calories: data.restingCalories,
      steps: data.steps,
      active_minutes: data.activeMinutes,
      sleep_hours: data.sleepHours,
      heart_rate_avg: data.heartRateAvg,
      hrv_ms: data.hrvMs,
    }, { onConflict: 'user_id,data_date,source' });
  }

  // Fetch the most recent synced health data for a user
  async getLatestForUser(userId: string): Promise<DailyActivityData | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .order('data_date', { ascending: false })
      .limit(1)
      .single() as {
        data: {
          data_date: string; source: string;
          active_calories_burned: number; resting_calories: number;
          steps: number; active_minutes: number; sleep_hours: number;
          heart_rate_avg: number | null; hrv_ms: number | null;
        } | null;
      };

    if (!data) return null;
    return {
      date: data.data_date,
      activeCaloriesBurned: data.active_calories_burned,
      restingCalories: data.resting_calories,
      steps: data.steps,
      activeMinutes: data.active_minutes,
      sleepHours: data.sleep_hours,
      heartRateAvg: data.heart_rate_avg,
      hrvMs: data.hrv_ms,
      source: data.source as DailyActivityData['source'],
    };
  }
}

export const WearableService = new WearableServiceClass();
