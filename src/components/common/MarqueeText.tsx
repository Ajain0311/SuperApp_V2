import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type MarqueeTextProps = {
  text: string;
  speedPxPerSec?: number;
  textStyle?: TextStyle;
  style?: ViewStyle;
  gap?: number;
};

/**
 * Continuous horizontal marquee. Duplicates text when it overflows the viewport.
 */
export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  speedPxPerSec = 40,
  textStyle,
  style,
  gap = 48,
}) => {
  const offset = useRef(new Animated.Value(0)).current;
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const needsMarquee = textWidth > boxWidth + 8 && boxWidth > 0 && textWidth > 0;
  const cycle = textWidth + gap;

  const loopKey = useMemo(
    () => `${text}|${boxWidth}|${textWidth}|${speedPxPerSec}`,
    [text, boxWidth, textWidth, speedPxPerSec],
  );

  useEffect(() => {
    offset.stopAnimation();
    offset.setValue(0);
    if (!needsMarquee || cycle <= 0) return;

    const duration = Math.max(4000, Math.round((cycle / Math.max(speedPxPerSec, 10)) * 1000));
    const anim = Animated.loop(
      Animated.timing(offset, {
        toValue: -cycle,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => {
      anim.stop();
      offset.stopAnimation();
    };
  }, [loopKey, needsMarquee, cycle, offset, speedPxPerSec]);

  const onBoxLayout = (e: LayoutChangeEvent) => {
    setBoxWidth(e.nativeEvent.layout.width);
  };

  const onTextLayout = (e: LayoutChangeEvent) => {
    setTextWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={[styles.clip, style]} onLayout={onBoxLayout}>
      {/* Hidden measure pass */}
      <Text
        style={[styles.measure, textStyle]}
        onLayout={onTextLayout}
        numberOfLines={1}
      >
        {text}
      </Text>

      {needsMarquee ? (
        <Animated.View style={[styles.row, { transform: [{ translateX: offset }] }]}>
          <Text style={[styles.line, textStyle, { marginRight: gap }]} numberOfLines={1}>
            {text}
          </Text>
          <Text style={[styles.line, textStyle, { marginRight: gap }]} numberOfLines={1}>
            {text}
          </Text>
        </Animated.View>
      ) : (
        <Text style={[styles.line, textStyle]} numberOfLines={1}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'center',
  },
  measure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flexShrink: 0,
  },
});
