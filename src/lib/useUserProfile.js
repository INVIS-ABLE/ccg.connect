import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useUserProfile() {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await base44.auth.me();
        if (!me) { setLoading(false); return; }
        const profiles = await base44.entities.UserProfile.filter({ user_id: me.id });
        if (profiles.length > 0) {
          setUserProfile({ ...profiles[0], email: me.email, full_name: me.full_name });
        } else {
          // New user — no profile yet
          setUserProfile({ user_id: me.id, email: me.email, full_name: me.full_name, role: 'contractor' });
        }
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { userProfile, loading, error };
}