import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, Calendar } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "../../lib/supabase";
import { useVenue } from "../../context/VenueContext";

export function Revenue() {
  const { venue } = useVenue();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todayRevenue: 0,
    dailyPercent: 0,
    thisWeekRevenue: 0,
    weeklyPercent: 0,
    thisMonthRevenue: 0,
    monthlyPercent: 0,
  });
  const [weeklyTrend, setWeeklyTrend] = useState<{ day: string; revenue: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; revenue: number }[]>([]);

  useEffect(() => {
    if (!venue?.id) return;

    async function fetchRevenueData() {
      try {
        const { data: orders, error } = await db
          .from('orders')
          .select('total, created_at, status')
          .eq('venue_id', venue.id);

        if (error) throw error;

        const allOrders = orders || [];

        // 1. Today's Revenue
        const today = new Date();
        const todayStr = today.toDateString();
        const todayRevenue = allOrders
          .filter(o => new Date(o.created_at).toDateString() === todayStr)
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        const yesterdayRevenue = allOrders
          .filter(o => new Date(o.created_at).toDateString() === yesterdayStr)
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        const dailyDiff = todayRevenue - yesterdayRevenue;
        const dailyPercent = yesterdayRevenue > 0 ? (dailyDiff / yesterdayRevenue) * 100 : 0;

        // 2. This Week's Revenue (Monday to Sunday)
        const startOfWeek = new Date();
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0,0,0,0);

        const thisWeekRevenue = allOrders
          .filter(o => new Date(o.created_at) >= startOfWeek)
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
        const lastWeekRevenue = allOrders
          .filter(o => {
            const d = new Date(o.created_at);
            return d >= startOfLastWeek && d < startOfWeek;
          })
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        const weeklyDiff = thisWeekRevenue - lastWeekRevenue;
        const weeklyPercent = lastWeekRevenue > 0 ? (weeklyDiff / lastWeekRevenue) * 100 : 0;

        // 3. This Month's Revenue
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0,0,0,0);

        const thisMonthRevenue = allOrders
          .filter(o => new Date(o.created_at) >= startOfMonth)
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        const startOfLastMonth = new Date(startOfMonth);
        startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
        const lastMonthRevenue = allOrders
          .filter(o => {
            const d = new Date(o.created_at);
            return d >= startOfLastMonth && d < startOfMonth;
          })
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        const monthlyDiff = thisMonthRevenue - lastMonthRevenue;
        const monthlyPercent = lastMonthRevenue > 0 ? (monthlyDiff / lastMonthRevenue) * 100 : 0;

        // 4. Weekly Trend (Last 7 days, including today)
        const weeklyData = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          const targetStr = d.toDateString();
          const dailyRev = allOrders
            .filter(o => new Date(o.created_at).toDateString() === targetStr)
            .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
          weeklyData.push({ day: dayName, revenue: dailyRev });
        }

        // 5. Monthly Trend (Last 5 months)
        const monthlyData = [];
        for (let i = 4; i >= 0; i--) {
          const d = new Date();
          d.setDate(1); // Avoid day-overflow (e.g. Feb 30th overflowing to Mar 2nd)
          d.setMonth(d.getMonth() - i);
          const monthName = d.toLocaleDateString('en-US', { month: 'short' });
          const targetMonth = d.getMonth();
          const targetYear = d.getFullYear();

          const monthlyRev = allOrders
            .filter(o => {
              const dateObj = new Date(o.created_at);
              return dateObj.getMonth() === targetMonth && dateObj.getFullYear() === targetYear;
            })
            .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

          monthlyData.push({ month: monthName, revenue: monthlyRev });
        }

        setMetrics({
          todayRevenue,
          dailyPercent,
          thisWeekRevenue,
          weeklyPercent,
          thisMonthRevenue,
          monthlyPercent,
        });
        setWeeklyTrend(weeklyData);
        setMonthlyTrend(monthlyData);
      } catch (err) {
        console.error('Error fetching revenue data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRevenueData();
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
        <h1>Revenue Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Track your café's financial performance over time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <h3>Today's Revenue</h3>
          </div>
          <p className="text-4xl font-bold mb-2">₹{metrics.todayRevenue.toLocaleString('en-IN')}</p>
          <p className={`text-sm ${metrics.dailyPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {metrics.dailyPercent >= 0 ? '+' : ''}{metrics.dailyPercent.toFixed(1)}% vs yesterday
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h3>This Week</h3>
          </div>
          <p className="text-4xl font-bold mb-2">₹{metrics.thisWeekRevenue.toLocaleString('en-IN')}</p>
          <p className={`text-sm ${metrics.weeklyPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {metrics.weeklyPercent >= 0 ? '+' : ''}{metrics.weeklyPercent.toFixed(1)}% vs last week
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <h3>This Month</h3>
          </div>
          <p className="text-4xl font-bold mb-2">₹{metrics.thisMonthRevenue.toLocaleString('en-IN')}</p>
          <p className={`text-sm ${metrics.monthlyPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {metrics.monthlyPercent >= 0 ? '+' : ''}{metrics.monthlyPercent.toFixed(1)}% vs last month
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="mb-6">Weekly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyTrend}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']} />
            <Bar dataKey="revenue" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="mb-6">Monthly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyTrend}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-primary)"
              strokeWidth={3}
              dot={{ fill: "var(--color-primary)", r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
