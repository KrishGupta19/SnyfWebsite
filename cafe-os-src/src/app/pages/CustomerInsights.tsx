import { Users, Clock, TrendingUp, Heart } from "lucide-react";
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
    </div>
  );
}
