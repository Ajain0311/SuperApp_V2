import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Live soft-keyboard height. Use to lift composers / bottom inputs.
 * On Android with softwareKeyboardLayoutMode "resize", prefer
 * `androidMode: 'none'` so you do not double-offset; use `'pad'` when
 * resize alone still covers the focused field (common in chat screens).
 */
export function useKeyboardHeight(options?: {
  enabled?: boolean;
  /** Android: 'pad' adds keyboard height; 'none' relies on window resize. Default 'pad' for chat reliability. */
  androidMode?: 'pad' | 'none';
}) {
  const enabled = options?.enabled ?? true;
  const androidMode = options?.androidMode ?? 'pad';
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      const next = e?.endCoordinates?.height ?? 0;
      if (Platform.OS === 'android' && androidMode === 'none') {
        setHeight(0);
        return;
      }
      setHeight(next);
    };
    const onHide = () => setHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled, androidMode]);

  return height;
}
