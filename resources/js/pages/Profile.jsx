import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Camera, Save } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { BUSINESS_TYPE_SUGGESTIONS } from '@/lib/businessTypes';
import { UserAvatar } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/misc';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const isTeam = user.role !== 'customer';
  const fileRef = useRef(null);
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(user.avatar_url);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user.name ?? '', phone: user.phone ?? '', bio: user.bio ?? '',
    position: user.position ?? '', department: user.department ?? '',
    store_name: user.store_name ?? '', business_types: user.business_types ?? [],
    address: user.address ?? '', contact_person: user.contact_person ?? '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onAvatar = (e) => {
    const f = e.target.files[0];
    if (f) { setAvatar(f); setPreview(URL.createObjectURL(f)); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        // multipart arrays: name[]=a&name[]=b; an empty value clears the list
        if (v.length) v.forEach((x) => fd.append(`${k}[]`, x));
        else fd.append(k, '');
      } else fd.append(k, v ?? '');
    });
    if (avatar) fd.append('avatar', avatar);
    fd.append('_method', 'PATCH');
    try {
      const { data } = await api.post('/me', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser(data);
      toast.success('Profile updated.');
    } catch {
      toast.error('Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update your information{isTeam ? ' — this appears on your public profile.' : '.'}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="relative">
                <UserAvatar user={{ ...user, avatar_url: preview }} className="h-20 w-20" />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-crimson p-2 text-white shadow-lg transition-transform hover:scale-110">
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
              </div>
              <div>
                <div className="font-semibold text-white">{user.name}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name"><Input value={form.name} onChange={set('name')} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={set('phone')} /></Field>
            </div>

            {isTeam ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Position / title"><Input value={form.position} onChange={set('position')} /></Field>
                  <Field label="Department"><Input value={form.department} onChange={set('department')} /></Field>
                </div>
                <Field label="Bio"><Textarea rows={4} value={form.bio} onChange={set('bio')} placeholder="Tell clients a little about you…" /></Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Store / business name"><Input value={form.store_name} onChange={set('store_name')} /></Field>
                  <Field label="Contact person"><Input value={form.contact_person} onChange={set('contact_person')} /></Field>
                </div>
                <Field label="Address"><Input value={form.address} onChange={set('address')} /></Field>
                <Field label="Business types">
                  <TagInput value={form.business_types} onChange={(v) => setForm({ ...form, business_types: v })}
                    placeholder="e.g. Laundry Shop — press Enter to add" suggestions={BUSINESS_TYPE_SUGGESTIONS} />
                </Field>
              </>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <><Save /> Save changes</>}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
