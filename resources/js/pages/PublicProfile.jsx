import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Clock, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { FullPageLoader } from '@/components/ui/misc';
import { humanizeMinutes } from '@/lib/format';

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/users/${id}/profile`)
      .then((r) => setProfile(r.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <FullPageLoader />;
  if (notFound) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">This profile is not available.</p>
      <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Go back</Button>
    </div>
  );

  const stats = profile.stats ?? {};

  return (
    <div className="min-h-screen">
      <header className="border-b border-navy-600/40 glass">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/"><Logo /></Link>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl glass">
          <div className="grad-brand h-32" />
          <div className="px-8 pb-8">
            <UserAvatar user={profile} className="-mt-14 h-28 w-28 ring-4 ring-navy-800" />
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
              <p className="text-crimson-soft">{profile.position}</p>
              {profile.department && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" /> {profile.department}
                </p>
              )}
            </div>
            {profile.bio && <p className="mt-5 max-w-2xl text-mist/80 leading-relaxed">{profile.bio}</p>}

            <div className="mt-8 grid grid-cols-2 gap-4 sm:max-w-md">
              <div className="rounded-2xl glass p-5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div className="mt-2 text-2xl font-bold text-white">{stats.tickets_resolved ?? 0}</div>
                <div className="text-xs text-muted-foreground">Tickets resolved</div>
              </div>
              <div className="rounded-2xl glass p-5">
                <Clock className="h-5 w-5 text-crimson-soft" />
                <div className="mt-2 text-2xl font-bold text-white">{humanizeMinutes(stats.avg_resolution_minutes)}</div>
                <div className="text-xs text-muted-foreground">Avg resolution</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
