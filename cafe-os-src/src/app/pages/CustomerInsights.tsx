import { Users, Clock, TrendingUp, Heart } from "lucide-react";
import { useEffect, useState } from 'react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';

export function CustomerInsights() {
  const { venue }            = useVenue();
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (!venue?.id) return;
    db.from('field_reports')
      .select('id', { count: 'exact' })
      .eq('venue_id', venue.id)
      .eq('verified', true)
      .then(({ count }) => setReviewCount(count || 0));
  }, [venue?.id]);

  const visitTimings = [
    { hour: "6 AM", value: 5 },
    { hour: "8 AM", value: 25 },
    { hour: "10 AM", value: 45 },
    { hour: "12 PM", value: 85 },
    { hour: "2 PM", value: 70 },
    { hour: "4 PM", value: 40 },
    { hour: "6 PM", value: 65 },
    { hour: "8 PM", value: 90 },
    { hour: "10 PM", value: 55 },
  ];

  const spendingBehavior = [
    { range: "₹0-500", count: 245, percent: 25 },
    { range: "₹500-1000", count: 458, percent: 35 },
    { range: "₹1000-2000", count: 342, percent: 28 },
    { range: "₹2000+", count: 156, percent: 12 },
  ];

  const repeatCustomers = [
    { name: "Rajesh Kumar", visits: 28, lastVisit: "Today", avgSpend: "₹1,850" },
    { name: "Priya Sharma", visits: 24, lastVisit: "Yesterday", avgSpend: "₹1,420" },
    { name: "Amit Patel", visits: 21, lastVisit: "2 days ago", avgSpend: "₹2,150" },
    { name: "Sneha Reddy", visits: 19, lastVisit: "Today", avgSpend: "₹1,680" },
    { name: "Vikram Singh", visits: 17, lastVisit: "3 days ago", avgSpend: "₹1,940" },
  ];

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
          <h3 className="text-3xl font-bold">68.5%</h3>
          <p className="text-sm text-muted-foreground mt-1">Repeat Customers</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            +5.2% from last month
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-bold">42 min</h3>
          <p className="text-sm text-muted-foreground mt-1">Avg. Visit Time</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            +8 min increase
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-bold">₹1,650</h3>
          <p className="text-sm text-muted-foreground mt-1">Avg. Spending</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            +12.3% increase
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="p-2 bg-primary/10 rounded-lg w-fit mb-4">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-bold">{reviewCount}</h3>
          <p className="text-sm text-muted-foreground mt-1">Verified Reviews</p>
          <p className="text-xs text-muted-foreground mt-2">From orders via Snyf</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-6">Visit Timing Heatmap</h3>
          <div className="space-y-3">
            {visitTimings.map((slot, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{slot.hour}</span>
                  <span className="text-muted-foreground">
                    {slot.value} visits
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
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-6">Spending Behavior</h3>
          <div className="space-y-4">
            {spendingBehavior.map((segment, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{segment.range}</span>
                  <span className="text-sm text-muted-foreground">
                    {segment.count} customers
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
              {repeatCustomers.map((customer, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border hover:bg-accent/30 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-sm">
                        {customer.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="font-medium">{customer.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {customer.visits} visits
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm">{customer.lastVisit}</td>
                  <td className="py-4 px-4 font-medium">{customer.avgSpend}</td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                      VIP
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-4">Peak Hours</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
              <span className="text-sm">Lunch Rush</span>
              <span className="font-semibold">12 PM - 2 PM</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
              <span className="text-sm">Dinner Peak</span>
              <span className="font-semibold">7 PM - 9 PM</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg">
              <span className="text-sm">Morning Coffee</span>
              <span className="font-semibold">9 AM - 11 AM</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-4">Group Patterns</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Solo Diners</span>
              <span className="font-semibold">18%</span>
            </div>
            <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "18%" }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Couples</span>
              <span className="font-semibold">42%</span>
            </div>
            <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "42%" }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Groups (3-5)</span>
              <span className="font-semibold">32%</span>
            </div>
            <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "32%" }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Large Groups (6+)</span>
              <span className="font-semibold">8%</span>
            </div>
            <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: "8%" }}
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="mb-4">Sentiment Trends</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Ambience</span>
                <span className="text-sm font-semibold">9.2/10</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  style={{ width: "92%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Service Quality</span>
                <span className="text-sm font-semibold">8.8/10</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  style={{ width: "88%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Food Quality</span>
                <span className="text-sm font-semibold">9.1/10</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  style={{ width: "91%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Value for Money</span>
                <span className="text-sm font-semibold">8.5/10</span>
              </div>
              <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  style={{ width: "85%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
