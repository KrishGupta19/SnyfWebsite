import { Bell, Search, Sun, Moon, LogOut, Copy, Check, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useVenue } from '../../context/VenueContext';
import { db } from '../../lib/supabase';

export function TopBar() {
  const [isDark, setIsDark] = useState(false);
  const { venue, slug, logout } = useVenue();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setIsNotificationsOpen(false);
      setIsProfileOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (!venue?.id) return;
    loadNotifications();

    const channel = db.channel('topbar-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${venue.id}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [venue?.id]);

  async function loadNotifications() {
    if (!venue?.id) return;
    try {
      const { data, error } = await db
        .from('orders')
        .select('id, table_num, status, special_instructions, total, created_at')
        .eq('venue_id', venue.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const items: any[] = [];

      (data || []).forEach(o => {
        // 1. Help calls
        if (o.special_instructions?.includes('[HELP REQUESTED]')) {
          items.push({
            id: `help-${o.id}`,
            type: 'help',
            title: `Table ${o.table_num || '?'} Needs Help`,
            desc: `Waiter called from table`,
            time: formatTimeAgo(o.created_at),
            order: o,
          });
        }
        // 2. New pending orders
        if (o.status === 'received') {
          items.push({
            id: `order-${o.id}`,
            type: 'order',
            title: `New Order #${o.id.slice(-4).toUpperCase()}`,
            desc: `Table ${o.table_num || 'Self'} • ₹${(o.total || 0).toLocaleString('en-IN')}`,
            time: formatTimeAgo(o.created_at),
            order: o,
          });
        }
      });

      setNotifications(items);
    } catch (err) {
      console.error('[TopBar] loadNotifications:', err);
    }
  }

  function formatTimeAgo(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  async function dismissHelpCall(order: any) {
    if (!order.special_instructions) return;
    let updatedInstr = order.special_instructions
      .replace('| [HELP REQUESTED]', '')
      .replace('[HELP REQUESTED]', '')
      .trim();
    if (updatedInstr.endsWith('|')) updatedInstr = updatedInstr.slice(0, -1).trim();
    if (updatedInstr.startsWith('|')) updatedInstr = updatedInstr.slice(1).trim();

    try {
      const { error } = await db
        .from('orders')
        .update({ special_instructions: updatedInstr || null })
        .eq('id', order.id);
      if (error) throw error;
      loadNotifications();
    } catch (err) {
      console.error('[TopBar] dismissHelpCall:', err);
    }
  }

  const copyVenueId = () => {
    if (!venue?.id) return;
    navigator.clipboard.writeText(venue.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 select-none">
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp {
          animation: slideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="h-full px-6 flex items-center justify-between">

        {/* Left — search */}
        <div className="flex items-center gap-4 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
        </div>

        {/* Center — venue name */}
        <div className="flex-1 text-center">
          <span className="text-sm font-semibold">{venue?.name || 'Café OS'}</span>
          <span className="text-xs text-muted-foreground ml-2 font-mono hidden sm:inline">
            /{slug}/admin
          </span>
        </div>

        {/* Right — actions */}
        <div className="flex-1 flex items-center justify-end gap-3">
          
          {/* Bell Notifications */}
          <div className="relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
              }}
              className="p-2 hover:bg-accent rounded-lg transition-colors relative cursor-pointer"
            >
              {notifications.length > 0 && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full animate-pulse" />
              )}
              <Bell className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>

            {/* Notification Dropdown */}
            {isNotificationsOpen && (
              <div 
                className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-slideUp"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">Notifications</span>
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-semibold">
                    {notifications.length} Active
                  </span>
                </div>

                <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground italic">
                      No new alerts or help requests.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-accent/30 transition-colors">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            {n.type === 'help' && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                            )}
                            <span className="font-bold text-xs text-foreground">{n.title}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{n.desc}</p>
                          <span className="text-[10px] text-muted-foreground font-medium block">{n.time}</span>
                        </div>
                        {n.type === 'help' && (
                          <button
                            onClick={() => dismissHelpCall(n.order)}
                            className="text-[10px] px-2.5 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg font-semibold transition-colors cursor-pointer"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="p-2 hover:bg-accent rounded-lg transition-colors cursor-pointer">
            {isDark ? <Sun className="w-5 h-5 text-muted-foreground hover:text-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground hover:text-foreground" />}
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
              }}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition-all select-none"
            >
              <span className="text-xs font-semibold text-white">
                {venue?.name?.[0]?.toUpperCase() || 'S'}
              </span>
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div 
                className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-slideUp p-2 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Active Venue</span>
                  <div className="font-bold text-sm text-foreground truncate">{venue?.name || 'Cafe Venue'}</div>
                  <div className="flex items-center justify-between gap-2 text-xs bg-background/50 p-1.5 rounded-lg border border-border/40">
                    <span className="font-mono text-[10px] text-muted-foreground truncate select-all">{venue?.id}</span>
                    <button 
                      onClick={copyVenueId}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Copy Venue ID"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <a
                    href={`http://localhost:8000/venue.html?slug=${slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 hover:bg-accent/40 rounded-xl text-xs font-semibold text-foreground transition-colors"
                  >
                    <span>View Customer Menu</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>

                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-red-500/10 text-red-500 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer"
                  >
                    <span>Log Out</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
