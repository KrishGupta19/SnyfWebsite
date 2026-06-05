import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Users, Megaphone,
  Target, QrCode, Gift, UtensilsCrossed, Store,
  ChevronLeft, ChevronRight, LogOut, HandPlatter,
  Settings, ChevronDown, Receipt, Palette, Package
} from 'lucide-react';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';

const navItems = [
  { path: '/',          icon: LayoutDashboard, label: 'Overview'          },
  { path: '/kitchen',   icon: UtensilsCrossed, label: 'Kitchen Backend'   },
  { path: '/waiter',    icon: HandPlatter,     label: 'Waiter'            },
  { path: '/menu',      icon: Store,           label: 'Menu Manager'      },
  { path: '/inventory', icon: Package,         label: 'Inventory & Recipes'},
  { path: '/bills',     icon: Receipt,         label: 'Bills'             },
];

const profileItems = [
  { path: '/venue',     icon: Store,           label: 'Venue Info'        },
  { path: '/customize', icon: Palette,         label: 'Customize Site'    },
  { path: '/revenue',   icon: TrendingUp,      label: 'Revenue Analytics' },
  { path: '/customers', icon: Users,           label: 'Customer Insights' },
  { path: '/growth',    icon: Target,          label: 'Growth Engine'     },
  { path: '/campaigns', icon: Megaphone,       label: 'Campaigns'         },
  { path: '/qr',        icon: QrCode,          label: 'QR Codes'          },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
      <nav className="flex-1 p-4 overflow-y-auto scrollbar-none flex flex-col justify-start">
        {navItems.map((item, idx) => (
          <React.Fragment key={item.path}>
            {idx > 0 && (
              <div 
                className={`transition-all duration-500 ease-in-out ${
                  profileMenuOpen && !collapsed
                    ? 'h-2.5'
                    : 'h-16'
                }`} 
              />
            )}
            <NavLink
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
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 transform hover:translate-x-1 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-semibold scale-[1.02]'
                    : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </NavLink>
          </React.Fragment>
        ))}

        {/* Inline Management menu with smooth height expand animation */}
        {!collapsed && (
          <div 
            className={`grid transition-all duration-500 ease-in-out border-t border-border/0 ${
              profileMenuOpen 
                ? 'grid-rows-[1fr] opacity-100 mt-6 pt-4 border-border/60' 
                : 'grid-rows-[0fr] opacity-0 mt-0 pt-0'
            }`}
          >
            <div className="overflow-hidden space-y-1.5">
              <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1">
                <Settings className="w-3.5 h-3.5" />
                <span>Management & Settings</span>
              </div>
              
              {/* Indented nested tree layout */}
              <div className="border-l border-border/80 ml-5 pl-3 space-y-1.5">
                {profileItems.map(item => (
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
                      `flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 transform hover:translate-x-1 ${
                        isActive
                          ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-sm shadow-primary/5'
                          : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'
                      }`
                    }
                  >
                    <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Venue profile + logout */}
      <div className="p-4 border-t border-border space-y-2 relative">
        {profileMenuOpen && collapsed && (
          <>
            {/* Backdrop to close the menu when clicking outside (only when collapsed) */}
            <div 
              className="fixed inset-0 z-40 cursor-default" 
              onClick={() => setProfileMenuOpen(false)} 
            />
            
            {/* Floating Dropdown Menu (only when collapsed) */}
            <div className="absolute z-50 bg-card border border-border rounded-xl shadow-2xl p-2.5 space-y-1 bottom-16 left-full ml-3 w-56 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1">
                <Settings className="w-3.5 h-3.5" />
                <span>Management</span>
              </div>
              {profileItems.map(item => (
                <NavLink
                  key={item.path}
                  to={isLockedToKitchen && item.path !== '/kitchen' ? '#' : item.path}
                  onClick={(e) => {
                    setProfileMenuOpen(false);
                    if (isLockedToKitchen && item.path !== '/kitchen') {
                      e.preventDefault();
                      setOnUnlockSuccess(() => {
                        navigate(item.path);
                      });
                      setShowUnlockModal(true);
                    }
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 transform hover:translate-x-1 ${
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20'
                        : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </>
        )}

        <div 
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent hover:border-border hover:bg-accent/40 transition-all duration-200 cursor-pointer select-none active:scale-98 ${
            profileMenuOpen ? 'bg-accent/60 border-border/80' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-primary/20">
            <span className="text-xs font-semibold text-white">
              {venue?.name?.[0]?.toUpperCase() || 'S'}
            </span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground leading-none">{venue?.name || 'Café OS'}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-1.5 font-medium tracking-wide uppercase">{venue?.zone || 'Snyf Partner'}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform duration-300 ${profileMenuOpen ? 'rotate-180 text-primary' : ''}`} />
            </>
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
