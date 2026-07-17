import { Platform } from 'react-native';

// Platform-guarded haptic helpers. No-ops on web; failures are swallowed so
// feedback never breaks a flow (e.g. simulators without haptic hardware).

export async function hapticSuccess() {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // haptics unavailable — ignore
  }
}

export async function hapticWarning() {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // haptics unavailable — ignore
  }
}

export async function hapticTap() {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // haptics unavailable — ignore
  }
}
