import { Bell, Search, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useVenue } from '../../context/VenueContext';

export function TopBar() {
  const [isDark, setIsDark] = useState(false);
  const { venue, slug }     = useVenue();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
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
        <div className="flex-1 flex items-center justify-end gap-4">
          <div className="relative">
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
            <Bell className="w-5 h-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
          </div>

          <button onClick={toggleTheme} className="p-2 hover:bg-accent rounded-lg transition-colors">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-xs font-semibold text-white">
              {venue?.name?.[0]?.toUpperCase() || 'S'}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
}
