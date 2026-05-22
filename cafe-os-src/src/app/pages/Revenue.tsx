import { TrendingUp, DollarSign, Calendar } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const weeklyData = [
  { day: "Mon", revenue: 12400 },
  { day: "Tue", revenue: 15600 },
  { day: "Wed", revenue: 18200 },
  { day: "Thu", revenue: 14800 },
  { day: "Fri", revenue: 22300 },
  { day: "Sat", revenue: 28900 },
  { day: "Sun", revenue: 25600 },
];

const monthlyData = [
  { month: "Jan", revenue: 245000 },
  { month: "Feb", revenue: 268000 },
  { month: "Mar", revenue: 292000 },
  { month: "Apr", revenue: 315000 },
  { month: "May", revenue: 378000 },
];

export function Revenue() {
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
          <p className="text-4xl font-bold mb-2">₹28,450</p>
          <p className="text-sm text-green-600 dark:text-green-400">
            +15.3% vs yesterday
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h3>This Week</h3>
          </div>
          <p className="text-4xl font-bold mb-2">₹1,37,800</p>
          <p className="text-sm text-green-600 dark:text-green-400">
            +8.2% vs last week
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <h3>This Month</h3>
          </div>
          <p className="text-4xl font-bold mb-2">₹5,67,890</p>
          <p className="text-sm text-green-600 dark:text-green-400">
            +12.7% vs last month
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="mb-6">Weekly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyData}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="mb-6">Monthly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
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
