import { Target, TrendingUp, Users, Clock, Percent } from "lucide-react";
import { useState } from "react";

const campaigns = [
  {
    tier: "Standard",
    estimatedDiners: "120-180",
    reach: "15,000+",
    repeatProbability: "72%",
    audienceQuality: "High",
    occupancyImpact: "+18%",
    conversionRate: "2.4%",
    trustScore: 8.5,
  },
  {
    tier: "Growth",
    estimatedDiners: "220-300",
    reach: "28,000+",
    repeatProbability: "68%",
    audienceQuality: "Very High",
    occupancyImpact: "+25%",
    conversionRate: "3.1%",
    trustScore: 9.2,
  },
  {
    tier: "Premium",
    estimatedDiners: "400-550",
    reach: "50,000+",
    repeatProbability: "75%",
    audienceQuality: "Premium",
    occupancyImpact: "+35%",
    conversionRate: "3.8%",
    trustScore: 9.6,
  },
];

export function GrowthPlans() {
  const [customBudget, setCustomBudget] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("all");

  const goals = [
    "Repeat Visits",
    "New Footfall",
    "Weekday Occupancy",
    "Premium Diners",
    "Group Visits",
  ];

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1>Growth Engine</h1>
        <p className="text-muted-foreground mt-1">
          Intelligently acquire customers based on behavior, trust signals, and
          dining patterns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign, index) => (
          <div
            key={index}
            className="bg-card rounded-2xl p-6 border border-border relative overflow-hidden group hover:shadow-2xl hover:shadow-primary/10 transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-bl-full blur-2xl" />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold">{campaign.tier}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Campaign Tier
                  </p>
                </div>
                <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium flex items-center gap-1">
                  <span>Trust Score</span>
                  <span className="font-bold">{campaign.trustScore}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Est. New Diners
                    </p>
                    <p className="font-semibold">
                      {campaign.estimatedDiners} customers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Estimated Reach
                    </p>
                    <p className="font-semibold">{campaign.reach} people</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Repeat Probability
                    </p>
                    <p className="font-semibold">
                      {campaign.repeatProbability}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Percent className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Conversion Rate
                    </p>
                    <p className="font-semibold">{campaign.conversionRate}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      Audience Quality
                    </span>
                    <span className="font-medium text-primary">
                      {campaign.audienceQuality}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Occupancy Impact
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {campaign.occupancyImpact}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full mt-6 py-3 px-4 bg-muted/40 text-muted-foreground rounded-xl text-center font-medium text-xs border border-border select-none">
                Collecting data for now
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl p-8 border border-border">
        <h2 className="mb-6">Custom Campaign Builder</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block mb-2">Campaign Budget</label>
              <input
                type="number"
                value={customBudget}
                onChange={(e) => setCustomBudget(e.target.value)}
                placeholder="Enter amount in ₹"
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block mb-2">Target Audience</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Audiences</option>
                <option value="local">Local Residents (5km radius)</option>
                <option value="professionals">Working Professionals</option>
                <option value="students">Students & Youth</option>
                <option value="families">Families</option>
                <option value="premium">Premium Diners</option>
              </select>
            </div>

            <div>
              <label className="block mb-3">Campaign Goals</label>
              <div className="flex flex-wrap gap-2">
                {goals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedGoals.includes(goal)
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-accent text-accent-foreground hover:bg-accent/70"
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl p-6 border border-primary/10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <h3 className="text-sm font-medium text-primary">
                SNYF AI Prediction
              </h3>
            </div>

            {customBudget ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Estimated Reach
                  </p>
                  <p className="text-2xl font-bold">
                    {Math.round(parseInt(customBudget) * 1.8).toLocaleString()}{" "}
                    people
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Expected New Diners
                  </p>
                  <p className="text-2xl font-bold">
                    {Math.round(parseInt(customBudget) * 0.025)}-
                    {Math.round(parseInt(customBudget) * 0.035)} customers
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Predicted ROI
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {(Math.random() * 2 + 2).toFixed(1)}x
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Behavioral Match Quality
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-accent/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        style={{ width: "85%" }}
                      />
                    </div>
                    <span className="text-sm font-medium">85%</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">
                    Targeting Strategy
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      Rush Hours Focus
                    </span>
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      High Intent Users
                    </span>
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      Local Proximity
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Enter a budget to see AI predictions
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 sm:p-8 border border-border mt-8 overflow-hidden relative">
        {/* Animated gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-primary animate-[shimmer_3s_infinite_linear] bg-[length:200%_auto]" />
        
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>

        <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
              </span>
              <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                Future Feature: Snyf Growth Engine
              </span>
            </div>
            
            <h3 className="text-xl font-bold text-foreground">
              Collecting Data for Predictive Campaign Targeting
            </h3>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              We are currently gathering visit metrics, average order tickets, and peak hourly traffic from your live database. Once fully initialized, this growth engine will allow you to design custom push notifications, tailored discounts, and peak-hour incentives that target relevant customer profiles to optimize your cafe's daily table occupancy.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2 bg-accent/5 p-2 rounded-xl border border-border/40">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span>Behavior-matched Targeting</span>
              </div>
              <div className="flex items-center gap-2 bg-accent/5 p-2 rounded-xl border border-border/40">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span>Automated Push Campaigns</span>
              </div>
              <div className="flex items-center gap-2 bg-accent/5 p-2 rounded-xl border border-border/40">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span>Guaranteed ROI Tracking</span>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-center justify-center p-5 bg-accent/5 rounded-2xl border border-border/80 min-w-[240px]">
            <span className="text-[11px] text-muted-foreground font-medium mb-1.5">System Status</span>
            <span className="text-xs font-semibold text-primary mb-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              Ingesting Visit Metrics
            </span>
            <div className="w-full bg-border rounded-full h-1 overflow-hidden">
              <div className="bg-primary h-1 rounded-full animate-[shimmer_2s_infinite_linear] bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto]" />
            </div>
            <span className="text-[10px] text-muted-foreground mt-2">Collecting live feedback data...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
