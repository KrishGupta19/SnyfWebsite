import { useState, useEffect, useRef } from 'react';
import { Clock, ChefHat, CheckCircle, Wifi, WifiOff, Edit, Plus, Minus, Trash2, X, Bell, Lock, ShieldAlert, Search } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';
import {
  Order, OrderStatus, MenuItem,
  ORDER_STATUS_LABELS, ORDER_STATUS_FLOW,
} from '../../lib/types';

export function KitchenBackend() {
  const { venue }                   = useVenue();
  const { isLockedToKitchen, lockInterface, setShowUnlockModal } = useLock();
  const [orders,    setOrders]      = useState<Order[]>([]);
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [paymentConfirmOrder, setPaymentConfirmOrder] = useState<Order | null>(null);
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [loading,   setLoading]     = useState(true);
  const [connected, setConnected]   = useState(false);
  const [newOrderId, setNewOrderId] = useState<string | null>(null);
  const [updatedOrderId, setUpdatedOrderId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'completed'>('pending');
  const channelRef                  = useRef<ReturnType<typeof db.channel> | null>(null);
  const audioContextRef             = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!editingOrder) {
      setSearchItemQuery('');
      setSearchFocused(false);
    }
  }, [editingOrder]);

  function getAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }

  useEffect(() => {
    // Resume audio context on any user interaction to comply with browser autoplay policies
    const resumeAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);

    if (!venue?.id) return;
    fetchOrders();
    fetchMenuItems();
    subscribeToOrders();
    return () => {
      if (channelRef.current) db.removeChannel(channelRef.current);
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, [venue?.id]);

  useEffect(() => {
    if (!venue?.id) return;
    
    // Fallback polling: fetch orders every 10 seconds when not connected to realtime
    const interval = setInterval(() => {
      if (!connected) {
        fetchOrders();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [venue?.id, connected]);

  async function fetchMenuItems() {
    try {
      const { data, error } = await db
        .from('menu_items')
        .select('*')
        .eq('venue_id', venue.id)
        .eq('available', true)
        .order('name');
      if (error) throw error;
      setMenuItems((data || []) as MenuItem[]);
    } catch (err) {
      console.error('[Kitchen] fetchMenuItems:', err);
    }
  }

  // ── Fetch active orders ──────────────────────────────────────
  async function fetchOrders() {
    if (!venue?.id) return;
    const isInitialLoad = orders.length === 0;
    if (isInitialLoad) setLoading(true);
    
    try {
      const { data, error } = await db
        .from('orders')
        .select('*')
        .eq('venue_id', venue.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const newOrders = (data || []) as Order[];

      // If we are not connected and already have orders loaded, check for new/updated items
      if (!isInitialLoad && !connected) {
        newOrders.forEach(newOrder => {
          const oldOrder = orders.find(o => o.id === newOrder.id);
          if (!oldOrder) {
            // New order placed!
            setNewOrderId(newOrder.id);
            setTimeout(() => setNewOrderId(null), 4000);
            
            const count = getHelpCallCount(newOrder.special_instructions);
            if (count > 0) {
              playHelpCallAlarm(count);
            } else {
              playAlert();
            }
          } else {
            // Check if items added (addon)
            const oldQty = (oldOrder.items || []).reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
            const newQty = (newOrder.items || []).reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
            if (newQty > oldQty) {
              playAlert();
              setUpdatedOrderId(newOrder.id);
              setTimeout(() => setUpdatedOrderId(null), 4000);
            }

            // Check if help call count increased
            const oldHelpCount = getHelpCallCount(oldOrder.special_instructions);
            const newHelpCount = getHelpCallCount(newOrder.special_instructions);
            if (newHelpCount > oldHelpCount) {
              playHelpCallAlarm(newHelpCount);
            }
          }
        });
      }

      setOrders(newOrders);
    } catch (err) {
      console.error('[Kitchen] fetchOrders:', err);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  const getHelpCallCount = (instr?: string | null) => {
    if (!instr) return 0;
    const match = instr.match(/\[HELP REQUESTED(?: x(\d+))?\]/);
    if (!match) return 0;
    return match[1] ? parseInt(match[1], 10) : 1;
  };

  // ── Supabase Realtime subscription ──────────────────────────
  function subscribeToOrders() {
    if (!venue?.id) return;

    const channel = db
      .channel(`kitchen-${venue.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'orders',
          filter: `venue_id=eq.${venue.id}`,
        },
        (payload) => {
          const newOrder = payload.new as Order;
          setOrders(prev => [newOrder, ...prev]);
          setNewOrderId(newOrder.id);
          setTimeout(() => setNewOrderId(null), 4000);
          
          const count = getHelpCallCount(newOrder.special_instructions);
          if (count > 0) {
            playHelpCallAlarm(count);
          } else {
            playAlert();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'orders',
          filter: `venue_id=eq.${venue.id}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          setOrders(prev => {
            const existing = prev.find(o => o.id === updated.id);
            const wasHelping = existing?.special_instructions?.includes('[HELP REQUESTED]');
            const isHelping = updated.special_instructions?.includes('[HELP REQUESTED]');
            
            const prevCount = getHelpCallCount(existing?.special_instructions);
            const currentCount = getHelpCallCount(updated.special_instructions);

            if (currentCount > prevCount || (isHelping && !wasHelping)) {
              playHelpCallAlarm(currentCount || 1);
            }

            if (existing) {
              const prevQty = (existing.items || []).reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
              const newQty = (updated.items || []).reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
              if (newQty > prevQty) {
                playAlert();
                setUpdatedOrderId(updated.id);
                setTimeout(() => setUpdatedOrderId(null), 4000);
              }
            }

            return prev.map(o => o.id === updated.id ? updated : o);
          });
        }
      )
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));

    channelRef.current = channel;
  }

  function playAlert() {
    try {
      const ctx  = getAudioContext();
      const now  = ctx.currentTime;
      const duration = 2.5; // Bell sound duration of 2.5 seconds

      // Frequencies corresponding to standard bell overtones (harmonics + minor/major triad resonance)
      const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6 (rich C Major chime)

      frequencies.forEach((freq, index) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        // Add frequency detuning for a rich, warm, metallic chorus/vibrato
        osc.detune.setValueAtTime(index * 6, now);

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Bell envelope: instant attack (20ms) and exponential decay
        const initialGain = index === 0 ? 0.25 : 0.15 / (index + 1);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(initialGain, now + 0.02);

        // Higher frequencies decay faster to replicate authentic bell acoustics
        const decayTime = duration * Math.pow(0.8, index);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.6, decayTime));

        osc.start(now);
        osc.stop(now + duration);
      });
    } catch { /* silent if audio unavailable */ }
  }

  function playHelpCallAlarm(count = 1) {
    try {
      const ctx  = getAudioContext();
      const playBeep = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Pitch increases with successive calls to sound sharper and more urgent
        const pitchMultiplier = 1 + Math.min(count - 1, 4) * 0.1;
        osc.frequency.setValueAtTime(freq * pitchMultiplier, time);
        
        // Volume/gain increases as count climbs
        const volume = Math.min(0.4 + (count - 1) * 0.2, 1.0);
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        
        osc.start(time);
        osc.stop(time + dur);
      };

      const now = ctx.currentTime;
      // Alarm repeat speed speeds up with count
      const speed = count >= 3 ? 0.7 : count === 2 ? 0.85 : 1.0;
      
      playBeep(now, 987.77, 0.15 * speed);
      playBeep(now + 0.18 * speed, 1318.51, 0.25 * speed);
      playBeep(now + 0.4 * speed, 987.77, 0.15 * speed);
      playBeep(now + 0.58 * speed, 1318.51, 0.35 * speed);

      // Play dramatic supplementary alarms for repeat calls
      if (count >= 2) {
        playBeep(now + 0.9 * speed, 1567.98, 0.2 * speed);
      }
      if (count >= 3) {
        playBeep(now + 1.1 * speed, 1975.53, 0.3 * speed);
      }
    } catch { /* silent if audio unavailable */ }
  }

  async function dismissHelpCall(order: Order) {
    if (!order.special_instructions) return;
    
    let updatedInstr = order.special_instructions
      .replace(/\s*\|\s*\[HELP REQUESTED(?: x\d+)?\]/gi, '')
      .replace(/\[HELP REQUESTED(?: x\d+)?\]\s*\|\s*/gi, '')
      .replace(/\[HELP REQUESTED(?: x\d+)?\]/gi, '')
      .trim();
    
    if (updatedInstr.endsWith('|')) {
      updatedInstr = updatedInstr.slice(0, -1).trim();
    }
    if (updatedInstr.startsWith('|')) {
      updatedInstr = updatedInstr.slice(1).trim();
    }
    
    try {
      const { error } = await db
        .from('orders')
        .update({
          special_instructions: updatedInstr || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (error) throw error;
      
      // Update local state so UI updates immediately
      setOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        special_instructions: updatedInstr || null,
        updated_at: new Date().toISOString()
      } : o));
      
    } catch (err) {
      console.error('Failed to dismiss help call:', err);
    }
  }

  // ── Advance status ────────────────────────────────────────────
  async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    try {
      const { error } = await db
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err) {
      console.error('[Kitchen] updateStatus:', err);
      fetchOrders(); // revert on failure
    }
  }

  async function advanceToDeliver(orderId: string) {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { 
      ...o, 
      is_advanced_to_deliver: true,
      updated_at: new Date().toISOString()
    } : o));
    
    try {
      const { error } = await db
        .from('orders')
        .update({ 
          is_advanced_to_deliver: true,
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err) {
      console.error('[Kitchen] advanceToDeliver:', err);
      fetchOrders();
    }
  }

  // ── Edit Modal Actions ─────────────────────────────────────────
  function openEditModal(order: Order) {
    setEditingOrder(JSON.parse(JSON.stringify(order)));
  }

  function updateItemQty(itemId: string, delta: number) {
    if (!editingOrder) return;
    const updatedItems = editingOrder.items.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    });
    setEditingOrder({ ...editingOrder, items: updatedItems });
  }

  function removeItemFromOrder(itemId: string) {
    if (!editingOrder) return;
    const updatedItems = editingOrder.items.filter(item => item.id !== itemId);
    setEditingOrder({ ...editingOrder, items: updatedItems });
  }

  function addItemToOrder(menuItem: MenuItem) {
    if (!editingOrder) return;
    const exists = editingOrder.items.some(item => item.id === menuItem.id);
    if (exists) {
      updateItemQty(menuItem.id, 1);
      return;
    }
    const newItem = {
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty: 1
    };
    setEditingOrder({
      ...editingOrder,
      items: [...editingOrder.items, newItem]
    });
  }

  async function saveEditedOrder() {
    if (!editingOrder) return;
    const { subtotal, gst, service_charge, total } = recalculateOrderTotals(editingOrder.items);
    
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === editingOrder.id ? {
      ...o,
      items: editingOrder.items,
      special_instructions: editingOrder.special_instructions,
      subtotal,
      gst,
      service_charge,
      total
    } : o));

    const orderToSave = editingOrder;
    setEditingOrder(null);

    try {
      const { error } = await db
        .from('orders')
        .update({
          items: orderToSave.items,
          special_instructions: orderToSave.special_instructions,
          subtotal,
          gst,
          service_charge,
          total,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderToSave.id);
      if (error) throw error;
    } catch (err) {
      console.error('[Kitchen] saveEditedOrder:', err);
      fetchOrders(); // revert
    }
  }

  async function dismissHelpCall(order: Order) {
    const isVirtual = !order.items || order.items.length === 0;

    // Strip the [HELP REQUESTED] flag from special_instructions
    const cleared = (order.special_instructions || '')
      .replace(/\s*\|\s*\[HELP REQUESTED(?: x\d+)?\]/gi, '')
      .replace(/\[HELP REQUESTED(?: x\d+)?\]\s*\|\s*/gi, '')
      .replace(/\[HELP REQUESTED(?: x\d+)?\]/gi, '')
      .trim();

    // Optimistically update local state immediately
    if (isVirtual) {
      setOrders(prev => prev.filter(o => o.id !== order.id));
    } else {
      setOrders(prev => prev.map(o =>
        o.id === order.id
          ? { ...o, special_instructions: cleared || null }
          : o
      ));
    }

    try {
      if (isVirtual) {
        const { error } = await db
          .from('orders')
          .delete()
          .eq('id', order.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('orders')
          .update({
            special_instructions: cleared || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error('[Kitchen] dismissHelpCall:', err);
      fetchOrders(); // revert on error
    }
  }

  function recalculateOrderTotals(items: any[]) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const gst = Math.round(subtotal * 0.18); // 18% GST
    const service_charge = 0;
    const total = subtotal + gst;
    return { subtotal, gst, service_charge, total };
  }

  const KITCHEN_FLOW: OrderStatus[] = ['received', 'delivered', 'ready'];

  function getNextStatus(current: OrderStatus): OrderStatus | null {
    const idx = KITCHEN_FLOW.indexOf(current);
    return idx >= 0 && idx < KITCHEN_FLOW.length - 1 ? KITCHEN_FLOW[idx + 1] : null;
  }

  function getStatusColor(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      received:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      preparing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      ready:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      gathering: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      serving:   'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      delivered: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return map[status];
  }

  function timeElapsed(createdAt: string): string {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    return `${mins} min ago`;
  }

  function isLate(createdAt: string): boolean {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000) > 15;
  }

  const pendingCount   = orders.filter(o => (o.status === 'received' || o.status === 'delivered') && (o.items && o.items.length > 0)).length;
  const completedCount = orders.filter(o => o.status === 'ready' && (o.items && o.items.length > 0)).length;
  const helpOrders     = orders.filter(o => o.special_instructions?.includes('[HELP REQUESTED]'));
  const helpCount      = helpOrders.length;
  const lateCount      = orders.filter(o => isLate(o.created_at) && o.status !== 'ready' && (o.items && o.items.length > 0)).length;

  const filteredOrders = orders.filter(order => {
    // Exclude virtual help calls
    if (!order.items || order.items.length === 0) return false;

    if (activeFilter === 'pending') {
      return order.status === 'received' || order.status === 'delivered';
    } else {
      return order.status === 'ready';
    }
  });

  return (
    <div className="p-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1>Kitchen Backend</h1>
          <p className="text-muted-foreground mt-1">
            Live order management — updates in real time
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">

          {/* Realtime connection badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
            connected
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-900/30'
          }`}>
            {connected
              ? <><Wifi className="w-4 h-4" /> Live</>
              : <><WifiOff className="w-4 h-4" /> Connecting...</>
            }
          </div>

          {/* Pending Filter Tab */}
          <button
            onClick={() => setActiveFilter('pending')}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl border text-left transition-all ${
              activeFilter === 'pending'
                ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900 ring-2 ring-orange-500/10 font-bold'
                : 'bg-card text-muted-foreground border-border hover:bg-accent/50'
            }`}
          >
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">Pending</span>
              <span className="text-xl font-extrabold leading-none mt-0.5">{pendingCount}</span>
            </div>
          </button>

          {/* Completed Filter Tab */}
          <button
            onClick={() => setActiveFilter('completed')}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl border text-left transition-all ${
              activeFilter === 'completed'
                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900 ring-2 ring-green-500/10 font-bold'
                : 'bg-card text-muted-foreground border-border hover:bg-accent/50'
            }`}
          >
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">Completed</span>
              <span className="text-xl font-extrabold leading-none mt-0.5">{completedCount}</span>
            </div>
          </button>

          {/* Help indicator pill — appears only when ≥1 orders need help */}
          {helpCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-yellow-300 bg-yellow-400 dark:bg-yellow-500 text-black font-bold text-sm animate-pulse shadow-md shadow-yellow-300/40">
              <Bell className="w-4 h-4 animate-bounce" />
              {helpCount === 1 ? '1 Table Needs Help' : `${helpCount} Tables Need Help`}
            </div>
          )}

          {/* Parental Lock Toggle Button */}
          <button
            onClick={() => {
              if (isLockedToKitchen) {
                setShowUnlockModal(true);
              } else {
                lockInterface();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border cursor-pointer ${
              isLockedToKitchen
                ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
            }`}
          >
            {isLockedToKitchen ? (
              <><ShieldAlert className="w-4 h-4" /> Locked</>
            ) : (
              <><Lock className="w-4 h-4" /> Lock OS</>
            )}
          </button>

          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/70 transition-colors border border-border cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── OVERALL TOP WAITER CALLS DASHBOARD ────────────────── */}
      {helpOrders.length > 0 && (
        <div className="bg-neutral-950 text-white rounded-2xl p-5 border border-red-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse ring-4 ring-red-500/30" />
              <h2 className="text-sm font-black tracking-wider uppercase text-neutral-200">
                Active Table Assistance Calls ({helpOrders.length})
              </h2>
            </div>
            <button 
              onClick={async () => {
                // Dimiss all active help calls
                for (const order of helpOrders) {
                  await dismissHelpCall(order);
                }
              }}
              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider cursor-pointer bg-red-950/30 border border-red-900/50 px-3 py-1.5 rounded-lg"
            >
              Dismiss All Calls
            </button>
          </div>
          
          {/* Scrollable / wrap container for mobile-optimized experience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {helpOrders.map(order => {
              const count = getHelpCallCount(order.special_instructions);
              
              let cardClass = "bg-yellow-400 dark:bg-yellow-500 text-black border-yellow-500";
              let bellClass = "w-4 h-4 animate-bounce text-black";
              let cardStyle: React.CSSProperties = {};

              if (count === 2) {
                cardClass = "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-600 shadow-md shadow-orange-500/20";
                bellClass = "w-4 h-4 animate-bounce text-white";
                cardStyle = { textShadow: '0 1px 2px rgba(0,0,0,0.1)' };
              } else if (count >= 3) {
                cardClass = "bg-gradient-to-r from-red-600 to-orange-600 text-white border-red-700 animate-pulse shadow-lg shadow-red-600/35";
                bellClass = "w-5 h-5 animate-[spin_1.5s_linear_infinite] text-white";
                cardStyle = { fontWeight: 900 };
              }

              const isVirtualHelp = !order.items || order.items.length === 0;

              return (
                <div 
                  key={`top-help-${order.id}`}
                  className={`${cardClass} flex items-center justify-between gap-4 px-4 py-3 rounded-xl border font-bold text-sm shadow transition-all duration-300 hover:scale-[1.02]`}
                  style={cardStyle}
                >
                  <div className="flex items-center gap-2">
                    <Bell className={bellClass} />
                    <span>
                      Table {order.table_num || 'N/A'} {count > 1 ? `(Called ×${count})` : ''}
                      {isVirtualHelp ? ' 💬' : ' 🍔'}
                    </span>
                  </div>
                  <button
                    onClick={() => dismissHelpCall(order)}
                    className="px-2.5 py-1.5 bg-black/80 text-white hover:bg-neutral-900 text-xs font-semibold rounded-lg transition-all shadow-sm border border-neutral-700/50 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ChefHat className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
          <p className="text-lg font-medium text-muted-foreground">
            No {activeFilter} orders
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeFilter === 'pending'
              ? 'New orders will appear here instantly when customers place orders'
              : 'Completed orders will appear here when you mark them as paid'
            }
          </p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          {filteredOrders.map(order => {
            const count = getHelpCallCount(order.special_instructions);
            const needsHelp = count > 0;
            const displayInstructions = order.special_instructions
              ?.replace(/\s*\|\s*\[HELP REQUESTED(?: x\d+)?\]/gi, '')
              ?.replace(/\[HELP REQUESTED(?: x\d+)?\]\s*\|\s*/gi, '')
              ?.replace(/\[HELP REQUESTED(?: x\d+)?\]/gi, '')
              ?.trim();

            let bannerClass = "bg-yellow-400 dark:bg-yellow-500 text-black border-yellow-500";
            let bellClass = "w-4 h-4 animate-bounce";
            let bannerStyle: React.CSSProperties = {};

            if (count === 2) {
              bannerClass = "bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-500/20";
              bannerStyle = { fontSize: '14px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' };
            } else if (count >= 3) {
              bannerClass = "bg-red-600 text-white border-red-700 animate-pulse shadow-lg shadow-red-600/35";
              bellClass = "w-5 h-5 animate-[spin_1.5s_linear_infinite] text-white";
              bannerStyle = { fontSize: '15px', fontWeight: 900, letterSpacing: '0.08em' };
            }

            return (
              <div
                key={order.id}
                className={`bg-card rounded-2xl border overflow-hidden transition-all ${
                  order.id === newOrderId
                    ? 'border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30'
                    : order.id === updatedOrderId
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/30'
                    : 'border-border hover:shadow-lg'
                }`}
              >
                {/* Help Request Banner */}
                {needsHelp && (
                  <div 
                    className={`${bannerClass} text-center py-3 uppercase flex items-center justify-center gap-2 border-b font-extrabold`}
                    style={bannerStyle}
                  >
                    <Bell className={bellClass} />
                    <span>
                      Table {order.table_num || 'N/A'} is calling for help! {count > 1 ? `(Called ×${count})` : ''}
                    </span>
                    <button
                      onClick={() => dismissHelpCall(order)}
                      className="ml-4 px-3 py-1 bg-black text-white hover:bg-neutral-800 text-xs font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      Dismiss Call
                    </button>
                  </div>
                )}

                {/* New order banner */}
                {order.id === newOrderId && (
                  <div className="bg-primary text-primary-foreground text-center text-xs font-bold py-2 tracking-widest uppercase animate-pulse">
                    ⚡ New Order Received
                  </div>
                )}

                {/* Updated order banner */}
                {order.id === updatedOrderId && (
                  <div className="bg-blue-600 text-white text-center text-xs font-bold py-2 tracking-widest uppercase animate-pulse">
                    ⚡ Add-on Items Added
                  </div>
                )}

                {/* Order header */}
                <div className="flex items-center gap-5 p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
                  <div className={`w-3 h-20 rounded-full flex-shrink-0 ${
                    isLate(order.created_at)   ? 'bg-red-500 shadow-md shadow-red-500/20'    :
                    order.status === 'received'  ? 'bg-blue-500 shadow-md shadow-blue-500/20'   :
                    order.status === 'preparing' ? 'bg-yellow-500 shadow-md shadow-yellow-500/20' :
                                                   'bg-green-500 shadow-md shadow-green-500/20'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-2.5 flex-wrap">
                      <div className="flex items-center gap-4 flex-wrap">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                          Order #{order.id.slice(-6).toUpperCase()}
                        </h2>
                        {order.table_num && (
                          <span className={`px-4 py-1.5 rounded-full text-base font-bold flex items-center gap-1.5 border border-current/10 shadow-sm ${
                            order.table_verified
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            Table {order.table_num}
                            <span className="font-extrabold">{order.table_verified ? '✓' : '?'}</span>
                          </span>
                        )}
                        <span className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wider border border-current/10 shadow-sm ${getStatusColor(order.status)}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                          ₹{(order.total || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <button
                        onClick={() => openEditModal(order)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-bold hover:bg-accent/70 hover:scale-[1.02] active:scale-95 transition-all border border-border shadow-sm cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Order
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-muted-foreground">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-muted-foreground/70" />
                      <span>{timeElapsed(order.created_at)}</span>
                      {isLate(order.created_at) && (
                        <span className="text-red-600 dark:text-red-400 font-bold animate-pulse">
                          • Running late
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order body */}
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                    {/* ── Items — uses item.qty (NOT dish.quantity) ── */}
                    <div>
                      <h4 className="mb-3 flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-primary" />
                        Dishes Ordered
                      </h4>
                      <div className="space-y-2">
                        {(order.items || []).map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              item.addon
                                ? 'bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 text-amber-950 dark:text-amber-300'
                                : 'bg-accent/30'
                            }`}
                          >
                            <span className="font-medium flex items-center gap-2">
                              {item.name}
                              {item.addon && (
                                <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded text-[10px] uppercase font-bold tracking-wider">
                                  Add-on
                                </span>
                              )}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              item.addon
                                ? 'bg-amber-600 text-white'
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              ×{item.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Special instructions */}
                    {displayInstructions && (
                      <div>
                        <h4 className="mb-3">Special Instructions</h4>
                        <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl text-sm border border-yellow-200 dark:border-yellow-800">
                          {displayInstructions}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status workflow */}
                  <div className="border-t border-border pt-6 space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Order Controls</h4>
                    <div className="flex gap-4">
                      <button
                        onClick={() => advanceToDeliver(order.id)}
                        disabled={order.is_advanced_to_deliver}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border ${
                          !order.is_advanced_to_deliver
                            ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-lg shadow-blue-600/20'
                            : 'bg-accent/30 text-muted-foreground border-border cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle className="w-5 h-5" />
                        {order.is_advanced_to_deliver ? 'Advanced to Waiter ✓' : 'Advance to Deliver'}
                      </button>

                      <button
                        onClick={() => setPaymentConfirmOrder(order)}
                        disabled={!order.waiter_delivered || order.status === 'ready'}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border ${
                          order.waiter_delivered && order.status !== 'ready'
                            ? 'bg-green-600 hover:bg-green-700 text-white border-transparent shadow-lg shadow-green-600/20'
                            : 'bg-accent/30 text-muted-foreground border-border cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle className="w-5 h-5" />
                        {order.status === 'ready' ? 'Payment Received ✓' : 'Payment Received'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Today's stats */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="mb-4">Today's Stats</h3>
            <TodayStats venueId={venue?.id || ''} />
          </div>
          <div className="bg-card rounded-2xl p-6 border border-border lg:col-span-2">
            <h3 className="mb-4">Kitchen Alerts</h3>
            {lateCount > 0
              ? (
                <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl text-sm">
                  <p className="font-semibold">{lateCount} order{lateCount > 1 ? 's' : ''} running late (&gt;15 min)</p>
                  <p className="text-xs mt-1 opacity-75">Advance their status to keep customers updated</p>
                </div>
              ) : (
                <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-xl text-sm">
                  <p className="font-semibold">All orders on time ✓</p>
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-background border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-accent/20">
              <div>
                <h3 className="font-bold text-lg">Edit Order #{editingOrder.id.slice(-6).toUpperCase()}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Modify items, quantities, and instructions</p>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-1 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Order Items */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-primary" />
                  Order Items
                </h4>
                <div className="space-y-2">
                  {editingOrder.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-2">No items in this order.</p>
                  ) : (
                    editingOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-accent/30 rounded-xl border border-border/50">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">₹{item.price} each</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Qty controls */}
                          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.id, -1)}
                              className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateItemQty(item.id, 1)}
                              className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => removeItemFromOrder(item.id)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add New Item */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Add Item to Order</h4>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search and select menu items..."
                      value={searchItemQuery}
                      onChange={(e) => setSearchItemQuery(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                      className="w-full bg-background border border-border rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {searchItemQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchItemQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Suggestions list */}
                  {(searchFocused || searchItemQuery.trim() !== '') && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto py-1">
                      {menuItems
                        .filter(mi => !editingOrder.items.some(oi => oi.id === mi.id))
                        .filter(mi => mi.name.toLowerCase().includes(searchItemQuery.toLowerCase()))
                        .length === 0 ? (
                        <p className="text-xs text-muted-foreground italic px-4 py-3 text-center">
                          {menuItems.filter(mi => !editingOrder.items.some(oi => oi.id === mi.id)).length === 0 
                            ? 'All menu items already added' 
                            : 'No matching items found'}
                        </p>
                      ) : (
                        menuItems
                          .filter(mi => !editingOrder.items.some(oi => oi.id === mi.id))
                          .filter(mi => mi.name.toLowerCase().includes(searchItemQuery.toLowerCase()))
                          .map(mi => (
                            <button
                              key={mi.id}
                              type="button"
                              onClick={() => {
                                addItemToOrder(mi);
                                setSearchItemQuery('');
                              }}
                              className="w-full text-left px-4 py-2 flex justify-between items-center hover:bg-accent transition-colors border-b border-border/30 last:border-b-0"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-medium text-foreground text-sm truncate">{mi.name}</p>
                                {mi.category && (
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{mi.category}</p>
                                )}
                              </div>
                              <div className="text-primary font-semibold text-xs shrink-0">₹{mi.price}</div>
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Special Instructions */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Special Instructions</h4>
                <textarea
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                  placeholder="No onion, extra spicy, etc..."
                  value={editingOrder.special_instructions || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, special_instructions: e.target.value || null })}
                />
              </div>

              {/* Recalculated Cost Summary */}
              <div className="border-t border-border pt-4 space-y-2 text-sm bg-accent/10 -mx-6 px-6 py-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>₹{recalculateOrderTotals(editingOrder.items).subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST (18%):</span>
                  <span>₹{recalculateOrderTotals(editingOrder.items).gst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border/50 pt-2 text-foreground">
                  <span>New Total:</span>
                  <span>₹{recalculateOrderTotals(editingOrder.items).total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border flex gap-3 bg-accent/10">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="flex-1 py-2.5 border border-border hover:bg-accent text-accent-foreground font-semibold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedOrder}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-sm transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {paymentConfirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-background border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-accent/20">
              <div>
                <h3 className="font-bold text-lg">Confirm Payment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Please verify the details below</p>
              </div>
              <button
                onClick={() => setPaymentConfirmOrder(null)}
                className="p-1 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground font-medium">
                Are you sure you have received payment for this order?
              </p>
              
              <div className="bg-accent/30 rounded-xl p-4 border border-border space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono font-bold">#{paymentConfirmOrder.id.slice(-6).toUpperCase()}</span>
                </div>
                {paymentConfirmOrder.table_num && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table:</span>
                    <span className="font-bold text-primary">Table {paymentConfirmOrder.table_num}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border/50 pt-2.5 text-base font-extrabold">
                  <span>Total Amount:</span>
                  <span className="text-green-600 dark:text-green-400">₹{(paymentConfirmOrder.total || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Footer / Buttons */}
            <div className="p-6 border-t border-border flex gap-3 bg-accent/10">
              <button
                type="button"
                onClick={() => setPaymentConfirmOrder(null)}
                className="flex-1 py-2.5 border border-border hover:bg-accent text-accent-foreground font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                No, Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(paymentConfirmOrder.id, 'ready');
                  setPaymentConfirmOrder(null);
                }}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-green-600/20 cursor-pointer"
              >
                Yes, Received
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Today's stats sub-component ───────────────────────────────
function TodayStats({ venueId }: { venueId: string }) {
  const [stats, setStats] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    if (!venueId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    db.from('orders')
      .select('status, total')
      .eq('venue_id', venueId)
      .gte('created_at', today.toISOString())
      .then(({ data }) => {
        if (!data) return;
        setStats({
          completed: data.filter(o => o.status === 'delivered').length,
          total:     data.reduce((s, o) => s + (o.total || 0), 0),
        });
      });
  }, [venueId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
        <span className="text-sm">Completed Today</span>
        <span className="text-xl font-bold">{stats.completed}</span>
      </div>
      <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
        <span className="text-sm">Revenue Today</span>
        <span className="text-xl font-bold">₹{stats.total.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}
