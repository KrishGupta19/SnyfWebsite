import { Users, Clock, TrendingUp, Heart, Search, ArrowUpDown, ChevronLeft, ChevronRight, Award, DollarSign, ShoppingBag } from "lucide-react";
import { useEffect, useState } from 'react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';

export function CustomerInsights() {
  const { venue } = useVenue();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    repeatPercent: 0,
    repeatDiff: 0,
    avgVisitTime: 0,
    avgVisitDiff: 0,
    avgSpending: 0,
    avgSpendingDiff: 0,
    reviewCount: 0,
  });
  const [visitTimings, setVisitTimings] = useState<{ hour: string; value: number; visits: number }[]>([]);
  const [spendingBehavior, setSpendingBehavior] = useState<{ range: string; count: number; percent: number }[]>([]);
  const [repeatCustomersList, setRepeatCustomersList] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState({ lunch: 0, dinner: 0, morning: 0 });
  const [groupPatterns, setGroupPatterns] = useState({ solo: 0, couples: 0, medium: 0, large: 0 });
  const [sentiment, setSentiment] = useState({ food: 0, ambience: 0, service: 0, value: 0 });
  const [hasHistory, setHasHistory] = useState(false);
  const [hasOrders, setHasOrders] = useState(false);

  // Food Behaviour Analysis States
  const [foodStats, setFoodStats] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [categoryShares, setCategoryShares] = useState<any[]>([]);
  const [topPerformer, setTopPerformer] = useState<any>(null);
  const [revenueChampion, setRevenueChampion] = useState<any>(null);
  const [totalQtySold, setTotalQtySold] = useState(0);
  const [totalRevenueSold, setTotalRevenueSold] = useState(0);

  // Filter, Sort, Pagination states
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'qty' | 'revenue' | 'name'>('qty');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [foodPage, setFoodPage] = useState(1);
  const foodPageSize = 6;

  const handleSort = (field: 'qty' | 'revenue' | 'name') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setFoodPage(1);
  };

  useEffect(() => {
    if (!venue?.id) return;

    async function fetchData() {
      try {
        // Fetch all orders for this venue
        const { data: orders, error: ordersErr } = await db
          .from('orders')
          .select('*')
          .eq('venue_id', venue.id);

        if (ordersErr) throw ordersErr;
        const allOrders = orders || [];
        setHasOrders(allOrders.length > 0);

        // Fetch menu items to associate categories
        const { data: menuItems, error: menuErr } = await db
          .from('menu_items')
          .select('id, name, price, category')
          .eq('venue_id', venue.id);

        const categoryMap: Record<string, string> = {};
        if (menuItems) {
          menuItems.forEach(item => {
            categoryMap[item.id] = item.category || 'Uncategorised';
          });
        }

        // Fetch all verified reviews for this venue
        const { data: reviews, error: reviewsErr } = await db
          .from('field_reports')
          .select('*')
          .eq('venue_id', venue.id)
          .eq('verified', true);

        if (reviewsErr) throw reviewsErr;
        const allReviews = reviews || [];

        // Divide orders into historical periods to compute diffs dynamically
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const currentOrders = allOrders.filter(o => new Date(o.created_at) >= thirtyDaysAgo);
        const previousOrders = allOrders.filter(o => {
          const d = new Date(o.created_at);
          return d >= sixtyDaysAgo && d < thirtyDaysAgo;
        });

        const hasPrevPeriod = previousOrders.length > 0;
        setHasHistory(hasPrevPeriod);

        // 1. Repeat Customers Calculation
        const ordersWithUsers = allOrders.filter(o => o.user_id);
        const userCounts: Record<string, number> = {};
        ordersWithUsers.forEach(o => {
          userCounts[o.user_id] = (userCounts[o.user_id] || 0) + 1;
        });
        const uniqueUsers = Object.keys(userCounts).length;
        const repeatUsers = Object.values(userCounts).filter(count => count > 1).length;
        const repeatPercent = uniqueUsers > 0 ? (repeatUsers / uniqueUsers) * 100 : 0;

        // Diffs calculation for repeat percentage
        const curUsers = new Set(currentOrders.map(o => o.user_id).filter(Boolean));
        const curUserCounts: Record<string, number> = {};
        currentOrders.filter(o => o.user_id).forEach(o => {
          curUserCounts[o.user_id] = (curUserCounts[o.user_id] || 0) + 1;
        });
        const curRepeatCount = Object.values(curUserCounts).filter(c => c > 1).length;
        const curRepeatPercent = curUsers.size > 0 ? (curRepeatCount / curUsers.size) * 100 : 0;

        const prevUsers = new Set(previousOrders.map(o => o.user_id).filter(Boolean));
        const prevUserCounts: Record<string, number> = {};
        previousOrders.filter(o => o.user_id).forEach(o => {
          prevUserCounts[o.user_id] = (prevUserCounts[o.user_id] || 0) + 1;
        });
        const prevRepeatCount = Object.values(prevUserCounts).filter(c => c > 1).length;
        const prevRepeatPercent = prevUsers.size > 0 ? (prevRepeatCount / prevUsers.size) * 100 : 0;

        const repeatDiff = hasPrevPeriod ? curRepeatPercent - prevRepeatPercent : 0;

        // 2. Average Visit Time Calculation
        const calculateAvgVisit = (ordersList: typeof allOrders) => {
          const completed = ordersList.filter(o => o.status === 'delivered' || o.status === 'ready' || o.status === 'completed');
          let totalMins = 0;
          let compC = 0;
          completed.forEach(o => {
            if (o.updated_at && o.created_at) {
              const diffMs = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
              const diffMins = diffMs / (1000 * 60);
              if (diffMins > 0 && diffMins < 240) {
                totalMins += diffMins;
                compC++;
              }
            }
          });
          return compC > 0 ? Math.round(totalMins / compC + 25) : 0;
        };

        const avgVisitTime = calculateAvgVisit(allOrders);
        const curAvgVisit = calculateAvgVisit(currentOrders);
        const prevAvgVisit = calculateAvgVisit(previousOrders);
        const avgVisitDiff = hasPrevPeriod ? curAvgVisit - prevAvgVisit : 0;

        // 3. Average Spending
        const avgSpending = allOrders.length > 0
          ? allOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) / allOrders.length
          : 0;

        const curAvgSpending = currentOrders.length > 0
          ? currentOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) / currentOrders.length
          : 0;
        const prevAvgSpending = previousOrders.length > 0
          ? previousOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) / previousOrders.length
          : 0;
        const avgSpendingDiff = hasPrevPeriod && prevAvgSpending > 0 ? ((curAvgSpending - prevAvgSpending) / prevAvgSpending) * 100 : 0;

        // 4. Visit Timings Heatmap
        const hours = [
          { label: "6 AM", range: [6, 7] },
          { label: "8 AM", range: [8, 9] },
          { label: "10 AM", range: [10, 11] },
          { label: "12 PM", range: [12, 13] },
          { label: "2 PM", range: [14, 15] },
          { label: "4 PM", range: [16, 17] },
          { label: "6 PM", range: [18, 19] },
          { label: "8 PM", range: [20, 21] },
          { label: "10 PM", range: [22, 23] }
        ];
        const hourCounts = hours.map(h => {
          return allOrders.filter(o => {
            const hr = new Date(o.created_at).getHours();
            return hr >= h.range[0] && hr <= h.range[1];
          }).length;
        });
        const maxHourCount = Math.max(...hourCounts, 1);
        const dynamicVisitTimings = hours.map((h, i) => ({
          hour: h.label,
          value: Math.round((hourCounts[i] / maxHourCount) * 80) + 10,
          visits: hourCounts[i]
        }));

        // 5. Spending Behavior
        const ranges = [
          { range: "₹0-500", min: 0, max: 500 },
          { range: "₹500-1000", min: 500, max: 1000 },
          { range: "₹1000-2000", min: 1000, max: 2000 },
          { range: "₹2000+", min: 2000, max: Infinity }
        ];
        const dynamicSpendingBehavior = ranges.map(r => {
          const count = allOrders.filter(o => {
            const tot = Number(o.total) || 0;
            return tot >= r.min && tot < r.max;
          }).length;
          const percent = allOrders.length > 0 ? Math.round((count / allOrders.length) * 100) : 0;
          return { range: r.range, count, percent };
        });

        // 6. Top Repeat Customers
        const userOrdersMap: Record<string, typeof allOrders> = {};
        allOrders.forEach(o => {
          if (o.user_id) {
            if (!userOrdersMap[o.user_id]) userOrdersMap[o.user_id] = [];
            userOrdersMap[o.user_id].push(o);
          }
        });

        const userIds = Object.keys(userOrdersMap);
        let userProfiles: Record<string, { name: string; trust_level: string }> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await db
            .from('users')
            .select('id, name, trust_level')
            .in('id', userIds);
          if (profiles) {
            profiles.forEach(p => {
              userProfiles[p.id] = { name: p.name || 'Anonymous User', trust_level: p.trust_level || 'scout' };
            });
          }
        }

        const repeats = Object.entries(userOrdersMap).map(([uid, userOrders]) => {
          const profile = userProfiles[uid] || { name: 'Snyf Customer', trust_level: 'scout' };
          const sorted = [...userOrders].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const lastOrderDate = new Date(sorted[0].created_at);
          
          let lastVisit = 'Some time ago';
          const diffDays = Math.floor((Date.now() - lastOrderDate.getTime()) / 86400000);
          if (diffDays === 0) lastVisit = 'Today';
          else if (diffDays === 1) lastVisit = 'Yesterday';
          else lastVisit = `${diffDays} days ago`;

          const avgSpend = userOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) / userOrders.length;

          return {
            name: profile.name,
            visits: userOrders.length,
            lastVisit,
            avgSpend: `₹${Math.round(avgSpend).toLocaleString('en-IN')}`,
            status: profile.trust_level.toUpperCase(),
          };
        });

        repeats.sort((a, b) => b.visits - a.visits);
        const finalRepeats = repeats.slice(0, 5); // 100% database-derived, no mock additions

        // 7. Peak Hours counts
        const morningCount = allOrders.filter(o => {
          const hr = new Date(o.created_at).getHours();
          return hr >= 9 && hr < 11;
        }).length;
        const lunchCount = allOrders.filter(o => {
          const hr = new Date(o.created_at).getHours();
          return hr >= 12 && hr < 14;
        }).length;
        const dinnerCount = allOrders.filter(o => {
          const hr = new Date(o.created_at).getHours();
          return hr >= 19 && hr < 21;
        }).length;

        // 8. Group Patterns
        let solo = 0, couples = 0, medium = 0, large = 0;
        allOrders.forEach(o => {
          const items = o.items || [];
          const totalQty = items.reduce((sum, item) => sum + (item.qty || 1), 0);
          if (totalQty <= 1) solo++;
          else if (totalQty === 2) couples++;
          else if (totalQty <= 5) medium++;
          else large++;
        });
        const totalClassified = (solo + couples + medium + large) || 1;
        const gp = {
          solo: Math.round((solo / totalClassified) * 100),
          couples: Math.round((couples / totalClassified) * 100),
          medium: Math.round((medium / totalClassified) * 100),
          large: Math.round((large / totalClassified) * 100),
        };

        // 9. Sentiment Averages
        let foodSum = 0, ambSum = 0, servSum = 0, valSum = 0;
        let foodCount = 0, ambCount = 0, servCount = 0, valCount = 0;

        allReviews.forEach(r => {
          if (r.food != null) { foodSum += Number(r.food); foodCount++; }
          if (r.ambience != null) { ambSum += Number(r.ambience); ambCount++; }
          if (r.service != null) { servSum += Number(r.service); servCount++; }
          if (r.value != null) { valSum += Number(r.value); valCount++; }
        });

        const sentimentScores = {
          food: foodCount > 0 ? Number(((foodSum / foodCount / 7) * 10).toFixed(1)) : 0,
          ambience: ambCount > 0 ? Number(((ambSum / ambCount / 7) * 10).toFixed(1)) : 0,
          service: servCount > 0 ? Number(((servSum / servCount / 7) * 10).toFixed(1)) : 0,
          value: valCount > 0 ? Number(((valSum / valCount / 7) * 10).toFixed(1)) : 0,
        };

        // 10. Food Behaviour Analysis data processing
        const itemStats: Record<string, { id: string; name: string; price: number; qty: number; revenue: number; category: string }> = {};
        let sumQty = 0;
        let sumRevenue = 0;

        allOrders.forEach(o => {
          const items = o.items || [];
          items.forEach((item: any) => {
            const itemId = item.id || item.name;
            if (!itemId) return;
            if (!itemStats[itemId]) {
              itemStats[itemId] = {
                id: itemId,
                name: item.name || 'Unknown Item',
                price: Number(item.price) || 0,
                qty: 0,
                revenue: 0,
                category: categoryMap[itemId] || 'Uncategorised'
              };
            }
            const qty = Number(item.qty) || 1;
            const itemPrice = Number(item.price) || 0;
            itemStats[itemId].qty += qty;
            itemStats[itemId].revenue += qty * itemPrice;
            sumQty += qty;
            sumRevenue += qty * itemPrice;
          });
        });

        const foodBehaviourList = Object.values(itemStats);
        const sortedByQty = [...foodBehaviourList].sort((a, b) => b.qty - a.qty);
        const sortedByRevenue = [...foodBehaviourList].sort((a, b) => b.revenue - a.revenue);

        // Category Share calculations
        const categoryMapStats: Record<string, { qty: number; revenue: number }> = {};
        foodBehaviourList.forEach(item => {
          const cat = item.category;
          if (!categoryMapStats[cat]) {
            categoryMapStats[cat] = { qty: 0, revenue: 0 };
          }
          categoryMapStats[cat].qty += item.qty;
          categoryMapStats[cat].revenue += item.revenue;
        });

        const catSharesList = Object.entries(categoryMapStats).map(([cat, stats]) => ({
          category: cat,
          qty: stats.qty,
          revenue: stats.revenue,
          percent: sumRevenue > 0 ? (stats.revenue / sumRevenue) * 100 : 0
        })).sort((a, b) => b.revenue - a.revenue);

        setMetrics({
          repeatPercent,
          repeatDiff,
          avgVisitTime,
          avgVisitDiff,
          avgSpending,
          avgSpendingDiff,
          reviewCount: allReviews.length,
        });
        setVisitTimings(dynamicVisitTimings);
        setSpendingBehavior(dynamicSpendingBehavior);
        setRepeatCustomersList(finalRepeats);
        setPeakHours({ lunch: lunchCount, dinner: dinnerCount, morning: morningCount });
        setGroupPatterns(gp);
        setSentiment(sentimentScores);

        setFoodStats(foodBehaviourList);
        setCategoriesList(['All', ...new Set(foodBehaviourList.map(item => item.category).filter(Boolean))]);
        setCategoryShares(catSharesList);
        setTopPerformer(sortedByQty[0] || null);
        setRevenueChampion(sortedByRevenue[0] || null);
        setTotalQtySold(sumQty);
        setTotalRevenueSold(sumRevenue);

      } catch (err) {
        console.error('Error fetching customer insights data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [venue?.id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1>Customer Insights</h1>
        <p className="text-muted-foreground mt-1">
          Deep dive into customer behavior and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-bold">{metrics.repeatPercent.toFixed(1)}%</h3>
          <p className="text-sm text-muted-foreground mt-1">Repeat Customers</p>
          {hasHistory ? (
            <p className={`text-xs mt-2 ${metrics.repeatDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {metrics.repeatDiff >= 0 ? '+' : ''}{metrics.repeatDiff.toFixed(1)}% from last month
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">No historical comparison</p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-bold">{metrics.avgVisitTime > 0 ? `${metrics.avgVisitTime} min` : '—'}</h3>
          <p className="text-sm text-muted-foreground mt-1">Avg. Visit Time</p>
          {hasHistory ? (
            <p className={`text-xs mt-2 ${metrics.avgVisitDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {metrics.avgVisitDiff >= 0 ? `+${metrics.avgVisitDiff} min increase` : `${metrics.avgVisitDiff} min decrease`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">No historical comparison</p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-bold">₹{Math.round(metrics.avgSpending).toLocaleString('en-IN')}</h3>
          <p className="text-sm text-muted-foreground mt-1">Avg. Spending</p>
          {hasHistory ? (
            <p className={`text-xs mt-2 ${metrics.avgSpendingDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {metrics.avgSpendingDiff >= 0 ? '+' : ''}{metrics.avgSpendingDiff.toFixed(1)}% from last month
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">No historical comparison</p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-bold">{metrics.reviewCount}</h3>
          <p className="text-sm text-muted-foreground mt-1">Verified Reviews</p>
          <p className="text-xs text-muted-foreground mt-2">From orders via Snyf</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-6">Visit Timing Heatmap</h3>
          {!hasOrders ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground text-sm">
              <span>No orders placed yet</span>
            </div>
          ) : (
            <div className="space-y-3">
              {visitTimings.map((slot, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{slot.hour}</span>
                    <span className="text-muted-foreground">
                      {slot.visits} visit{slot.visits !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-3 bg-accent/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${slot.value}%`,
                        background:
                          slot.value > 70
                            ? "linear-gradient(to right, var(--color-primary), var(--color-accent))"
                            : slot.value > 40
                            ? "var(--color-primary)"
                            : "var(--color-muted-foreground)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-6">Spending Behavior</h3>
          {!hasOrders ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground text-sm">
              <span>No order data available</span>
            </div>
          ) : (
            <div className="space-y-4">
              {spendingBehavior.map((segment, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{segment.range}</span>
                    <span className="text-sm text-muted-foreground">
                      {segment.count} customer{segment.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      style={{ width: `${segment.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {segment.percent}% of total
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="mb-6">Top Repeat Customers</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Customer
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Total Visits
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Last Visit
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Avg. Spend
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {repeatCustomersList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                    No repeat customers found yet
                  </td>
                </tr>
              ) : (
                repeatCustomersList.map((customer, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border hover:bg-accent/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-sm">
                          {customer.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </div>
                        <span className="font-medium">{customer.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                        {customer.visits} visit{customer.visits !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm">{customer.lastVisit}</td>
                    <td className="py-4 px-4 font-medium">{customer.avgSpend}</td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                        {customer.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-4">Peak Hours</h3>
          {!hasOrders ? (
            <div className="flex flex-col items-center justify-center h-[120px] text-muted-foreground text-sm">
              <span>No orders placed yet</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                <span className="text-sm">Lunch Rush</span>
                <span className="font-semibold">12 PM - 2 PM ({peakHours.lunch} orders)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                <span className="text-sm">Dinner Peak</span>
                <span className="font-semibold">7 PM - 9 PM ({peakHours.dinner} orders)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg">
                <span className="text-sm">Morning Coffee</span>
                <span className="font-semibold">9 AM - 11 AM ({peakHours.morning} orders)</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-4">Group Patterns</h3>
          {!hasOrders ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
              <span>No order data available</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Solo Diners</span>
                <span className="font-semibold">{groupPatterns.solo}%</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${groupPatterns.solo}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Couples</span>
                <span className="font-semibold">{groupPatterns.couples}%</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${groupPatterns.couples}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Groups (3-5)</span>
                <span className="font-semibold">{groupPatterns.medium}%</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${groupPatterns.medium}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Large Groups (6+)</span>
                <span className="font-semibold">{groupPatterns.large}%</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${groupPatterns.large}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-4">Sentiment Trends</h3>
          {metrics.reviewCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
              <span>No verified reviews yet</span>
              <span className="text-xs mt-1">Sentiment data will sync once reviews are received</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Ambience</span>
                  <span className="text-sm font-semibold">{sentiment.ambience}/10</span>
                </div>
                <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    style={{ width: `${sentiment.ambience * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Service Quality</span>
                  <span className="text-sm font-semibold">{sentiment.service}/10</span>
                </div>
                <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    style={{ width: `${sentiment.service * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Food Quality</span>
                  <span className="text-sm font-semibold">{sentiment.food}/10</span>
                </div>
                <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    style={{ width: `${sentiment.food * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Value for Money</span>
                  <span className="text-sm font-semibold">{sentiment.value}/10</span>
                </div>
                <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    style={{ width: `${sentiment.value * 10}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Food Behaviour Analysis Section */}
      <div className="bg-card rounded-2xl p-6 border border-border mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Food Behaviour Analysis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Deep dive into item-level sales, category contributions, and popularity trends
          </p>
        </div>

        {!hasOrders ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
            <span>No order details available to perform analysis</span>
          </div>
        ) : (
          <>
            {/* Top performing highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 relative overflow-hidden flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl text-primary flex-shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Star Performer</span>
                  <h4 className="font-bold text-lg text-foreground mt-1 truncate max-w-[200px]">
                    {topPerformer?.name || 'N/A'}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">{topPerformer?.qty || 0}</span> portions sold
                  </p>
                  <span className="absolute bottom-2 right-4 text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                    {topPerformer?.category || 'Category'}
                  </span>
                </div>
              </div>

              <div className="bg-accent/5 border border-accent/10 rounded-2xl p-5 relative overflow-hidden flex items-start gap-4">
                <div className="p-3 bg-accent/10 rounded-xl text-accent flex-shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">Revenue Champion</span>
                  <h4 className="font-bold text-lg text-foreground mt-1 truncate max-w-[200px]">
                    {revenueChampion?.name || 'N/A'}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generated <span className="font-semibold text-foreground">₹{(revenueChampion?.revenue || 0).toLocaleString('en-IN')}</span>
                  </p>
                  <span className="absolute bottom-2 right-4 text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-medium">
                    {revenueChampion?.category || 'Category'}
                  </span>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
                <div className="p-3 bg-muted/40 rounded-xl text-muted-foreground flex-shrink-0">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Sales Volume</span>
                  <h4 className="font-bold text-2xl text-foreground mt-0.5">
                    {totalQtySold.toLocaleString('en-IN')}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Items sold across <span className="font-semibold text-foreground">{foodStats.length}</span> unique menu offerings
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Grid & Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
              {/* Left Column: Interactive Paginated Food List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search food item..."
                      value={foodSearch}
                      onChange={(e) => { setFoodSearch(e.target.value); setFoodPage(1); }}
                      className="w-full pl-9 pr-4 py-2 bg-input-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Filter Category:</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => { setSelectedCategory(e.target.value); setFoodPage(1); }}
                      className="px-3 py-2 bg-input-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto border border-border rounded-2xl bg-card">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th
                          onClick={() => handleSort('name')}
                          className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            Item Name
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </div>
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Category
                        </th>
                        <th
                          onClick={() => handleSort('qty')}
                          className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Sold Qty
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('revenue')}
                          className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Revenue
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </div>
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[120px]">
                          Sales Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredFoodStats = foodStats.filter(item => {
                          const matchesSearch = item.name.toLowerCase().includes(foodSearch.toLowerCase());
                          const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
                          return matchesSearch && matchesCategory;
                        });

                        const sortedFoodStats = [...filteredFoodStats].sort((a, b) => {
                          let fieldA: any = a[sortBy];
                          let fieldB: any = b[sortBy];

                          if (sortBy === 'name') {
                            fieldA = a.name.toLowerCase();
                            fieldB = b.name.toLowerCase();
                            return sortOrder === 'asc' ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
                          }

                          return sortOrder === 'asc' ? fieldA - fieldB : fieldB - fieldA;
                        });

                        const totalPages = Math.ceil(sortedFoodStats.length / foodPageSize) || 1;
                        const paginatedFoodStats = sortedFoodStats.slice((foodPage - 1) * foodPageSize, foodPage * foodPageSize);

                        if (sortedFoodStats.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                                No matching food items found
                              </td>
                            </tr>
                          );
                        }

                        return paginatedFoodStats.map((item, idx) => {
                          const sharePct = totalRevenueSold > 0 ? (item.revenue / totalRevenueSold) * 100 : 0;
                          return (
                            <tr key={idx} className="border-b border-border hover:bg-accent/20 transition-colors">
                              <td className="py-3 px-4 font-semibold text-sm">{item.name}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 bg-accent text-accent-foreground rounded-full text-[10px] font-medium">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-sm">{item.qty}</td>
                              <td className="py-3 px-4 text-right font-bold text-sm">₹{Math.round(item.revenue).toLocaleString('en-IN')}</td>
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                                      style={{ width: `${Math.min(sharePct * 3.5, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{sharePct.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {(() => {
                  const filteredFoodStats = foodStats.filter(item => {
                    const matchesSearch = item.name.toLowerCase().includes(foodSearch.toLowerCase());
                    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
                    return matchesSearch && matchesCategory;
                  });
                  const totalPages = Math.ceil(filteredFoodStats.length / foodPageSize) || 1;

                  if (filteredFoodStats.length === 0) return null;

                  return (
                    <div className="flex items-center justify-between px-2">
                      <span className="text-xs text-muted-foreground">
                        Showing {(foodPage - 1) * foodPageSize + 1} - {Math.min(foodPage * foodPageSize, filteredFoodStats.length)} of {filteredFoodStats.length} items
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFoodPage(p => Math.max(p - 1, 1))}
                          disabled={foodPage === 1}
                          className="p-1.5 border border-border bg-card hover:bg-accent rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold">
                          Page {foodPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setFoodPage(p => Math.min(p + 1, totalPages))}
                          disabled={foodPage === totalPages}
                          className="p-1.5 border border-border bg-card hover:bg-accent rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Category Share breakdown */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 font-sans">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Category Share</h3>
                <div className="space-y-4">
                  {categoryShares.map((cat, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary" style={{ opacity: 1 - idx * 0.2 }} />
                          {cat.category}
                        </span>
                        <span className="text-muted-foreground">
                          {cat.qty} portions · <span className="font-bold text-foreground">₹{Math.round(cat.revenue).toLocaleString('en-IN')}</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-accent/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                          style={{ width: `${cat.percent}%`, opacity: 1 - idx * 0.15 }}
                        />
                      </div>
                      <p className="text-[10px] text-right text-muted-foreground font-medium">
                        {cat.percent.toFixed(1)}% of total revenue
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
