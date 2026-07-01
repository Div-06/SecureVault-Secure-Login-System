import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Menu,
  Shield,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';

const API_BASE = '/api';

async function request(path, { method = 'GET', body, token, csrfToken } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('securevault.token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('securevault.user') || 'null');
    } catch {
      return null;
    }
  });
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    request('/csrf-token').then((data) => setCsrfToken(data.csrfToken)).catch(() => {});
  }, []);

  const saveSession = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem('securevault.user', JSON.stringify(nextUser));
    localStorage.setItem('securevault.token', nextToken);
  };

  const clearSession = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('securevault.user');
    localStorage.removeItem('securevault.token');
  };

  const api = (path, options = {}) => request(path, { ...options, token, csrfToken });

  return { user, token, csrfToken, api, saveSession, clearSession, setUser };
}

function Shell({ auth, children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const links = [
    ['Dashboard', '/dashboard', Activity],
    ['Profile', '/profile', User],
    ['Security', '/security', ShieldCheck],
  ];

  const logout = async () => {
    try {
      await auth.api('/auth/logout', { method: 'POST' });
    } catch {}
    auth.clearSession();
    navigate('/login');
  };

  const nav = (
    <nav className="flex flex-col gap-2">
      {links.map(([label, href, Icon]) => (
        <Link key={href} to={href} onClick={() => setOpen(false)} className={`sidebar-item ${location.pathname === href ? 'active' : ''}`}>
          <Icon size={18} /> {label}
        </Link>
      ))}
      <button type="button" onClick={logout} className="sidebar-item mt-4 text-left">
        <LogOut size={18} /> Sign out
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-dark-950 cyber-grid">
      <header className="sticky top-0 z-30 border-b border-cyber-500/20 bg-dark-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-3 font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyber-500/40 bg-cyber-500/10"><Shield size={22} /></span>
            <span>SecureVault</span>
          </Link>
          <button className="rounded-lg border border-cyber-500/30 p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-3 text-sm text-dark-300 md:flex">
            <span className="status-online" /> {auth.user?.email}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        <aside className="sidebar-desktop glass-dark h-fit rounded-lg p-3">{nav}</aside>
        <main>{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-dark-950/80 md:hidden">
          <div className="glass-dark h-full w-72 p-4">
            <button className="mb-4 rounded-lg border border-cyber-500/30 p-2" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-dark-950 cyber-grid px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-lg border border-cyber-500/20 bg-dark-900/80 md:grid-cols-[1fr_420px]">
          <section className="hidden p-10 md:block">
            <div className="mb-8 inline-flex items-center gap-3 rounded-lg border border-cyber-500/25 px-4 py-3">
              <Shield className="text-cyber-400" /> <span className="font-semibold">SecureVault</span>
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-tight">Secure login control center</h1>
            <p className="max-w-md text-dark-300">Account protection with hashed passwords, JWT sessions, CSRF checks, TOTP verification, login history, and audit trails.</p>
            <div className="mt-10 grid gap-3 text-sm text-dark-300">
              {['bcrypt password storage', 'session-backed CSRF tokens', 'two-factor authentication', 'audit and login history'].map((item) => (
                <div key={item} className="flex items-center gap-3"><CheckCircle2 className="text-neon-green" size={18} /> {item}</div>
              ))}
            </div>
          </section>
          <section className="p-6 md:p-8">{children}</section>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, type = 'text', ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-dark-300">{props.label}</span>
      <span className="relative block">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />}
        <input {...props} type={isPassword && show ? 'text' : type} className={`input-cyber w-full rounded-lg px-4 py-3 ${Icon ? 'pl-10' : ''} ${isPassword ? 'pr-10' : ''}`} />
        {isPassword && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
    </label>
  );
}

function PasswordStrength({ value }) {
  const checks = [value.length >= 8, /[A-Z]/.test(value), /[a-z]/.test(value), /\d/.test(value), /[^A-Za-z\d]/.test(value)];
  const score = checks.filter(Boolean).length;
  const label = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][score];
  return (
    <div>
      <div className="mb-2 flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded ${i < score ? 'bg-cyber-400' : 'bg-dark-700'}`} />)}
      </div>
      <p className="text-xs text-dark-400">{label}</p>
    </div>
  );
}

function Login({ auth }) {
  const [form, setForm] = useState({ email: '', password: '', token: '' });
  const [pending2fa, setPending2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = pending2fa
        ? await auth.api('/2fa/login-verify', { method: 'POST', body: { token: form.token } })
        : await auth.api('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } });
      if (data.requires2fa) {
        setPending2fa(true);
        toast.success('Enter your authenticator code');
      } else {
        auth.saveSession(data.user, data.token);
        toast.success('Welcome back');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-2 text-2xl font-bold">{pending2fa ? 'Verify code' : 'Sign in'}</h2>
      <p className="mb-6 text-sm text-dark-300">{pending2fa ? 'Open your authenticator app and enter the 6-digit code.' : 'Access your protected dashboard.'}</p>
      <form onSubmit={submit} className="space-y-4">
        {pending2fa ? (
          <Field label="Authenticator code" icon={KeyRound} value={form.token} maxLength={6} onChange={(e) => setForm({ ...form, token: e.target.value })} required />
        ) : (
          <>
            <Field label="Email" icon={Mail} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Field label="Password" icon={Lock} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </>
        )}
        <button disabled={loading || !auth.csrfToken} className="btn-cyber w-full rounded-lg px-4 py-3">{loading ? 'Working...' : pending2fa ? 'Verify and sign in' : 'Sign in'}</button>
      </form>
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-dark-300">
        <Link className="text-cyber-300" to="/register">Create account</Link>
        <Link className="text-cyber-300" to="/forgot-password">Forgot password?</Link>
      </div>
    </AuthLayout>
  );
}

function Register({ auth }) {
  const [form, setForm] = useState({ full_name: '', username: '', email: '', password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await auth.api('/auth/register', { method: 'POST', body: form });
      auth.saveSession(data.user, data.token);
      toast.success('Account created');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-2 text-2xl font-bold">Create account</h2>
      <p className="mb-6 text-sm text-dark-300">Start with a strong password and a verified identity profile.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" icon={User} value={form.full_name} onChange={set('full_name')} required />
        <Field label="Username" icon={UserPlus} value={form.username} onChange={set('username')} required />
        <Field label="Email" icon={Mail} type="email" value={form.email} onChange={set('email')} required />
        <Field label="Password" icon={Lock} type="password" value={form.password} onChange={set('password')} required />
        <PasswordStrength value={form.password} />
        <Field label="Confirm password" icon={Lock} type="password" value={form.confirm_password} onChange={set('confirm_password')} required />
        <button disabled={loading || !auth.csrfToken} className="btn-cyber w-full rounded-lg px-4 py-3">{loading ? 'Creating...' : 'Create account'}</button>
      </form>
      <p className="mt-6 text-sm text-dark-300">Already registered? <Link className="text-cyber-300" to="/login">Sign in</Link></p>
    </AuthLayout>
  );
}

function Dashboard({ auth }) {
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [session, setSession] = useState(null);

  useEffect(() => {
    Promise.all([
      auth.api('/session'),
      auth.api('/session/history'),
      auth.api('/session/audit'),
    ]).then(([sessionData, historyData, auditData]) => {
      setSession(sessionData.session);
      setHistory(historyData.history);
      setLogs(auditData.logs);
    }).catch((err) => toast.error(err.message));
  }, []);

  const cards = [
    ['Account', auth.user?.email, User],
    ['2FA', auth.user?.two_factor_enabled ? 'Enabled' : 'Not enabled', ShieldCheck],
    ['Session', session?.authenticated ? 'Active' : 'Checking', Activity],
  ];

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-3xl font-bold">Security overview</h1>
        <p className="mt-2 text-dark-300">Welcome, {auth.user?.full_name || auth.user?.username}.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="card-cyber rounded-lg p-5">
            <Icon className="mb-4 text-cyber-300" />
            <p className="text-sm text-dark-400">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <DataTable title="Login history" icon={History} rows={history} columns={['status', 'device_type', 'ip_address', 'created_at']} />
      <DataTable title="Audit logs" icon={Activity} rows={logs} columns={['action', 'details', 'ip_address', 'created_at']} />
    </div>
  );
}

function DataTable({ title, icon: Icon, rows, columns }) {
  return (
    <section className="overflow-hidden rounded-lg border border-cyber-500/15 bg-dark-900/70">
      <div className="flex items-center gap-3 border-b border-cyber-500/15 px-4 py-3">
        <Icon className="text-cyber-300" size={18} /> <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="table-cyber">
          <thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.id}>{columns.map((column) => <td key={column}>{formatValue(row[column])}</td>)}</tr>
            )) : <tr><td colSpan={columns.length}>No records yet</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatValue(value) {
  if (!value) return '-';
  if (String(value).includes('T') || String(value).match(/^\d{4}-\d{2}-\d{2}/)) return new Date(value).toLocaleString();
  return String(value);
}

function Profile({ auth }) {
  const [form, setForm] = useState({ full_name: auth.user?.full_name || '', username: auth.user?.username || '' });
  const [password, setPassword] = useState({ current_password: '', new_password: '' });

  const updateProfile = async (event) => {
    event.preventDefault();
    try {
      const data = await auth.api('/profile', { method: 'PUT', body: form });
      auth.setUser(data.user);
      localStorage.setItem('securevault.user', JSON.stringify(data.user));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    try {
      await auth.api('/profile/change-password', { method: 'PUT', body: password });
      setPassword({ current_password: '', new_password: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={updateProfile} className="rounded-lg border border-cyber-500/15 bg-dark-900/70 p-5">
        <h1 className="mb-5 text-2xl font-bold">Profile</h1>
        <div className="space-y-4">
          <Field label="Full name" icon={User} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          <Field label="Username" icon={UserPlus} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <button className="btn-cyber rounded-lg px-4 py-3">Save profile</button>
        </div>
      </form>
      <form onSubmit={changePassword} className="rounded-lg border border-cyber-500/15 bg-dark-900/70 p-5">
        <h2 className="mb-5 text-2xl font-bold">Change password</h2>
        <div className="space-y-4">
          <Field label="Current password" icon={Lock} type="password" value={password.current_password} onChange={(e) => setPassword({ ...password, current_password: e.target.value })} required />
          <Field label="New password" icon={Lock} type="password" value={password.new_password} onChange={(e) => setPassword({ ...password, new_password: e.target.value })} required />
          <PasswordStrength value={password.new_password} />
          <button className="btn-cyber rounded-lg px-4 py-3">Change password</button>
        </div>
      </form>
    </div>
  );
}

function Security({ auth }) {
  const [setup, setSetup] = useState(null);
  const [token, setToken] = useState('');
  const enabled = Boolean(auth.user?.two_factor_enabled);

  const start = async () => {
    try {
      setSetup(await auth.api('/2fa/enable', { method: 'POST' }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const verify = async () => {
    try {
      await auth.api('/2fa/verify', { method: 'POST', body: { token } });
      const profile = await auth.api('/profile');
      auth.setUser(profile.user);
      localStorage.setItem('securevault.user', JSON.stringify(profile.user));
      setSetup(null);
      setToken('');
      toast.success('2FA enabled');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const disable = async () => {
    try {
      await auth.api('/2fa/disable', { method: 'POST' });
      const profile = await auth.api('/profile');
      auth.setUser(profile.user);
      localStorage.setItem('securevault.user', JSON.stringify(profile.user));
      toast.success('2FA disabled');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security</h1>
        <p className="mt-2 text-dark-300">Manage authenticator protection for this account.</p>
      </div>
      <section className="rounded-lg border border-cyber-500/15 bg-dark-900/70 p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-dark-300">{enabled ? 'Your account requires an authenticator code at login.' : 'Add a second step to protect password logins.'}</p>
          </div>
          {enabled ? <button onClick={disable} className="rounded-lg border border-red-400/40 px-4 py-3 text-red-200">Disable</button> : <button onClick={start} className="btn-cyber rounded-lg px-4 py-3">Enable</button>}
        </div>
        {setup && (
          <div className="grid gap-5 md:grid-cols-[220px_1fr]">
            <div className="qr-container"><img src={setup.qrCode} alt="2FA QR code" /></div>
            <div className="space-y-4">
              <p className="text-sm text-dark-300">Scan the QR code, then enter the 6-digit code from your authenticator app.</p>
              <code className="block break-all rounded-lg bg-dark-950 p-3 text-sm text-cyber-200">{setup.secret}</code>
              <Field label="Verification code" icon={KeyRound} value={token} maxLength={6} onChange={(e) => setToken(e.target.value)} />
              <button onClick={verify} className="btn-cyber rounded-lg px-4 py-3">Verify code</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ForgotPassword({ auth }) {
  const [email, setEmail] = useState('');
  const [devUrl, setDevUrl] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    try {
      const data = await auth.api('/auth/forgot-password', { method: 'POST', body: { email } });
      setDevUrl(data.devResetUrl || '');
      toast.success(data.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-2 text-2xl font-bold">Reset password</h2>
      <p className="mb-6 text-sm text-dark-300">Request a one-hour password reset link.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn-cyber w-full rounded-lg px-4 py-3">Send reset link</button>
      </form>
      {devUrl && <Link className="mt-5 block break-all rounded-lg border border-cyber-500/25 p-3 text-sm text-cyber-200" to={new URL(devUrl).pathname + new URL(devUrl).search}>Open dev reset link</Link>}
    </AuthLayout>
  );
}

function ResetPassword({ auth }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryToken = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const [form, setForm] = useState({ token: queryToken, password: '' });

  const submit = async (event) => {
    event.preventDefault();
    try {
      await auth.api('/auth/reset-password', { method: 'POST', body: form });
      toast.success('Password reset complete');
      navigate('/login');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-2 text-2xl font-bold">Choose a new password</h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Reset token" icon={KeyRound} value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} required />
        <Field label="New password" icon={Lock} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <PasswordStrength value={form.password} />
        <button className="btn-cyber w-full rounded-lg px-4 py-3">Reset password</button>
      </form>
    </AuthLayout>
  );
}

function Landing({ auth }) {
  return auth.token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function Protected({ auth, children }) {
  if (!auth.token) return <Navigate to="/login" replace />;
  return <Shell auth={auth}>{children}</Shell>;
}

export default function App() {
  const auth = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Landing auth={auth} />} />
      <Route path="/login" element={<Login auth={auth} />} />
      <Route path="/register" element={<Register auth={auth} />} />
      <Route path="/forgot-password" element={<ForgotPassword auth={auth} />} />
      <Route path="/reset-password" element={<ResetPassword auth={auth} />} />
      <Route path="/dashboard" element={<Protected auth={auth}><Dashboard auth={auth} /></Protected>} />
      <Route path="/profile" element={<Protected auth={auth}><Profile auth={auth} /></Protected>} />
      <Route path="/security" element={<Protected auth={auth}><Security auth={auth} /></Protected>} />
      <Route path="*" element={<AuthLayout><h1 className="text-3xl font-bold">Page not found</h1><Link className="mt-4 inline-block text-cyber-300" to="/">Return home</Link></AuthLayout>} />
    </Routes>
  );
}
