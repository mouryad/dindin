import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { InventoryItem } from '@db/database';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

const BLINKIT_NUDGE_ID = 'dindin-blinkit-morning';

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;                 // simulators can't receive push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Dindin',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Schedule (or reschedule) the 8:00 AM daily Blinkit restock nudge.
// Call this whenever the inventory changes.
export async function scheduleDailyBlinkitNudge(items: InventoryItem[]): Promise<void> {
  // Cancel any existing nudge so we don't stack duplicates
  await Notifications.cancelScheduledNotificationAsync(BLINKIT_NUDGE_ID).catch(() => {});

  const expiringSoon = items.filter((item) => {
    if (!item.expiry_date) return false;
    const daysLeft = Math.ceil(
      (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return daysLeft <= 3 && daysLeft >= 0;
  });

  if (expiringSoon.length === 0) return;

  const names = expiringSoon.slice(0, 3).map((i) => i.name).join(', ');
  const more  = expiringSoon.length > 3 ? ` +${expiringSoon.length - 3} more` : '';

  await Notifications.scheduleNotificationAsync({
    identifier: BLINKIT_NUDGE_ID,
    content: {
      title: '🛒 Time to restock on Blinkit',
      body: `Running low on: ${names}${more}`,
      data: { type: 'blinkit_nudge', itemIds: expiringSoon.map((i) => i.id) },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });
}

export async function cancelBlinkitNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BLINKIT_NUDGE_ID).catch(() => {});
}

// Send a one-off local notification (e.g. when a fridge scan adds items)
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,                                    // fire immediately
  });
}
