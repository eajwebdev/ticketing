import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus, Clock3, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/misc';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', store_name: '', email: '', phone: '', password: '', password_confirmation: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const result = await register(form);
      if (result.approved) {
        toast.success('Account created — welcome to EAJ Support!');
        navigate('/app', { replace: true });
      } else {
        setPending(result.message);
      }
    } catch (err) {
      setErrors(err.response?.data?.errors || { general: [err.response?.data?.message || 'Registration failed'] });
    } finally {
      setLoading(false);
    }
  };

  const field = (name) => errors[name]?.[0];

  if (pending) {
    return (
      <AuthShell
        title="Almost there!"
        subtitle="Your registration is in review."
        footer={<>Questions? <Link to="/" className="font-medium text-crimson-soft hover:underline">Back to home</Link></>}
      >
        <div className="rounded-2xl glass p-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-400">
            <Clock3 className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-white">Awaiting admin approval</h3>
          <p className="mt-2 text-sm text-muted-foreground">{pending}</p>
          <Button className="mt-6 w-full" onClick={() => navigate('/login')}>
            <ArrowLeft /> Go to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your client account"
      subtitle="Submit and track support tickets for your business."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-crimson-soft hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={set('name')} required autoFocus />
            {field('name') && <p className="text-xs text-crimson-soft">{field('name')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="store_name">Store / business name</Label>
            <Input id="store_name" value={form.store_name} onChange={set('store_name')} required />
            {field('store_name') && <p className="text-xs text-crimson-soft">{field('store_name')}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={set('email')} required />
          {field('email') && <p className="text-xs text-crimson-soft">{field('email')}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="phone" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={set('password')} required />
            {field('password') && <p className="text-xs text-crimson-soft">{field('password')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password_confirmation">Confirm password</Label>
            <Input id="password_confirmation" type="password" value={form.password_confirmation} onChange={set('password_confirmation')} required />
          </div>
        </div>
        {errors.general && <p className="text-sm text-crimson-soft">{errors.general[0]}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <><UserPlus /> Create account</>}
        </Button>
      </form>
    </AuthShell>
  );
}
