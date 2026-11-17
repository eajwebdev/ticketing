import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { LogIn, Eye, EyeOff, Mail, Lock, Clock3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthShell } from './AuthShell';
import { GoogleSignInButton, OrDivider } from '@/components/auth/GoogleSignInButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/misc';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [forgot, setForgot] = useState(false);

  const done = () => {
    toast.success('Welcome back!');
    navigate(location.state?.from?.pathname || '/app', { replace: true });
  };

  const google = async (credential) => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await loginWithGoogle(credential);
      if (result.approved) done();
      else setNotice(result.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await login(form.email, form.password);
      done();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to create tickets and chat with the EAJ team."
      footer={<>New to EAJ Support? <Link to="/register" className="font-medium text-crimson-soft hover:underline">Create a client account</Link></>}
    >
      {/* Google first — fastest way in for clients */}
      <div className="space-y-2">
        <GoogleSignInButton onCredential={google} disabled={loading} onUnavailable={(m) => toast.info(m)} />
        <p className="text-center text-[11px] text-muted-foreground">
          New here? Continuing with Google creates your account — EAJ approves it before your first sign-in.
        </p>
      </div>

      {notice && (
        <div className="mt-5 flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="my-6"><OrDivider label="or sign in with email" /></div>

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" onClick={() => setForgot((v) => !v)} className="text-xs text-crimson-soft hover:underline">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="px-10" />
            <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-mist">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {forgot && (
            <p className="rounded-lg bg-navy-800/60 p-2.5 text-xs text-muted-foreground">
              If your email is a Google account, just use <span className="text-mist">Continue with Google</span> above.
              Otherwise contact the EAJ team — an admin will send you a new temporary password.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-crimson-soft">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <><LogIn /> Sign in</>}
        </Button>
      </form>
    </AuthShell>
  );
}
