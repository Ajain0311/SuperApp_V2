/**
 * Lightweight local UX sounds. Lazy-loads once; never blocks navigation.
 */
let orderPlacedSound: { replayAsync: () => Promise<unknown>; setVolumeAsync: (v: number) => Promise<unknown> } | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureOrderPlacedSound(): Promise<void> {
  if (orderPlacedSound) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    try {
      // Dynamic import so Jest / web without native module stay resilient.
      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../assets/sounds/order-placed.wav'),
        { shouldPlay: false, volume: 0.45, isLooping: false }
      );
      orderPlacedSound = sound;
    } catch (err) {
      console.warn('[feedbackSound] order-placed load skipped:', (err as Error)?.message || err);
      orderPlacedSound = null;
    }
  })();

  await loadPromise;
}

/** Fire-and-forget soft chime after a successful food order place. */
export function playOrderPlacedChime(): void {
  void (async () => {
    try {
      await ensureOrderPlacedSound();
      if (!orderPlacedSound) return;
      await orderPlacedSound.setVolumeAsync(0.45);
      await orderPlacedSound.replayAsync();
    } catch (err) {
      console.warn('[feedbackSound] play failed:', (err as Error)?.message || err);
    }
  })();
}
