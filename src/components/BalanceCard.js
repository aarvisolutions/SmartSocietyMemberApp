import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const formatCurrency = (amount) => {
  if (amount == null) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
};

const BalanceCard = ({ icon, label, amount, accent = '#2563eb' }) => (
  <View style={styles.card}>
    <View style={[styles.iconBox, { backgroundColor: accent + '18' }]}>
      <Text style={[styles.icon, { color: accent }]}>{icon}</Text>
    </View>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.amount, { color: accent }]}>{formatCurrency(amount)}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    width: '47%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});

export default BalanceCard;
