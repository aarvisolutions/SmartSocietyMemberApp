import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const InfoRow = ({ label, value, last = false }) => (
  <View style={[styles.row, !last && styles.rowBorder]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value ?? '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});

export default InfoRow;
