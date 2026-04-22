import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginApi, sendOtpApi, verifyOtpApi } from '../services/api';

const OTP_RESEND_SECONDS = 30;

// ─── Mask mobile/member ID for display ───────────────────────
const maskId = (val = '') => {
  if (val.length <= 4) return val;
  return 'X'.repeat(val.length - 4) + val.slice(-4);
};

const LoginScreen = ({ navigation }) => {
  // ── Shared state ──
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
  const [loading, setLoading] = useState(false);

  // ── Password login state ──
  const [memberId, setMemberId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pwErrors, setPwErrors] = useState({});

  // ── OTP login state ──
  const [otpMemberId, setOtpMemberId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpIdError, setOtpIdError] = useState('');
  const [timer, setTimer] = useState(0);

  const timerRef = useRef(null);
  const otpInputRef = useRef(null);

  // ── Timer logic ───────────────────────────────────────────
  const startTimer = () => {
    setTimer(OTP_RESEND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Switch mode: reset OTP state ──────────────────────────
  const switchMode = (mode) => {
    setLoginMode(mode);
    setOtpSent(false);
    setOtpValue('');
    setOtpError('');
    setOtpIdError('');
    setTimer(0);
    clearInterval(timerRef.current);
  };

  // ── Password login ────────────────────────────────────────
  const validatePassword = () => {
    const e = {};
    if (!memberId.trim()) e.memberId = 'Member ID is required';
    if (!password.trim()) e.password = 'Password is required';
    setPwErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePasswordLogin = async () => {
    if (!validatePassword()) return;
    setLoading(true);
    try {
      const data = await loginApi(memberId.trim(), password);
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('member_id', String(data.memberId));
      navigation.replace('Dashboard', { memberId: data.memberId });
    } catch (err) {
      const message = err?.response?.data?.message || 'Invalid credentials. Please try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP: send ─────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!otpMemberId.trim()) {
      setOtpIdError('Member ID is required');
      return;
    }
    setOtpIdError('');
    setLoading(true);
    try {
      await sendOtpApi(otpMemberId.trim());
      setOtpSent(true);
      setOtpValue('');
      setOtpError('');
      startTimer();
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to send OTP. Please try again.';
      Alert.alert('OTP Error', message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP: verify ───────────────────────────────────────────
  const handleVerifyOtp = async (code = otpValue) => {
    if (code.length !== 6) {
      setOtpError('Enter the 6-digit OTP');
      return;
    }
    setOtpError('');
    setLoading(true);
    try {
      const data = await verifyOtpApi(otpMemberId.trim(), code);
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('member_id', String(data.memberId));
      clearInterval(timerRef.current);
      navigation.replace('Dashboard', { memberId: data.memberId });
    } catch (err) {
      const message = err?.response?.data?.message || 'Invalid or expired OTP. Please try again.';
      setOtpError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input: auto-submit when 6 digits entered ──────────
  const handleOtpChange = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setOtpValue(digits);
    setOtpError('');
    if (digits.length === 6) handleVerifyOtp(digits);
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/icon.png')} style={styles.logoIcon} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>EPFO Smart Society</Text>
          <Text style={styles.tagline}>Member Portal</Text>
        </View>

        {/* ── Mode Toggle ── */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, loginMode === 'password' && styles.toggleBtnActive]}
            onPress={() => switchMode('password')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, loginMode === 'password' && styles.toggleTextActive]}>
              🔑  Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, loginMode === 'otp' && styles.toggleBtnActive]}
            onPress={() => switchMode('otp')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, loginMode === 'otp' && styles.toggleTextActive]}>
              📱  OTP
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Card ── */}
        <View style={styles.card}>

          {/* ════ PASSWORD LOGIN ════ */}
          {loginMode === 'password' && (
            <>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSubtitle}>Sign in with your password</Text>

              {/* Member ID */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>MEMBER ID</Text>
                <View style={[styles.inputWrapper, pwErrors.memberId && styles.inputError]}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your Member ID"
                    placeholderTextColor="#94a3b8"
                    value={memberId}
                    onChangeText={(t) => { setMemberId(t); setPwErrors((e) => ({ ...e, memberId: '' })); }}
                    keyboardType="numeric"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </View>
                {!!pwErrors.memberId && <Text style={styles.errorText}>{pwErrors.memberId}</Text>}
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <View style={[styles.inputWrapper, pwErrors.password && styles.inputError]}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={(t) => { setPassword(t); setPwErrors((e) => ({ ...e, password: '' })); }}
                    secureTextEntry={!passwordVisible}
                    returnKeyType="done"
                    onSubmitEditing={handlePasswordLogin}
                  />
                  <TouchableOpacity onPress={() => setPasswordVisible((v) => !v)} style={styles.eyeBtn}>
                    <Text style={styles.eyeIcon}>{passwordVisible ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
                {!!pwErrors.password && <Text style={styles.errorText}>{pwErrors.password}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handlePasswordLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#ffffff" size="small" />
                  : <Text style={styles.primaryBtnText}>Sign In</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ════ OTP LOGIN ════ */}
          {loginMode === 'otp' && (
            <>
              <Text style={styles.cardTitle}>
                {otpSent ? 'Enter OTP' : 'Login with OTP'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {otpSent
                  ? `OTP sent to Mobile Number ${maskId(otpMemberId)}`
                  : "We'll send a one-time password to your registered mobile"}
              </Text>

              {/* Step 1: Mobile Number input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <View style={[styles.inputWrapper, !!otpIdError && styles.inputError]}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your Mobile Number"
                    placeholderTextColor="#94a3b8"
                    value={otpMemberId}
                    onChangeText={(t) => { setOtpMemberId(t); setOtpIdError(''); }}
                    keyboardType="numeric"
                    autoCapitalize="none"
                    returnKeyType="done"
                    editable={!otpSent}
                  />
                  {otpSent && (
                    <TouchableOpacity onPress={() => { setOtpSent(false); setOtpValue(''); clearInterval(timerRef.current); setTimer(0); }}>
                      <Text style={styles.changeText}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!!otpIdError && <Text style={styles.errorText}>{otpIdError}</Text>}
              </View>

              {/* Step 2: OTP input (shown after send) */}
              {otpSent && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>ONE-TIME PASSWORD</Text>
                  <View style={[styles.inputWrapper, !!otpError && styles.inputError, styles.otpWrapper]}>
                    <Text style={styles.inputIcon}>🔢</Text>
                    <TextInput
                      ref={otpInputRef}
                      style={[styles.input, styles.otpInput]}
                      placeholder="• • • • • •"
                      placeholderTextColor="#94a3b8"
                      value={otpValue}
                      onChangeText={handleOtpChange}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="done"
                      autoFocus
                    />
                    {otpValue.length > 0 && (
                      <TouchableOpacity onPress={() => { setOtpValue(''); setOtpError(''); }}>
                        <Text style={styles.clearText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* OTP digit indicator */}
                  <View style={styles.digitRow}>
                    {[0,1,2,3,4,5].map((i) => (
                      <View
                        key={i}
                        style={[styles.digitDot, i < otpValue.length && styles.digitDotFilled]}
                      />
                    ))}
                  </View>

                  {!!otpError && <Text style={styles.errorText}>{otpError}</Text>}
                </View>
              )}

              {/* Send OTP button (Step 1) */}
              {!otpSent && (
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#ffffff" size="small" />
                    : <Text style={styles.primaryBtnText}>Send OTP</Text>
                  }
                </TouchableOpacity>
              )}

              {/* Verify OTP button (Step 2) */}
              {otpSent && (
                <>
                  <TouchableOpacity
                    style={[styles.primaryBtn, (loading || otpValue.length !== 6) && styles.btnDisabled]}
                    onPress={() => handleVerifyOtp()}
                    disabled={loading || otpValue.length !== 6}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#ffffff" size="small" />
                      : <Text style={styles.primaryBtnText}>Verify OTP</Text>
                    }
                  </TouchableOpacity>

                  {/* Resend row */}
                  <View style={styles.resendRow}>
                    {timer > 0 ? (
                      <Text style={styles.timerText}>Resend OTP in <Text style={styles.timerCount}>{timer}s</Text></Text>
                    ) : (
                      <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                        <Text style={styles.resendText}>Resend OTP</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <Text style={styles.footer}>EPFO Smart Society Financial System © 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0f172a' },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  // ── Header ──
  header: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  logoIcon: { width: 48, height: 48 },
  appName: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5, marginBottom: 4 },
  tagline: { fontSize: 13, color: '#94a3b8', fontWeight: '500', letterSpacing: 1.5, textTransform: 'uppercase' },

  // ── Toggle ──
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#d32f2f',
    shadowColor: '#d32f2f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  toggleTextActive: { color: '#ffffff' },

  // ── Card ──
  card: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 18 },

  // ── Fields ──
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 50,
  },
  inputError: { borderColor: '#ef4444' },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#f1f5f9', fontWeight: '500' },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },
  errorText: { fontSize: 11, color: '#f87171', marginTop: 5, marginLeft: 2 },

  // ── OTP specific ──
  otpWrapper: { height: 54 },
  otpInput: { fontSize: 22, fontWeight: '700', letterSpacing: 8 },
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 2,
  },
  digitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  digitDotFilled: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  changeText: { fontSize: 12, color: '#60a5fa', fontWeight: '600', paddingHorizontal: 4 },
  clearText: { fontSize: 14, color: '#64748b', paddingHorizontal: 4 },

  // ── Buttons ──
  primaryBtn: {
    backgroundColor: '#d32f2f',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#d32f2f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  // ── Resend / Timer ──
  resendRow: { alignItems: 'center', marginTop: 16 },
  timerText: { fontSize: 13, color: '#64748b' },
  timerCount: { color: '#d32f2f', fontWeight: '700' },
  resendText: { fontSize: 13, color: '#d32f2f', fontWeight: '700' },

  // ── Footer ──
  footer: { marginTop: 32, fontSize: 11, color: '#334155', textAlign: 'center' },
});

export default LoginScreen;
