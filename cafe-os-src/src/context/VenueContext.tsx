import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../lib/supabase';
import { Venue } from '../lib/types';

interface VenueContextType {
  venue:        Venue | null;
  slug:         string;
  isLoaded:     boolean;
  logout:       () => void;
  username:     string;
  credentialId: string;
  updateUsername: (newUsername: string) => void;
  updateVenue: (updatedVenue: Venue) => void;
}

const VenueContext = createContext<VenueContextType>({
  venue: null, slug: '', isLoaded: false, logout: () => {},
  username: '', credentialId: '', updateUsername: () => {},
  updateVenue: () => {},
});

export function VenueProvider({ children }: { children: ReactNode }) {
  const [venue,    setVenue]    = useState<Venue | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [username,     setUsername]     = useState('');
  const [credentialId, setCredentialId] = useState('');

  const getSlugFromUrl = () => {
    const searchSlug = new URLSearchParams(window.location.search).get('slug');
    if (searchSlug) return searchSlug;
    
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[parts.length - 1] === 'admin') {
      return parts[parts.length - 2];
    }
    return '';
  };
  const slug = getSlugFromUrl();

  useEffect(() => {
    const sessionKey = `snyf_admin_session_${slug}`;
    const stored     = localStorage.getItem(sessionKey);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data && data.venue) {
          setVenue(data.venue);
          setUsername(data.username || '');
          setCredentialId(data.credentialId || '');
        }
      } catch {}
    }
    setIsLoaded(true);
  }, [slug]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { data: cred, error: credErr } = await db
        .from('venue_credentials')
        .select('venue_id, password_hash')
        .eq('username', username)
        .single();

      if (credErr || !cred) return false;

      // Direct comparison for now — replace with bcrypt RPC before live partner launch
      if (cred.password_hash !== password) return false;

      const { data: venueData, error: venueErr } = await db
        .from('venues')
        .select('*')
        .eq('id', cred.venue_id)
        .eq('status', 'active')
        .single();

      if (venueErr || !venueData) return false;
      // Skip slug check when running as a PWA (slug is empty — app opened from home screen)
      if (slug && venueData.slug !== slug) return false;

      setVenue(venueData as Venue);
      
      // Fetch and store credential info for password changes
      const { data: credData } = await db
        .from('venue_credentials')
        .select('id, username')
        .eq('venue_id', cred.venue_id)
        .single();

      const credUsername = credData ? credData.username : username;
      const credId = credData ? credData.id : '';

      if (credData) {
        setUsername(credData.username);
        setCredentialId(credData.id);
      }

      const sessionData = {
        venue: venueData,
        username: credUsername,
        credentialId: credId
      };
      localStorage.setItem(`snyf_admin_session_${slug}`, JSON.stringify(sessionData));
      return true;

    } catch { return false; }
  };

  const logout = () => {
    setVenue(null);
    setUsername('');
    setCredentialId('');
    localStorage.removeItem(`snyf_admin_session_${slug}`);
    window.location.reload();
  };

  const updateUsername = (newUsername: string) => {
    setUsername(newUsername);
    const sessionKey = `snyf_admin_session_${slug}`;
    const stored = localStorage.getItem(sessionKey);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        data.username = newUsername;
        localStorage.setItem(sessionKey, JSON.stringify(data));
      } catch {}
    }
  };

  const updateVenue = (updatedVenue: Venue) => {
    setVenue(updatedVenue);
    const sessionKey = `snyf_admin_session_${slug}`;
    const stored = localStorage.getItem(sessionKey);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        data.venue = updatedVenue;
        localStorage.setItem(sessionKey, JSON.stringify(data));
      } catch {}
    }
  };

  return (
    <VenueContext.Provider value={{ venue, slug, isLoaded, logout, username, credentialId, updateUsername, updateVenue }}>
      {!isLoaded ? (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Loading Café OS...</p>
          </div>
        </div>
      ) : !venue ? (
        <LoginScreen slug={slug} onLogin={login} />
      ) : (
        children
      )}
    </VenueContext.Provider>
  );
}

export const useVenue = () => useContext(VenueContext);

// ── Login Screen ─────────────────────────────────────────────
function LoginScreen({
  slug,
  onLogin,
}: {
  slug:    string;
  onLogin: (u: string, p: string) => Promise<boolean>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Fill in both fields'); return; }
    setLoading(true);
    setError('');
    const ok = await onLogin(username, password);
    if (!ok) setError('Invalid credentials. Check your username and password.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-3xl font-bold mb-1">
            <span className="text-primary">SNYF</span> Café OS
          </div>
          <div className="text-sm text-muted-foreground font-mono tracking-widest uppercase">
            Venue Admin · {slug || 'Unknown'}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder=""
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder=""
                  className="w-full px-4 py-3 pr-14 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 font-mono">
          SNYF · VENUE PARTNER ACCESS ONLY
        </p>
      </div>
    </div>
  );
}
