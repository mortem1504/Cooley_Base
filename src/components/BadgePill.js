import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, shadow } from '../utils/theme';

const toneMap = {
  blue: {
    backgroundColor: '#EEF5FF',
    borderColor: '#D8E8FF',
    iconBackgroundColor: '#DDEBFF',
    iconColor: '#2E67A8',
    textColor: '#274E80',
  },
  gold: {
    backgroundColor: '#FFF7E1',
    borderColor: '#F3E3A7',
    iconBackgroundColor: '#F9E7A5',
    iconColor: '#B78916',
    textColor: '#A06E00',
  },
  gray: {
    backgroundColor: '#F5F7FB',
    borderColor: '#E2E8F3',
    iconBackgroundColor: '#ECEFF6',
    iconColor: '#65748B',
    textColor: '#506176',
  },
  green: {
    backgroundColor: '#EAF7EF',
    borderColor: '#CFEBD9',
    iconBackgroundColor: '#D6F0DF',
    iconColor: '#2B7F49',
    textColor: '#2E6B43',
  },
};

export default function BadgePill({
  compact = false,
  disabled = false,
  icon,
  imageSource,
  label,
  onPress,
  style,
  tone = 'blue',
  variant = 'filled',
}) {
  const toneStyles = toneMap[tone] || toneMap.blue;
  const isOutline = variant === 'outline';
  const isSolid = variant === 'solid';
  const Container = onPress ? Pressable : View;
  const containerStyle = [
    styles.base,
    compact && styles.compact,
    {
      backgroundColor: isOutline ? '#FFFFFF' : toneStyles.backgroundColor,
      borderColor: toneStyles.borderColor,
    },
    isSolid && {
      backgroundColor: toneStyles.iconColor,
      borderColor: toneStyles.iconColor,
    },
    disabled && styles.disabled,
    style,
  ];
  const labelStyle = [
    styles.label,
    compact && styles.compactLabel,
    {
      color: isSolid ? '#FFFFFF' : toneStyles.textColor,
    },
  ];
  const iconBadgeStyle = [
    styles.iconBadge,
    compact && styles.compactIconBadge,
    {
      backgroundColor: isSolid ? 'rgba(255,255,255,0.16)' : toneStyles.iconBackgroundColor,
    },
  ];
  const iconTextStyle = [
    styles.iconText,
    compact && styles.compactIconText,
    {
      color: isSolid ? '#FFFFFF' : toneStyles.iconColor,
    },
  ];

  const content = (
    <>
      {imageSource || icon ? (
        <View style={iconBadgeStyle}>
          {imageSource ? (
            <Image resizeMode="contain" source={imageSource} style={styles.imageIcon} />
          ) : (
            <Text style={iconTextStyle}>{icon}</Text>
          )}
        </View>
      ) : null}
      <Text numberOfLines={1} style={labelStyle}>
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={containerStyle}>{content}</View>;
  }

  return (
    <Container onPress={onPress} style={({ pressed }) => [containerStyle, pressed && styles.pressed]}>
      {content}
    </Container>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: shadow.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  compact: {
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  compactIconBadge: {
    height: 22,
    width: 22,
  },
  compactIconText: {
    fontSize: 11,
  },
  compactLabel: {
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  iconText: {
    fontSize: 12,
    fontWeight: '800',
  },
  imageIcon: {
    height: 16,
    width: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
});
