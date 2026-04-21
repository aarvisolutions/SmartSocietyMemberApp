import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://fair-hoops-scream.loca.lt';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
});

// Attach token to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginApi = async (memberId, password) => {
  const response = await api.post('api/auth/login', {
    username: String(memberId),
    password,
    userType: 'member',
  });
  const data = response.data?.data ?? response.data;
  return {
    token: data.accessToken,
    memberId: data.user?.memberId ?? data.user?.username ?? memberId,
    user: data.user,
  };
};

const unwrap = (res) => res?.data?.data ?? res?.data ?? {};
const unwrapArray = (res) => {
  const d = res?.data?.data ?? res?.data;
  return Array.isArray(d) ? d : [];
};

export const getMemberApi = async (memberId) => {
  const [memberRes, loanBalRes, depositsRes, loansRes] = await Promise.allSettled([
    api.get(`api/members/${memberId}`),
    api.get(`api/members/${memberId}/loan-balances`),
    api.get(`api/members/${memberId}/deposits`),
    api.get(`api/loans/master/member/${memberId}`),
  ]);

  const member   = memberRes.status   === 'fulfilled' ? unwrap(memberRes.value)       : {};
  const loanBal  = loanBalRes.status  === 'fulfilled' ? unwrap(loanBalRes.value)       : {};
  const rawDeps  = depositsRes.status === 'fulfilled' ? unwrapArray(depositsRes.value) : [];
  const rawLoans = loansRes.status    === 'fulfilled' ? unwrapArray(loansRes.value)    : [];

  console.log('[loanBal]', loanBal);
  console.log('[rawDeps]', rawDeps);
  console.log('[rawLoans]', rawLoans);

  const LOAN_LABEL = { '112': 'MT Loan', '113': 'ST Loan' };

  const loans = rawLoans.map((l) => ({
    loanType:        LOAN_LABEL[l.id?.loanType] ?? l.id?.loanType ?? '—',
    status:          l.status,
    sanctionAmount:  l.sanctionAmt    ?? 0,
    outstandingAmount: l.currentBal   ?? 0,
    emiAmount:       l.monthlyInstlAmt ?? 0,
    sanctionDate:    l.sanctionDate,
    id:              l.id,
  }));

  const deposits = rawDeps.map((d) => ({
    type:        d.depDesc,
    depositType: d.depDesc,
    openDate:    d.depositDate,
    balance:     Number(d.curAmt)  ?? 0,
    roi:         d.roi ?? 0,
  }));

  return {
    ...member,
    loans,
    deposits,
    balances: {
      stLoan: loanBal.stLoanBalance  ?? 0,
      mtLoan: loanBal.mtLoanBalance  ?? 0,
      thrift: loanBal.thriftBalance  ?? 0,
      mbf:    loanBal.mbfBalance     ?? 0,
    },
  };
};

export const sendOtpApi = async (memberId) => {
  const response = await api.post('api/auth/send-otp', { memberId: String(memberId) });
  return response.data?.data ?? response.data;
};

export const verifyOtpApi = async (memberId, otp) => {
  const response = await api.post('api/auth/verify-otp', {
    memberId: String(memberId),
    otp: String(otp),
  });
  const data = response.data?.data ?? response.data;
  return {
    token:    data.token    ?? data.accessToken,
    memberId: data.memberId ?? data.user?.memberId ?? memberId,
  };
};

export default api;
