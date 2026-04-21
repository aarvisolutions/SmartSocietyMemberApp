import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const ProfileCard = ({ name, memberId, status, photoUrl }) => {
  const isActive = status === 'Running';
  const [imgError, setImgError] = React.useState(false);
  const showPhoto = photoUrl && !imgError;

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarRing}>
        {showPhoto ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.avatarImg}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.initials}>{getInitials(name)}</Text>
          </View>
        )}
      </View>

      {/* Name & ID */}
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.memberId}>Member ID: {memberId}</Text>

      {/* Status badge */}
      <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
        <View style={[styles.badgeDot, isActive ? styles.dotActive : styles.dotInactive]} />
        <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
          {status ?? 'Unknown'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  initials: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  memberId: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 14,
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  badgeActive: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  badgeInactive: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: { backgroundColor: '#22c55e' },
  dotInactive: { backgroundColor: '#ef4444' },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  badgeTextActive: { color: '#86efac' },
  badgeTextInactive: { color: '#fca5a5' },
});

export default ProfileCard;
