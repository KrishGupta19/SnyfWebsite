import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../lib/supabase';
import { Venue } from '../lib/types';

interface VenueContextType {
  venue:    Venue | null;
  slug:     string;
  isLoaded: boolean;
  logout:   () => void;
}

const VenueContext = createContext<VenueContextType>({
  venue: null, slug: '', isLoaded: false, logout: () => {},
});

export function VenueProvider({ children }: { children: ReactNode }) {
  const [venue,    setVenue]    = useState<Venue | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
    const sessionKey = `snyf_admin_${slug}`;
    const stored     = sessionStorage.getItem(sessionKey);
    if (stored) {
      try { setVenue(JSON.parse(stored)); } catch {}
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
      if (venueData.slug !== slug)   return false;

      setVenue(venueData as Venue);
      sessionStorage.setItem(`snyf_admin_${slug}`, JSON.stringify(venueData));
      return true;

    } catch { return false; }
  };

  const logout = () => {
    setVenue(null);
    sessionStorage.removeItem(`snyf_admin_${slug}`);
    window.location.reload();
  };

  return (
    <VenueContext.Provider value={{ venue, slug, isLoaded, logout }}>
      {!venue && isLoaded
        ? <LoginScreen slug={slug} onLogin={login} />
        : children
      }
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
                placeholder={`${slug}_admin`}
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
                  placeholder="••••••••••"
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
