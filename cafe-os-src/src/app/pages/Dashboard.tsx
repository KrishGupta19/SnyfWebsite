import { useEffect, useState } from 'react';
import { TrendingUp, Users, ShoppingBag, Activity, X } from 'lucide-react';
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

  const [rawData, setRawData] = useState<{
    todayOrders: any[];
    allOrders: any[];
    menuItems: any[];
    visits: any[];
    weekOrders: any[];
  }>({
    todayOrders: [],
    allOrders: [],
    menuItems: [],
    visits: [],
    weekOrders: [],
  });

  const [recentActivity, setRecentActivity] = useState<{
    action: string; details: string; time: string;
  }[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

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
          db.from('orders').select('id, total, status, created_at, items, table_num')
            .eq('venue_id', venue.id)
            .gte('created_at', today.toISOString()),
          // All time orders
          db.from('orders').select('id, total, status, created_at, items, table_num')
            .eq('venue_id', venue.id),
          // Menu items
          db.from('menu_items').select('id, name, price, category, available')
            .eq('venue_id', venue.id),
          // Total visits
          db.from('visits').select('id, device, source, created_at')
            .eq('venue_id', venue.id),
          // This week's orders
          db.from('orders').select('id, total, created_at')
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

      setRawData({
        todayOrders,
        allOrders,
        menuItems,
        visits,
        weekOrders,
      });

      setStats({
        todayOrders:  todayOrders.length,
        todayRevenue: todayOrders.reduce((s, o) => s + (o.total || 0), 0),
        activeOrders: todayOrders.filter(o =>
          o.status === 'received' || o.status === 'delivered' || o.status === 'serving'
        ).length,
        totalOrders:  allOrders.length,
        totalRevenue: allOrders.reduce((s, o) => s + (o.total || 0), 0),
        menuItems:    menuItems.filter(item => item.available).length,
        totalVisits:  visits.length,
        weekRevenue:  weekOrders.reduce((s, o) => s + (o.total || 0), 0),
      });

      // Build activity feed from recent orders
      setRecentActivity(
        recentOrders.map(o => {
          const itemNames = (o.items || []).slice(0, 2).map((i: any) => i.name).join(', ');
          const minsAgo   = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
          return {
            action:  `Order ${o.status === 'delivered' ? 'completed' : o.status === 'prepared' ? 'prepared' : 'received'}`,
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

  // ── Dynamic Sparklines ────────────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const getDailyRevenueSparkline = () => {
    const data = last7Days.map(day => {
      const dayStr = day.toDateString();
      const sum = rawData.weekOrders
        .filter(o => new Date(o.created_at).toDateString() === dayStr)
        .reduce((s, o) => s + (o.total || 0), 0);
      return { v: sum };
    });
    if (data.every(d => d.v === 0)) {
      return [{ v: 0 }, { v: 1 }, { v: 0 }, { v: 2 }, { v: 1 }, { v: 3 }, { v: 0 }];
    }
    return data;
  };

  const getDailyOrdersSparkline = () => {
    const data = last7Days.map(day => {
      const dayStr = day.toDateString();
      const count = rawData.weekOrders
        .filter(o => new Date(o.created_at).toDateString() === dayStr).length;
      return { v: count };
    });
    if (data.every(d => d.v === 0)) {
      return [{ v: 0 }, { v: 1 }, { v: 0 }, { v: 2 }, { v: 1 }, { v: 3 }, { v: 0 }];
    }
    return data;
  };

  const getDailyVisitsSparkline = () => {
    const data = last7Days.map(day => {
      const dayStr = day.toDateString();
      const count = rawData.visits
        .filter(v => new Date(v.created_at).toDateString() === dayStr).length;
      return { v: count };
    });
    if (data.every(d => d.v === 0)) {
      return [{ v: 0 }, { v: 1 }, { v: 0 }, { v: 2 }, { v: 1 }, { v: 3 }, { v: 0 }];
    }
    return data;
  };

  const getTodayHourlyRevenueSparkline = () => {
    const hours = [8, 10, 12, 14, 16, 18, 20, 22];
    const data = hours.map(h => {
      const sum = rawData.todayOrders
        .filter(o => {
          const hr = new Date(o.created_at).getHours();
          return hr >= h && hr < h + 2;
        })
        .reduce((s, o) => s + (o.total || 0), 0);
      return { v: sum };
    });
    if (data.every(d => d.v === 0)) {
      return [{ v: 0 }, { v: 1 }, { v: 0 }, { v: 2 }, { v: 1 }, { v: 3 }, { v: 0 }];
    }
    return data;
  };

  const getTodayHourlyOrdersSparkline = () => {
    const hours = [8, 10, 12, 14, 16, 18, 20, 22];
    const data = hours.map(h => {
      const count = rawData.todayOrders
        .filter(o => {
          const hr = new Date(o.created_at).getHours();
          return hr >= h && hr < h + 2;
        }).length;
      return { v: count };
    });
    if (data.every(d => d.v === 0)) {
      return [{ v: 0 }, { v: 1 }, { v: 0 }, { v: 2 }, { v: 1 }, { v: 3 }, { v: 0 }];
    }
    return data;
  };

  const getMenuSparkline = () => {
    return [
      { v: Math.max(0, stats.menuItems - 4) },
      { v: Math.max(0, stats.menuItems - 2) },
      { v: stats.menuItems },
      { v: stats.menuItems },
    ];
  };

  // ── Peak Hours Today Calculation ──────────────────────────────
  const getPeakHoursToday = () => {
    const slotDefinitions = [
      { time: '12:00 PM – 2:00 PM', start: 12, end: 14 },
      { time: '7:00 PM – 9:00 PM',  start: 19, end: 21 },
      { time: '9:00 AM – 11:00 AM', start: 9,  end: 11 },
      { time: '4:00 PM – 6:00 PM',  start: 16, end: 18 },
    ];

    const slotData = slotDefinitions.map(slot => {
      let revenue = 0;
      let count = 0;
      rawData.todayOrders.forEach(o => {
        const hour = new Date(o.created_at).getHours();
        if (hour >= slot.start && hour < slot.end) {
          revenue += (o.total || 0);
          count++;
        }
      });
      return {
        time: slot.time,
        revenue,
        count,
      };
    });

    const maxCount = Math.max(...slotData.map(s => s.count));
    
    return slotData
      .map(slot => {
        const occupancy = maxCount > 0 ? Math.round((slot.count / maxCount) * 80 + 15) : 0;
        return {
          time: slot.time,
          occupancy: slot.count > 0 ? occupancy : 0,
          revenue: `₹${slot.revenue.toLocaleString('en-IN')}`,
          revenueVal: slot.revenue,
        };
      })
      .sort((a, b) => b.revenueVal - a.revenueVal);
  };

  // ── Metrics ───────────────────────────────────────────────────
  const metrics = [
    {
      label: "Total Revenue",
      value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
      change: "All time",
      trend: "neutral",
      icon: TrendingUp,
      sparkline: getDailyRevenueSparkline(),
    },
    {
      label: "This Week",
      value: `₹${stats.weekRevenue.toLocaleString('en-IN')}`,
      change: "Last 7 days",
      trend: "up",
      icon: TrendingUp,
      sparkline: getDailyRevenueSparkline(),
    },
    {
      label: "Today's Revenue",
      value: `₹${stats.todayRevenue.toLocaleString('en-IN')}`,
      change: "Today",
      trend: "up",
      icon: TrendingUp,
      sparkline: getTodayHourlyRevenueSparkline(),
    },
    {
      label: "Total Orders",
      value: stats.totalOrders.toString(),
      change: "All time",
      trend: "neutral",
      icon: ShoppingBag,
      sparkline: getDailyOrdersSparkline(),
    },
    {
      label: "Today's Orders",
      value: stats.todayOrders.toString(),
      change: "Today",
      trend: "neutral",
      icon: ShoppingBag,
      sparkline: getTodayHourlyOrdersSparkline(),
    },
    {
      label: "Active Orders",
      value: stats.activeOrders.toString(),
      change: "Live",
      trend: "neutral",
      icon: Activity,
      sparkline: getTodayHourlyOrdersSparkline(),
    },
    {
      label: "Total Visits",
      value: stats.totalVisits.toLocaleString('en-IN'),
      change: "Via Snyf",
      trend: "up",
      icon: Users,
      sparkline: getDailyVisitsSparkline(),
    },
    {
      label: "Menu Items",
      value: stats.menuItems.toString(),
      change: "Available",
      trend: "neutral",
      icon: Activity,
      sparkline: getMenuSparkline(),
    },
  ];

  const renderModalContent = (label: string) => {
    switch (label) {
      case "Total Revenue":
      case "This Week":
      case "Today's Revenue": {
        const isToday = label === "Today's Revenue";
        const isWeek = label === "This Week";
        const targetOrders = isToday 
          ? rawData.todayOrders 
          : isWeek 
            ? rawData.weekOrders 
            : rawData.allOrders;

        const totalVal = isToday 
          ? stats.todayRevenue 
          : isWeek 
            ? stats.weekRevenue 
            : stats.totalRevenue;

        const avgOrder = targetOrders.length > 0 ? (totalVal / targetOrders.length) : 0;
        
        const highestValue = [...targetOrders]
          .sort((a, b) => (b.total || 0) - (a.total || 0))
          .slice(0, 5);

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/5 rounded-2xl p-4 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">Total Revenue</span>
                <span className="text-2xl font-bold text-primary">₹{totalVal.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-primary/5 rounded-2xl p-4 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">Avg. Order Value</span>
                <span className="text-2xl font-bold text-primary">₹{Math.round(avgOrder).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Highest Value Transactions ({highestValue.length})
              </h4>
              {highestValue.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center italic">No transactions recorded for this period.</p>
              ) : (
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
                  {highestValue.map((o, idx) => {
                    const itemsText = (o.items || []).map((i: any) => `${i.name} (x${i.quantity || 1})`).join(', ');
                    return (
                      <div key={o.id || idx} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{itemsText || 'Guest Order'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(o.created_at).toLocaleDateString()} at {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="font-semibold text-foreground flex-shrink-0">₹{(o.total || 0).toLocaleString('en-IN')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "Total Orders":
      case "Today's Orders":
      case "Active Orders": {
        const isActive = label === "Active Orders";
        const isToday = label === "Today's Orders";
        
        const targetOrders = isActive
          ? rawData.todayOrders
          : isToday
            ? rawData.todayOrders
            : rawData.allOrders;

        const displayOrders = isActive 
          ? rawData.todayOrders.filter(o => o.status === 'received' || o.status === 'delivered' || o.status === 'serving')
          : targetOrders;

        const countReceived = targetOrders.filter(o => o.status === 'received').length;
        const countServing = targetOrders.filter(o => o.status === 'serving' || o.status === 'delivered').length;
        const countReady = targetOrders.filter(o => o.status === 'ready').length;
        const countCancelled = targetOrders.filter(o => o.status === 'cancelled').length;

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                <span className="text-2xl font-bold text-blue-500">{countReceived}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-medium">Received</span>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                <span className="text-2xl font-bold text-amber-500">{countServing}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-medium">Serving</span>
              </div>
              <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                <span className="text-2xl font-bold text-green-500">{countReady}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-medium">Ready</span>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                <span className="text-2xl font-bold text-red-500">{countCancelled}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-medium">Cancelled</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                {isActive ? 'Current Active Orders' : 'Latest Orders'}
              </h4>
              {displayOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center italic">No orders found in this list.</p>
              ) : (
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background max-h-[250px] overflow-y-auto">
                  {displayOrders.slice(0, 10).map((o, idx) => {
                    const itemsText = (o.items || []).map((i: any) => `${i.name} (x${i.quantity || 1})`).join(', ');
                    const tableText = o.table_num ? `Table ${o.table_num}` : 'Self Pickup';
                    let badgeColor = 'bg-gray-100 text-gray-700';
                    if (o.status === 'received') badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                    else if (o.status === 'serving' || o.status === 'delivered') badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                    else if (o.status === 'ready') badgeColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                    else if (o.status === 'cancelled') badgeColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

                    return (
                      <div key={o.id || idx} className="p-3 flex items-center justify-between gap-4 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{itemsText || 'Order'}</p>
                          <p className="text-muted-foreground mt-0.5 flex gap-2">
                            <span>{tableText}</span>
                            <span>•</span>
                            <span>{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor} inline-block mb-1`}>
                            {o.status}
                          </span>
                          <p className="font-semibold text-foreground">₹{(o.total || 0).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "Total Visits": {
        const totalVisits = rawData.visits.length;
        const mobileVisits = rawData.visits.filter(v => v.device === 'mobile' || v.device === 'phone').length;
        const desktopVisits = rawData.visits.filter(v => v.device === 'desktop').length;
        const directVisits = rawData.visits.filter(v => v.source === 'direct').length;

        const mobilePercent = totalVisits > 0 ? Math.round((mobileVisits / totalVisits) * 100) : 0;
        const desktopPercent = totalVisits > 0 ? Math.round((desktopVisits / totalVisits) * 100) : 0;
        const directPercent = totalVisits > 0 ? Math.round((directVisits / totalVisits) * 100) : 0;

        return (
          <div className="space-y-5">
            <div className="bg-primary/5 rounded-2xl p-4 border border-border text-center">
              <span className="text-xs text-muted-foreground block mb-1">Total Visits Recorded</span>
              <span className="text-3xl font-extrabold text-primary">{totalVisits.toLocaleString('en-IN')}</span>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Traffic & Device Insights</h4>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Mobile Visits ({mobileVisits})</span>
                    <span>{mobilePercent}%</span>
                  </div>
                  <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${mobilePercent}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Desktop Visits ({desktopVisits})</span>
                    <span>{desktopPercent}%</span>
                  </div>
                  <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${desktopPercent}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Direct Visits ({directVisits})</span>
                    <span>{directPercent}%</span>
                  </div>
                  <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${directPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "Menu Items": {
        const activeItemsCount = stats.menuItems;
        const totalItemsCount = rawData.menuItems.length;

        const categoriesMap: { [key: string]: number } = {};
        rawData.menuItems.forEach((item: any) => {
          const cat = item.category || 'Other';
          categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
        });

        const itemCounts: { [key: string]: number } = {};
        rawData.allOrders.forEach(o => {
          (o.items || []).forEach((item: any) => {
            if (item.name) {
              itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
            }
          });
        });
        const topSellingItems = Object.entries(itemCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/5 rounded-2xl p-4 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">Available Items</span>
                <span className="text-2xl font-bold text-primary">{activeItemsCount}</span>
              </div>
              <div className="bg-primary/5 rounded-2xl p-4 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">Total Registered</span>
                <span className="text-2xl font-bold text-foreground">{totalItemsCount}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Menu Categories</h4>
                {Object.keys(categoriesMap).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No menu categories found.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(categoriesMap).map(([cat, count]) => (
                      <div key={cat} className="flex justify-between items-center bg-background p-2.5 rounded-xl border border-border text-xs">
                        <span className="font-medium text-muted-foreground truncate max-w-[100px]">{cat}</span>
                        <span className="font-semibold text-foreground px-2 py-0.5 bg-primary/10 rounded">{count} items</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Top Ordered Items</h4>
                {topSellingItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No order statistics yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topSellingItems.map(([name, count]) => (
                      <div key={name} className="flex justify-between items-center bg-background p-2.5 rounded-xl border border-border text-xs">
                        <span className="font-medium text-foreground truncate max-w-[120px]">{name}</span>
                        <span className="text-muted-foreground text-[10px] font-semibold">{count} ordered</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      default:
        return <p className="text-muted-foreground">Detailed view is currently loading or unavailable.</p>;
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time insights into your café's performance
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Metric cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {metrics.map((metric, index) => (
            <div
              key={index}
              onClick={() => setSelectedMetric(metric.label)}
              className="bg-card rounded-2xl p-5 sm:p-6 border border-border shadow-sm hover:shadow-lg transition-all cursor-pointer hover:border-primary/45 hover:bg-accent/10 duration-250 select-none active:scale-[0.98] relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <metric.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  metric.trend === 'up'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {metric.change}
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-semibold mb-1 text-foreground tracking-tight">{metric.value}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">{metric.label}</p>
              <div className="mt-4 h-12 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metric.sparkline}>
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

          {/* Recent activity */}
          <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                <span>No recent activities recorded today</span>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/40 transition-colors">
                    <div className="w-2.5 h-2.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{activity.details}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 font-medium">{activity.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peak hours */}
          <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Peak Hours Today</h3>
            {stats.todayOrders === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                <span>No order data available for today yet</span>
              </div>
            ) : (
              <div className="space-y-4">
                {getPeakHoursToday().map((slot, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{slot.time}</span>
                      <span className="font-semibold text-primary">{slot.revenue}</span>
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
            )}
          </div>

        </div>
      )}

      {/* Detailed Analytics Modal */}
      {selectedMetric && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 transition-all duration-300 animate-fadeIn"
          onClick={() => setSelectedMetric(null)}
        >
          <div 
            className="bg-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border border-border shadow-2xl overflow-hidden relative max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary flex-shrink-0">
                  {(() => {
                    const metricObj = metrics.find(m => m.label === selectedMetric);
                    if (metricObj) {
                      const IconComp = metricObj.icon;
                      return <IconComp className="w-5 h-5 sm:w-6 sm:h-6" />;
                    }
                    return <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{selectedMetric}</h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Analytics Summary & Details</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMetric(null)}
                className="p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {renderModalContent(selectedMetric)}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-muted/10 border-t border-border flex justify-end">
              <button 
                onClick={() => setSelectedMetric(null)}
                className="px-5 py-2.5 w-full sm:w-auto bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/95 transition-colors shadow-sm cursor-pointer text-center text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
