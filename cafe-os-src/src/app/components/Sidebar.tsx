import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Users, Megaphone,
  Target, QrCode, Gift, UtensilsCrossed, Store,
  ChevronLeft, ChevronRight, LogOut, HandPlatter
} from 'lucide-react';
import { useState } from 'react';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';

const navItems = [
  { path: '/',          icon: LayoutDashboard, label: 'Overview'          },
  { path: '/kitchen',   icon: UtensilsCrossed, label: 'Kitchen Backend'   },
  { path: '/waiter',    icon: HandPlatter,     label: 'Waiter'            },
  { path: '/menu',      icon: Store,           label: 'Menu Manager'      },
  { path: '/venue',     icon: Store,           label: 'Venue Info'        },
  { path: '/revenue',   icon: TrendingUp,      label: 'Revenue Analytics' },
  { path: '/customers', icon: Users,           label: 'Customer Insights' },
  { path: '/growth',    icon: Target,          label: 'Growth Engine'     },
  { path: '/campaigns', icon: Megaphone,       label: 'Campaigns'         },
  { path: '/qr',        icon: QrCode,          label: 'QR Codes'          },
  { path: '/rewards',   icon: Gift,            label: 'Rewards'           },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { venue, logout }         = useVenue();
  const { isLockedToKitchen, isWaiterMode, setShowUnlockModal, setOnUnlockSuccess } = useLock();
  const navigate = useNavigate();

  if (isWaiterMode) return null;

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} h-screen bg-card border-r border-border transition-all duration-300 flex flex-col select-none`}>

      {/* Brand */}
      <div className="p-6 flex items-center justify-between border-b border-border border-separate">
        {!collapsed && (
          <h1 className="font-semibold text-foreground">
            <span className="text-primary font-bold">SNYF</span> Café OS
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-accent rounded-lg transition-colors cursor-pointer"
        >
          {collapsed
            ? <ChevronRight className="w-5 h-5" />
            : <ChevronLeft  className="w-5 h-5" />
          }
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={isLockedToKitchen && item.path !== '/kitchen' ? '#' : item.path}
            onClick={(e) => {
              if (isLockedToKitchen && item.path !== '/kitchen') {
                e.preventDefault();
                setOnUnlockSuccess(() => {
                  navigate(item.path);
                });
                setShowUnlockModal(true);
              }
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Venue profile + logout */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white">
              {venue?.name?.[0]?.toUpperCase() || 'S'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{venue?.name || 'Café OS'}</p>
              <p className="text-xs text-muted-foreground truncate">{venue?.zone || 'Snyf Partner'}</p>
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            if (isLockedToKitchen) {
              e.preventDefault();
              setOnUnlockSuccess(() => {
                logout();
              });
              setShowUnlockModal(true);
            } else {
              logout();
            }
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

    </aside>
  );
}
