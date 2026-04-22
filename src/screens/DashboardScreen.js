import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { useWindowDimensions } from 'react-native';
import { getMemberApi, BASE_URL } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// HELPERS  (API logic — unchanged)
// ─────────────────────────────────────────────────────────────
const getLoanBalance    = (loans,    t) => loans?.find(l => l.loanType === t)?.balance    ?? 0;
const getDepositBalance = (deposits, t) => deposits?.find(d => d.type   === t)?.balance   ?? 0;

const getPhotoUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const formatDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmt = (n) => {                        // short  ₹1.65L
  if (n == null) return '₹0';
  const v = Number(n);
  if (v >= 1e6) return `₹${(v / 1e6).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
};
const fmtFull = (n) =>                      // full   ₹1,65,081
  n == null ? '₹0' : `₹${Number(n).toLocaleString('en-IN')}`;

const getInitials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  // hero gradient layers
  heroBase   : '#0b1d5e',
  heroMid    : '#1e1070',
  heroPurple : '#3b0f8c',

  navy    : '#1a3a8a',
  bg      : '#eef2f7',
  white   : '#ffffff',
  dark    : '#0f172a',
  mid     : '#475569',
  muted   : '#94a3b8',
  divider : '#f1f5f9',

  blue    : '#2563eb',
  green   : '#059669',
  amber   : '#d97706',
  purple  : '#7c3aed',
  red     : '#dc2626',
};

// ─────────────────────────────────────────────────────────────
// BALANCE CARD DATA
// ─────────────────────────────────────────────────────────────
const BAL_CARDS = [
  { key: 'mbf',    label: 'MBF',     icon: '💎', from: '#1d4ed8', to: '#3b82f6' },
  { key: 'thrift', label: 'Thrift',  icon: '💰', from: '#047857', to: '#10b981' },
  { key: 'stLoan', label: 'ST Loan', icon: '📋', from: '#92400e', to: '#d97706' },
  { key: 'mtLoan', label: 'MT Loan', icon: '🏦', from: '#5b21b6', to: '#8b5cf6' },
];

// ─────────────────────────────────────────────────────────────
// LOAN STATUS PALETTE
// ─────────────────────────────────────────────────────────────
const LOAN_SC = {
  Running : { bg: '#dcfce7', dot: '#16a34a', txt: '#15803d', bar: '#22c55e' },
  Active  : { bg: '#dcfce7', dot: '#16a34a', txt: '#15803d', bar: '#22c55e' },
  R       : { bg: '#dcfce7', dot: '#16a34a', txt: '#15803d', bar: '#22c55e' },
  Closed  : { bg: '#fee2e2', dot: '#dc2626', txt: '#b91c1c', bar: '#ef4444' },
  C       : { bg: '#fee2e2', dot: '#dc2626', txt: '#b91c1c', bar: '#ef4444' },
};
const DEF_SC = { bg: '#f1f5f9', dot: '#94a3b8', txt: '#64748b', bar: '#94a3b8' };

// ─────────────────────────────────────────────────────────────
// DEPOSIT META
// ─────────────────────────────────────────────────────────────
const DEP_META = {
  THRIFT : { icon: '💰', color: '#059669', bg: '#dcfce7' },
  MBF    : { icon: '💎', color: '#2563eb', bg: '#dbeafe' },
  SHARE  : { icon: '📈', color: '#7c3aed', bg: '#ede9fe' },
  RD     : { icon: '🏦', color: '#d97706', bg: '#fef3c7' },
};
const DEF_DEP = { icon: '🪙', color: T.mid, bg: '#f1f5f9' };

// ═════════════════════════════════════════════════════════════
//  REUSABLE UI COMPONENTS
// ═════════════════════════════════════════════════════════════

/* ── Gradient hero background (no package needed) ── */
const GradientHero = ({ children }) => (
  <View style={s.hero}>
    {/* base colour */}
    {/* purple layer — top-right */}
    <View style={s.gradLayerA} />
    {/* deep purple — bottom-left */}
    <View style={s.gradLayerB} />
    {/* shimmer circle top-right */}
    <View style={s.decoA} />
    <View style={s.decoB} />
    <View style={s.decoC} />
    {children}
  </View>
);

/* ── Status badge ── */
const StatusBadge = ({ status }) => {
  const on = ['Running', 'Active', 'R'].includes(status);
  return (
    <View style={[s.badge, on ? s.badgeOn : s.badgeOff]}>
      <View style={[s.badgePulse, { backgroundColor: on ? '#4ade80' : '#f87171' }]} />
      <Text style={[s.badgeTxt, { color: on ? '#86efac' : '#fca5a5' }]}>
        {on ? 'Active Member' : (status ?? 'Inactive')}
      </Text>
    </View>
  );
};

/* ── Total savings chip ── */
const TotalSavings = ({ mbf = 0, thrift = 0 }) => {
  const total = Number(mbf) + Number(thrift);
  return (
    <View style={s.totalChip}>
      <View style={s.totalChipInner}>
        <Text style={s.totalChipLabel}>Total Savings</Text>
        <Text style={s.totalChipAmt}>{fmtFull(total)}</Text>
      </View>
      <View style={s.totalChipRight}>
        <Text style={s.totalChipIcon}>💼</Text>
      </View>
    </View>
  );
};

/* ── Balance scroll card ── */
const BalanceCard = ({ icon, label, amount, from }) => (
  <View style={[s.balCard, { backgroundColor: from }]}>
    <View style={s.balShimmer} />
    <View style={s.balRow}>
      <View style={s.balIconBox}>
        <Text style={s.balIconTxt}>{icon}</Text>
      </View>
      <View style={s.balArrow}>
        <Text style={s.balArrowTxt}>↗</Text>
      </View>
    </View>
    <Text style={s.balAmt}>{fmtFull(amount)}</Text>
    <Text style={s.balLabel}>{label}</Text>
  </View>
);

/* ── Section heading ── */
const SectionHead = ({ icon, title }) => (
  <View style={s.secHead}>
    <View style={s.secIconBox}><Text style={s.secIconTxt}>{icon}</Text></View>
    <Text style={s.secTitle}>{title}</Text>
  </View>
);

/* ── Info field (stacked: label / value) ── */
const Field = ({ label, value, color, wide }) => (
  <View style={[s.field, wide && s.fieldWide]}>
    <Text style={s.fieldLbl}>{label}</Text>
    <Text style={[s.fieldVal, color && { color }]} numberOfLines={1}>{value ?? '—'}</Text>
  </View>
);

/* ── Two-column field row ── */
const FieldRow = ({ fields, last }) => (
  <View style={[s.fieldRow, !last && s.fieldRowLine]}>
    {fields.map((f, i) => (
      <Field key={i} label={f.label} value={f.value} color={f.color}
        wide={fields.length === 1} />
    ))}
  </View>
);

/* ── Info card wrapper ── */
const InfoCard = ({ accent = T.blue, children }) => (
  <View style={s.infoCard}>
    <View style={[s.infoCardAccent, { backgroundColor: accent }]} />
    <View style={s.infoCardBody}>{children}</View>
  </View>
);

/* ── Repayment progress bar ── */
const ProgressBar = ({ sanction, outstanding, color }) => {
  const repaid = Number(sanction) - Number(outstanding);
  const pct    = sanction > 0 ? clamp(repaid / Number(sanction), 0, 1) : 0;
  return (
    <View style={s.progWrap}>
      <View style={s.progTrack}>
        <View style={[s.progFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.progTxt}>{Math.round(pct * 100)}% repaid</Text>
    </View>
  );
};

/* ── Loan card ── */
const LoanCard = ({ loan }) => {
  const sc  = LOAN_SC[loan.status] ?? DEF_SC;
  const isAmt = loan.sanctionAmount > 0;

  return (
    <View style={s.loanCard}>
      {/* top gradient band */}
      <View style={[s.loanBand, { backgroundColor: sc.bar }]} />

      <View style={s.loanContent}>
        {/* row 1 — type + status */}
        <View style={s.loanRow1}>
          <View>
            <Text style={s.loanType}>{loan.loanType}</Text>
            {loan.id?.accNo ? <Text style={s.loanAccNo}>A/C · {loan.id.accNo}</Text> : null}
          </View>
          <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
            <View style={[s.statusDot, { backgroundColor: sc.dot }]} />
            <Text style={[s.statusTxt, { color: sc.txt }]}>{loan.status}</Text>
          </View>
        </View>

        {/* outstanding — hero amount */}
        <View style={s.loanHeroBox}>
          <Text style={s.loanHeroLbl}>Outstanding Balance</Text>
          <Text style={s.loanHeroAmt}>{fmtFull(loan.outstandingAmount)}</Text>
          {isAmt && (
            <ProgressBar
              sanction={loan.sanctionAmount}
              outstanding={loan.outstandingAmount}
              color={sc.bar}
            />
          )}
        </View>

        {/* row 2 — 3 sub metrics */}
        <View style={s.loanMetaRow}>
          <View style={s.loanMetaCell}>
            <Text style={s.loanMetaLbl}>Sanctioned</Text>
            <Text style={s.loanMetaVal}>{fmtFull(loan.sanctionAmount)}</Text>
          </View>
          <View style={[s.loanMetaCell, s.loanMetaMid]}>
            <Text style={s.loanMetaLbl}>Monthly EMI</Text>
            <Text style={s.loanMetaVal}>{fmtFull(loan.emiAmount)}</Text>
          </View>
          <View style={[s.loanMetaCell, s.loanMetaEnd]}>
            <Text style={s.loanMetaLbl}>Sanction Date</Text>
            <Text style={s.loanMetaVal}>{formatDate(loan.sanctionDate)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

/* ── Deposit card ── */
const DepositCard = ({ dep }) => {
  const k    = (dep.type ?? dep.depositType ?? '').toUpperCase();
  const meta = Object.entries(DEP_META).find(([key]) => k.includes(key))?.[1] ?? DEF_DEP;

  return (
    <View style={s.depCard}>
      <View style={[s.depIconBox, { backgroundColor: meta.bg }]}>
        <Text style={s.depIconTxt}>{meta.icon}</Text>
      </View>
      <View style={s.depInfo}>
        <Text style={s.depType}>{dep.type ?? dep.depositType ?? '—'}</Text>
        <Text style={s.depSince}>Opened {formatDate(dep.openDate ?? dep.startDate)}</Text>
        {dep.roi > 0 && (
          <View style={[s.depRateBadge, { backgroundColor: meta.bg }]}>
            <Text style={[s.depRateTxt, { color: meta.color }]}>{dep.roi}% p.a.</Text>
          </View>
        )}
      </View>
      <View style={s.depAmtCol}>
        <Text style={[s.depAmt, { color: meta.color }]}>{fmtFull(dep.balance)}</Text>
        <Text style={s.depAmtLbl}>Balance</Text>
      </View>
    </View>
  );
};

/* ── Empty state ── */
const Empty = ({ icon, title, sub }) => (
  <View style={s.empty}>
    <View style={s.emptyIconWrap}><Text style={s.emptyIconTxt}>{icon}</Text></View>
    <Text style={s.emptyTitle}>{title}</Text>
    <Text style={s.emptySub}>{sub}</Text>
  </View>
);

// ═════════════════════════════════════════════════════════════
//  TABS
// ═════════════════════════════════════════════════════════════

const InfoTab = ({ member, onRefresh, refreshing }) => (
  <ScrollView
    style={s.tabScroll}
    contentContainerStyle={s.tabPad}
    showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
  >
    <SectionHead icon="👤" title="Personal Details" />
    <InfoCard accent={T.blue}>
      <FieldRow fields={[
        { label: 'Father / Husband', value: member.fatherName },
        { label: 'Date of Birth',    value: formatDate(member.dob) },
      ]} />
      <FieldRow fields={[
        { label: 'Blood Group', value: member.bloodGroup },
        { label: 'Gender',      value: member.sex },
      ]} />
      <FieldRow last fields={[{ label: 'Community', value: member.community }]} />
    </InfoCard>

    <SectionHead icon="💼" title="Employment" />
    <InfoCard accent={T.purple}>
      <FieldRow fields={[
        { label: 'Branch',      value: member.branch },
        { label: 'Designation', value: member.designation },
      ]} />
      <FieldRow last fields={[
        { label: 'Section',       value: member.section },
        { label: 'Employee Code', value: member.empCode },
      ]} />
    </InfoCard>

    <SectionHead icon="🏛️" title="Membership" />
    <InfoCard accent={T.green}>
      <FieldRow fields={[
        { label: 'Member Since',    value: formatDate(member.opDate ?? member.joiningDate) },
        { label: 'Retirement Date', value: formatDate(member.retirementDate) },
      ]} />
      <FieldRow last fields={[{
        label: 'Status',
        value: member.status === 'R' ? 'Running' : (member.status ?? '—'),
        color: ['R','Running','Active'].includes(member.status) ? T.green : T.red,
      }]} />
    </InfoCard>

    <SectionHead icon="📞" title="Contact" />
    <InfoCard accent={T.amber}>
      <FieldRow fields={[
        { label: 'Mobile', value: member.phone },
        { label: 'Email',  value: member.email },
      ]} last />
    </InfoCard>
  </ScrollView>
);

const LoansTab = ({ member, onRefresh, refreshing }) => {
  const BAL_KEY = { 'MT Loan': 'mtLoan', 'ST Loan': 'stLoan' };
  const activeLoans = (member.loans ?? [])
    .filter(l => {
      const bal = Number(member.balances?.[BAL_KEY[l.loanType]] ?? l.outstandingAmount ?? 0);
      return bal !== 0;
    })
    .sort((a, b) => new Date(b.sanctionDate) - new Date(a.sanctionDate));
  return (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabPad}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
    >
      {activeLoans.length === 0
        ? <Empty icon="📂" title="No Active Loans" sub="You have no loans with outstanding balance" />
        : activeLoans.map((loan, i) => <LoanCard key={i} loan={loan} />)
      }
    </ScrollView>
  );
};

const DepositsTab = ({ member, onRefresh, refreshing }) => (
  <ScrollView
    style={s.tabScroll}
    contentContainerStyle={s.tabPad}
    showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.navy} />}
  >
    {(member.deposits ?? []).length === 0
      ? <Empty icon="💳" title="No Deposits Found" sub="No deposit records for this account" />
      : (member.deposits ?? []).map((dep, i) => <DepositCard key={i} dep={dep} />)
    }
  </ScrollView>
);

// ═════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═════════════════════════════════════════════════════════════
const DashboardScreen = ({ route, navigation }) => {
  const { memberId } = route.params;
  const layout       = useWindowDimensions();

  const [member,     setMember]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabIndex,   setTabIndex]   = useState(0);
  const [imgError,   setImgError]   = useState(false);

  const [routes] = useState([
    { key: 'info',     title: 'Info'     },
    { key: 'loans',    title: 'Loans'    },
    { key: 'deposits', title: 'Deposits' },
  ]);

  /* ── API (unchanged) ─────────────────────────────── */
  const fetchMember = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await getMemberApi(memberId);
      console.log('[Member data]', JSON.stringify(data, null, 2));
      setMember(data);
    } catch (err) {
      console.error('[Member API Error]', err);
      Alert.alert('Error', 'Failed to load member data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId]);

  useEffect(() => { fetchMember(); }, [fetchMember]);

  const handleLogout = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['auth_token', 'member_id']);
          navigation.replace('Login');
        },
      },
    ]);

  /* ── Tab setup ──────────────────────────────────── */
  const renderScene = member
    ? SceneMap({
        info:     () => <InfoTab     member={member} onRefresh={() => fetchMember(true)} refreshing={refreshing} />,
        loans:    () => <LoansTab    member={member} onRefresh={() => fetchMember(true)} refreshing={refreshing} />,
        deposits: () => <DepositsTab member={member} onRefresh={() => fetchMember(true)} refreshing={refreshing} />,
      })
    : () => null;

  const renderTabBar = (props) => (
    <TabBar
      {...props}
      style={s.tabBar}
      indicatorStyle={s.tabIndicator}
      renderLabel={({ route: r, focused }) => (
        <Text style={[s.tabLbl, focused && s.tabLblOn]}>{r.title}</Text>
      )}
      pressColor="transparent"
    />
  );

  /* ── Loading ────────────────────────────────────── */
  if (loading) {
    return (
      <View style={s.loadScreen}>
        <View style={s.loadCard}>
          <ActivityIndicator size="large" color={T.navy} />
          <Text style={s.loadTitle}>Loading Profile</Text>
          <Text style={s.loadSub}>Please wait…</Text>
        </View>
      </View>
    );
  }

  const photoUrl  = getPhotoUrl(member?.profilePhoto);
  const showPhoto = !!photoUrl && !imgError;
  const bal       = member?.balances ?? {};

  /* ── Render ─────────────────────────────────────── */
  return (
    <View style={s.screen}>

      {/* ══════════ HERO ══════════ */}
      <GradientHero>

        {/* top bar */}
        <View style={s.topBar}>
          <View style={s.brandRow}>
            <View style={s.brandDot} />
            <Text style={s.brandTxt}>EPFO Smart Society</Text>
          </View>
          <TouchableOpacity style={s.signBtn} onPress={handleLogout} activeOpacity={0.75}>
            <Text style={s.signTxt}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* profile */}
        {member && (
          <View style={s.profileRow}>
            {/* avatar */}
            <View style={s.avatarRing}>
              {showPhoto
                ? <Image source={{ uri: photoUrl }} style={s.avatarImg} onError={() => setImgError(true)} />
                : (
                  <View style={s.avatarBg}>
                    <Text style={s.avatarInitials}>{getInitials(member.name)}</Text>
                  </View>
                )
              }
            </View>

            {/* text stack */}
            <View style={s.profileMeta}>
              <Text style={s.greet}>Welcome back 👋</Text>
              <Text style={s.memberName} numberOfLines={1}>{member.name}</Text>
              <Text style={s.memberIdTxt}>ID · {member.memberId}</Text>
              <StatusBadge status={member.status} />
            </View>
          </View>
        )}

        {/* total savings chip */}
        {member?.balances && (
          <View style={s.totalChipWrap}>
            <TotalSavings mbf={bal.mbf} thrift={bal.thrift} />
          </View>
        )}

        {/* balance horizontal scroll */}
        {member?.balances && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.balScroll}
          >
            {BAL_CARDS.map(({ key, label, icon, from, to }) => (
              <BalanceCard
                key={key}
                icon={icon}
                label={label}
                amount={bal[key]}
                from={from}
                to={to}
              />
            ))}
          </ScrollView>
        )}
      </GradientHero>

      {/* ══════════ TABS ══════════ */}
      <View style={s.tabSection}>
        {member && (
          <TabView
            navigationState={{ index: tabIndex, routes }}
            renderScene={renderScene}
            onIndexChange={setTabIndex}
            initialLayout={{ width: layout.width }}
            renderTabBar={renderTabBar}
          />
        )}
      </View>
    </View>
  );
};

// ═════════════════════════════════════════════════════════════
//  STYLES
// ═════════════════════════════════════════════════════════════
const s = StyleSheet.create({

  /* ── Screen ── */
  screen: { flex: 1, backgroundColor: T.bg },

  /* ── Loading ── */
  loadScreen: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  loadCard: {
    backgroundColor: T.white, borderRadius: 28, padding: 40,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 8,
  },
  loadTitle: { fontSize: 18, fontWeight: '700', color: T.dark, marginTop: 6 },
  loadSub:   { fontSize: 13, color: T.muted },

  /* ── Hero (gradient simulation) ── */
  hero: {
    backgroundColor: T.heroBase,
    paddingTop: 52,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    shadowColor: '#0b1d5e',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 16,
  },
  /* gradient colour layers */
  gradLayerA: {
    position: 'absolute', top: 0, right: 0,
    width: SCREEN_W * 0.65, height: '100%',
    backgroundColor: T.heroPurple,
    opacity: 0.55,
    borderBottomLeftRadius: 200,
  },
  gradLayerB: {
    position: 'absolute', bottom: 0, left: 0,
    width: SCREEN_W * 0.5, height: '55%',
    backgroundColor: T.heroMid,
    opacity: 0.45,
    borderTopRightRadius: 200,
  },
  /* shimmer circles */
  decoA: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -50,
  },
  decoB: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)', top: 50, right: 90,
  },
  decoC: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: 10, left: -60,
  },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22, marginBottom: 22,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#60a5fa' },
  brandTxt: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.4 },
  signBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  signTxt: { color: T.white, fontSize: 12, fontWeight: '700' },

  /* ── Profile row ── */
  profileRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 22, marginBottom: 20, gap: 16,
  },
  avatarRing: {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatarImg : { width: 78, height: 78, borderRadius: 39 },
  avatarBg  : {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials : { fontSize: 28, fontWeight: '900', color: T.white },
  profileMeta    : { flex: 1, paddingTop: 2, gap: 3 },
  greet          : { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  memberName     : { fontSize: 23, fontWeight: '900', color: T.white, letterSpacing: -0.5 },
  memberIdTxt    : { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  /* ── Status badge ── */
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, gap: 6, marginTop: 5,
  },
  badgeOn : { backgroundColor: 'rgba(34,197,94,0.22)',  borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)' },
  badgeOff: { backgroundColor: 'rgba(239,68,68,0.22)',  borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
  badgePulse: { width: 7, height: 7, borderRadius: 3.5 },
  badgeTxt  : { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  /* ── Total savings chip ── */
  totalChipWrap: { paddingHorizontal: 22, marginBottom: 18 },
  totalChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  totalChipInner : { flex: 1 },
  totalChipLabel : { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  totalChipAmt   : { fontSize: 24, fontWeight: '900', color: T.white, letterSpacing: -0.5, marginTop: 2 },
  totalChipRight : { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  totalChipIcon  : { fontSize: 22 },

  /* ── Balance scroll ── */
  balScroll: { paddingHorizontal: 20, paddingBottom: 30, gap: 12 },
  balCard: {
    width: 148, borderRadius: 22, padding: 16, gap: 8,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  balShimmer: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.09)', top: -35, right: -30,
  },
  balRow    : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balIconBox: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  balIconTxt : { fontSize: 20 },
  balArrow   : {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  balArrowTxt: { fontSize: 14, color: T.white, fontWeight: '700' },
  balAmt     : { fontSize: 19, fontWeight: '900', color: T.white, letterSpacing: -0.5 },
  balLabel   : { fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  /* ── Tab bar ── */
  tabSection : { flex: 1 },
  tabBar: {
    backgroundColor: T.white, elevation: 0, shadowOpacity: 0,
    borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0', height: 52,
  },
  tabIndicator: { backgroundColor: T.navy, height: 3, borderRadius: 3 },
  tabLbl  : { fontSize: 13, fontWeight: '600', color: T.muted, letterSpacing: 0.1 },
  tabLblOn: { color: T.navy, fontWeight: '800' },
  tabScroll: { flex: 1, backgroundColor: T.bg },
  tabPad   : { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 48 },

  /* ── Section head ── */
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10, marginTop: 8, marginLeft: 2 },
  secIconBox: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: T.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
  },
  secIconTxt: { fontSize: 13 },
  secTitle  : { fontSize: 11, fontWeight: '800', color: T.mid, textTransform: 'uppercase', letterSpacing: 1.3 },

  /* ── Info card ── */
  infoCard: {
    backgroundColor: T.white, borderRadius: 20, marginBottom: 16,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 2,
  },
  infoCardAccent: { width: 4 },
  infoCardBody  : { flex: 1 },
  fieldRow      : { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 16 },
  fieldRowLine  : { borderBottomWidth: 1, borderBottomColor: T.divider },
  field         : { flex: 1, gap: 4 },
  fieldWide     : { flex: 1 },
  fieldLbl      : { fontSize: 10, color: T.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  fieldVal      : { fontSize: 14, color: T.dark, fontWeight: '700' },

  /* ── Loan card ── */
  loanCard: {
    backgroundColor: T.white, borderRadius: 20, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 5,
  },
  loanBand: { height: 5 },
  loanContent: { padding: 18 },
  loanRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  loanType : { fontSize: 17, fontWeight: '900', color: T.dark },
  loanAccNo: { fontSize: 11, color: T.muted, fontWeight: '500', marginTop: 3 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusTxt: { fontSize: 11, fontWeight: '700' },

  /* loan hero box */
  loanHeroBox: {
    backgroundColor: '#fafbfc', borderRadius: 14,
    padding: 16, marginBottom: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  loanHeroLbl: { fontSize: 11, color: T.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  loanHeroAmt: { fontSize: 30, fontWeight: '900', color: T.red, letterSpacing: -1, marginBottom: 12 },

  /* progress bar */
  progWrap : { width: '100%', gap: 6 },
  progTrack: { height: 7, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progFill : { height: '100%', borderRadius: 4 },
  progTxt  : { fontSize: 11, color: T.mid, fontWeight: '600', textAlign: 'right' },

  /* loan meta */
  loanMetaRow : { flexDirection: 'row' },
  loanMetaCell: { flex: 1 },
  loanMetaMid : { alignItems: 'center' },
  loanMetaEnd : { alignItems: 'flex-end' },
  loanMetaLbl : { fontSize: 10, color: T.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  loanMetaVal : { fontSize: 14, color: T.dark, fontWeight: '800' },

  /* ── Deposit card ── */
  depCard: {
    backgroundColor: T.white, borderRadius: 20, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  depIconBox  : { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  depIconTxt  : { fontSize: 26 },
  depInfo     : { flex: 1, gap: 5 },
  depType     : { fontSize: 15, fontWeight: '800', color: T.dark },
  depSince    : { fontSize: 12, color: T.muted },
  depRateBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, alignSelf: 'flex-start' },
  depRateTxt  : { fontSize: 11, fontWeight: '700' },
  depAmtCol   : { alignItems: 'flex-end', gap: 3 },
  depAmt      : { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  depAmtLbl   : { fontSize: 11, color: T.muted, fontWeight: '500' },

  /* ── Empty ── */
  empty       : { alignItems: 'center', paddingVertical: 68 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: T.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  emptyIconTxt: { fontSize: 36 },
  emptyTitle  : { fontSize: 18, fontWeight: '800', color: T.dark, marginBottom: 7 },
  emptySub    : { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 20 },
});

export default DashboardScreen;
