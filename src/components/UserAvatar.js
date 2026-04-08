import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { buildInitials } from '../services/profileService';
import { colors } from '../utils/theme';

export default function UserAvatar({
  avatarUrl,
  initials,
  name,
  onPress,
  size = 48,
  style,
  textStyle,
}) {
  const resolvedInitials = initials || buildInitials(name);
  const avatarStyles = {
    borderRadius: size / 2,
    height: size,
    width: size,
  };
  const content = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={[styles.image, avatarStyles]} />
  ) : (
    <View style={[styles.fallback, avatarStyles]}>
      <Text
        style={[
          styles.initials,
          { fontSize: Math.max(Math.round(size * 0.34), 12) },
          textStyle,
        ]}
      >
        {resolvedInitials}
      </Text>
    </View>
  );

  if (!onPress) {
    return <View style={style}>{content}</View>;
  }

  return (
    <Pressable hitSlop={10} onPress={onPress} style={style}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.primarySoft,
  },
  initials: {
    color: colors.primary,
    fontWeight: '800',
  },
});
