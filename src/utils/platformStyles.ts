import { Platform, type ViewStyle } from 'react-native';

/** Web has no RCTAnimation native module — always use JS driver there. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

function colorWithOpacity(color: string, opacity: number): string {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return color;
}

/**
 * Cross-platform elevation shadow.
 * Native keeps shadow* + elevation; web uses boxShadow (shadow* is deprecated on RN-web).
 */
export function shadowStyle(options: {
  color?: string;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  radius?: number;
  elevation?: number;
} = {}): ViewStyle {
  const {
    color = '#000000',
    offsetX = 0,
    offsetY = 4,
    opacity = 0.25,
    radius = 8,
    elevation = 4,
  } = options;

  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${colorWithOpacity(color, opacity)}`,
    } as ViewStyle;
  }

  return {
    shadowColor: color,
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}
