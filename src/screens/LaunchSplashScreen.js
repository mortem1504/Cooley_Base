import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors, spacing } from '../utils/theme';

const splashAnimation = require('../../assets/Cooley-logo.json');

export default function LaunchSplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(0.74)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    const entranceAnimation = Animated.sequence([
      Animated.delay(90),
      Animated.parallel([
        Animated.timing(haloOpacity, {
          duration: 420,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(haloScale, {
          duration: 760,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          duration: 460,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          friction: 7,
          tension: 65,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        duration: 320,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, {
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          toValue: 1.08,
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.92,
          useNativeDriver: true,
        }),
      ])
    );

    entranceAnimation.start();
    pulseAnimation.start();

    return () => {
      entranceAnimation.stop();
      pulseAnimation.stop();
    };
  }, [
    dotScale,
    haloOpacity,
    haloScale,
    logoOpacity,
    logoScale,
    taglineOpacity,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.centerWrap}>
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.animationWrap,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <LottieView
            autoPlay
            loop={false}
            resizeMode="contain"
            source={splashAnimation}
            speed={1.9}
            style={styles.animation}
          />
        </Animated.View>

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Nearby campus help and item listings, ready in a moment.
        </Animated.Text>
      </View>

      <View style={styles.footer}>
        <Animated.View style={[styles.loadingDot, { transform: [{ scale: dotScale }] }]} />
        <Animated.View
          style={[
            styles.loadingDot,
            styles.loadingDotSecondary,
            { transform: [{ scale: dotScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.loadingDot,
            styles.loadingDotTertiary,
            { transform: [{ scale: dotScale }] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#1f6fa6',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
  },
  centerWrap: {
    alignItems: 'center',
    width: '100%',
  },
  halo: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    height: 240,
    position: 'absolute',
    top: 0,
    width: 240,
  },
  animationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: '100%',
  },
  animation: {
    height: 240,
    width: 240,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    bottom: spacing.xxl,
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
  },
  loadingDot: {
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  loadingDotSecondary: {
    opacity: 0.72,
  },
  loadingDotTertiary: {
    opacity: 0.45,
  },
});
