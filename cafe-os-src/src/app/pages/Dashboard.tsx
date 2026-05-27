import { useEffect, useState } from 'react';
import { TrendingUp, Users, ShoppingBag, Activity } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';

export function Dashboard() {
  const { venue } = useVenue();

  const [stats, setStats] = useState({
    todayOrders:   0,
    todayRevenue:  0,
    activeOrders:  0,
    totalOrders:   0,
    totalRevenue:  0,
    menuItems:     0,
    totalVisits:   0,
    weekRevenue:   0,
  });

  const [recentActivity, setRecentActivity] = useState<{
    action: string; details: string; time: string;
  }[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venue?.id) return;
    loadStats();
  }, [venue?.id]);

  async function loadStats() {
    if (!venue?.id) return;
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    try {
      const [todayRes, allRes, menuRes, visitsRes, weekRes, recentRes] =
        await Promise.all([
          // Today's orders
          db.from('orders').select('total, status, created_at, items')
            .eq('venue_id', venue.id)
            .gte('created_at', today.toISOString()),
          // All time orders
          db.from('orders').select('total')
            .eq('venue_id', venue.id),
          // Menu items
          db.from('menu_items').select('id')
            .eq('venue_id', venue.id)
            .eq('available', true),
          // Total visits
          db.from('visits').select('id')
            .eq('venue_id', venue.id),
          // This week's orders
          db.from('orders').select('total')
            .eq('venue_id', venue.id)
            .gte('created_at', weekAgo.toISOString()),
          // Recent orders for activity feed
          db.from('orders').select('id, total, status, created_at, items')
            .eq('venue_id', venue.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

      const todayOrders  = todayRes.data  || [];
      const allOrders    = allRes.data    || [];
      const menuItems    = menuRes.data   || [];
      const visits       = visitsRes.data || [];
      const weekOrders   = weekRes.data   || [];
      const recentOrders = recentRes.data || [];

      setStats({
        todayOrders:  todayOrders.length,
        todayRevenue: todayOrders.reduce((s, o) => s + (o.total || 0), 0),
        activeOrders: todayOrders.filter(o =>
          o.status === 'received' || o.status === 'delivered'
        ).length,
        totalOrders:  allOrders.length,
        totalRevenue: allOrders.reduce((s, o) => s + (o.total || 0), 0),
        menuItems:    menuItems.length,
        totalVisits:  visits.length,
        weekRevenue:  weekOrders.reduce((s, o) => s + (o.total || 0), 0),
      });

      // Build activity feed from recent orders
      setRecentActivity(
        recentOrders.map(o => {
          const itemNames = (o.items || []).slice(0, 2).map((i: any) => i.name).join(', ');
          const minsAgo   = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
          return {
            action:  `Order ${o.status === 'delivered' ? 'completed' : 'received'}`,
            details: `${itemNames}${(o.items||[]).length > 2 ? ` +${(o.items||[]).length - 2} more` : ''} — ₹${(o.total||0).toLocaleString('en-IN')}`,
            time:    minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo/60)}h ago`,
          };
        })
      );

    } catch (err) {
      console.error('[Dashboard] loadStats:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Sparkline placeholder data ───────────────────────────────
  const sparkline = [
    { v: 30 }, { v: 42 }, { v: 35 }, { v: 55 },
    { v: 49 }, { v: 62 }, { v: 70 }, { v: 65 }, { v: 75 },
  ];

  // ── Metrics — NO trust scores ─────────────────────────────────
  const metrics = [
    {
      label: "Total Revenue",
      value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
      change: "All time",
      trend: "neutral",
      icon: TrendingUp,
    },
    {
      label: "This Week",
      value: `₹${stats.weekRevenue.toLocaleString('en-IN')}`,
      change: "Last 7 days",
      trend: "up",
      icon: TrendingUp,
    },
    {
      label: "Today's Revenue",
      value: `₹${stats.todayRevenue.toLocaleString('en-IN')}`,
      change: "Today",
      trend: "up",
      icon: TrendingUp,
    },
    {
      label: "Total Orders",
      value: stats.totalOrders.toString(),
      change: "All time",
      trend: "neutral",
      icon: ShoppingBag,
    },
    {
      label: "Today's Orders",
      value: stats.todayOrders.toString(),
      change: "Today",
      trend: "neutral",
      icon: ShoppingBag,
    },
    {
      label: "Active Orders",
      value: stats.activeOrders.toString(),
      change: "Live",
      trend: "neutral",
      icon: Activity,
    },
    {
      label: "Total Visits",
      value: stats.totalVisits.toLocaleString('en-IN'),
      change: "Via Snyf",
      trend: "up",
      icon: Users,
    },
    {
      label: "Menu Items",
      value: stats.menuItems.toString(),
      change: "Available",
      trend: "neutral",
      icon: Activity,
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1>Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Real-time insights into your café's performance
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Metric cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <metric.icon className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  metric.trend === 'up'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {metric.change}
                </span>
              </div>
              <h3 className="text-3xl font-semibold mb-1">{metric.value}</h3>
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <div className="mt-4 h-12 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkline}>
                    <Line type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom row */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">

          {/* Recent activity — from real orders */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="mb-4">Recent Activity</h3>
            {recentActivity.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">No orders yet today</p>
              : (
                <div className="space-y-4">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.details}</p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{activity.time}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Peak hours — static for now */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="mb-4">Peak Hours Today</h3>
            <div className="space-y-4">
              {[
                { time: '12:00 PM – 2:00 PM', occupancy: 92, revenue: '₹45,600' },
                { time: '7:00 PM – 9:00 PM',  occupancy: 88, revenue: '₹52,300' },
                { time: '9:00 AM – 11:00 AM', occupancy: 65, revenue: '₹28,900' },
                { time: '4:00 PM – 6:00 PM',  occupancy: 58, revenue: '₹22,400' },
              ].map((slot, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{slot.time}</span>
                    <span className="font-medium">{slot.revenue}</span>
                  </div>
                  <div className="h-2 bg-accent/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      style={{ width: `${slot.occupancy}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{slot.occupancy}% occupied</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
