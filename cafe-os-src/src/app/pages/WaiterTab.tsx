import { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';
import { Order } from '../../lib/types';
import { CheckCircle, Clock, Utensils, HandPlatter, Wifi, WifiOff, Lock, ShieldAlert, X, Bell, RefreshCw } from 'lucide-react';
import { getVolume } from '../../lib/audioVolume';

export function WaiterTab() {
  const { venue } = useVenue();
  const { isWaiterMode, lockWaiterMode, setShowUnlockModal } = useLock();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'deliver' | 'payment'>('deliver');
  const [paymentConfirmOrder, setPaymentConfirmOrder] = useState<Order | null>(null);

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [replacingOrder, setReplacingOrder] = useState<Order | null>(null);
  const [replacingItemIndex, setReplacingItemIndex] = useState<number | null>(null);
  const [searchItemQuery, setSearchItemQuery] = useState('');

  const channelRef = useRef<ReturnType<typeof db.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recentAlerts = useRef<Set<string>>(new Set());

  function getAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => { });
    }
    return audioContextRef.current;
  }

  // 1. Play realistic metallic desk service-bell chime (Tring Tring!)
  function playWaiterBell() {
    try {
      const audioCtx = getAudioContext();
      const vol = getVolume('waiterDeliverBell');
      if (vol === 0) return;

      const now = audioCtx.currentTime;

      function ringSingleBell(startTime: number) {
        const harmonics = [
          { freq: 1800, peakGain: 1.0, decay: 0.6 },
          { freq: 2400, peakGain: 0.6, decay: 0.45 },
          { freq: 3000, peakGain: 3.0, decay: 0.3 },
        ];
        harmonics.forEach(({ freq, peakGain, decay }) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(peakGain * vol, startTime + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(startTime);
          osc.stop(startTime + decay);
        });
      }

      const gap = 0.7;
      ringSingleBell(now);
      ringSingleBell(now + gap);
      ringSingleBell(now + gap * 2);
      ringSingleBell(now + gap * 3);
    } catch { /* silent */ }
  }

  // 2. Play urgent alarm beep siren for customer help calls
  function playHelpCallAlarm(count = 1) {
    try {
      const ctx = getAudioContext();
      const vol = getVolume('helpCallAlarm');
      if (vol === 0) return;

      const playBeep = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const pitchMultiplier = 1 + Math.min(count - 1, 4) * 0.1;
        osc.frequency.setValueAtTime(freq * pitchMultiplier, time);

        const baseVolume = Math.min(0.4 + (count - 1) * 0.2, 1.0);
        gain.gain.setValueAtTime(baseVolume * vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.start(time);
        osc.stop(time + dur);
      };

      const now = ctx.currentTime;
      const speed = count >= 3 ? 0.7 : count === 2 ? 0.85 : 1.0;

      playBeep(now, 987.77, 0.15 * speed);
      playBeep(now + 0.18 * speed, 1318.51, 0.25 * speed);
      playBeep(now + 0.4 * speed, 987.77, 0.15 * speed);
      playBeep(now + 0.58 * speed, 1318.51, 0.35 * speed);

      if (count >= 2) {
        playBeep(now + 0.9 * speed, 1567.98, 0.2 * speed);
      }
      if (count >= 3) {
        playBeep(now + 1.1 * speed, 1975.53, 0.3 * speed);
      }
    } catch { /* silent */ }
  }

  // Help calls utilities
  function getHelpCallCount(instr: string | null): number {
    if (!instr) return 0;
    const match = instr.match(/\[HELP REQUESTED(?: x(\d+))?\]/);
    if (!match) return 0;
    return match[1] ? parseInt(match[1], 10) : 1;
  }

  async function dismissHelpCall(order: Order) {
    const cleanInstr = (order.special_instructions || '')
      .replace(/\s*\|\s*\[HELP REQUESTED(?: x\d+)?\]/gi, '')
      .replace(/\[HELP REQUESTED(?: x\d+)?\]\s*\|\s*/gi, '')
      .replace(/\[HELP REQUESTED(?: x\d+)?\]/gi, '')
      .trim();

    // Optimistic update
    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      special_instructions: cleanInstr || null,
      updated_at: new Date().toISOString()
    } : o));

    try {
      const { error } = await db
        .from('orders')
        .update({
          special_instructions: cleanInstr || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      if (error) throw error;
    } catch (err) {
      console.error('[Waiter] dismissHelpCall:', err);
      fetchOrders();
    }
  }

  useEffect(() => {
    const handleUserGesture = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => { });
      }
    };
    window.addEventListener('click', handleUserGesture);
    window.addEventListener('keydown', handleUserGesture);
    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  useEffect(() => {
    if (!venue?.id) return;
    fetchOrders();
    fetchMenuItems();
    subscribeToOrders();
    return () => {
      if (channelRef.current) db.removeChannel(channelRef.current);
    };
  }, [venue?.id]);

  async function fetchMenuItems() {
    if (!venue?.id) return;
    try {
      const { data, error } = await db
        .from('menu_items')
        .select('*')
        .eq('venue_id', venue.id)
        .eq('available', true)
        .order('name');
      if (error) throw error;
      setMenuItems(data || []);
    } catch (err) {
      console.error('[Waiter] fetchMenuItems:', err);
    }
  }

  async function replaceOrderItem(orderId: string, itemIndex: number, newMenuItem: any) {
    if (!venue) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const oldItem = order.items?.[itemIndex];
    if (!oldItem) return;

    // Create the replaced item object
    const replacedItem = {
      id:    newMenuItem.id,
      name:  `${newMenuItem.name} (Replaced)`,
      price: Number(newMenuItem.price),
      qty:   Number(oldItem.qty),
      ready: false
    };

    const updatedItems = (order.items || []).map((item, idx) => {
      if (idx === itemIndex) {
        return replacedItem;
      }
      return item;
    });

    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
    const cgstPct = venue.cgst_pct || 0;
    const sgstPct = venue.sgst_pct || 0;
    const serviceTaxPct = venue.service_tax_pct || 0;

    const cgst = (subtotal * cgstPct) / 100;
    const sgst = (subtotal * sgstPct) / 100;
    const gst = cgst + sgst;
    const sc = (subtotal * serviceTaxPct) / 100;
    const total = subtotal + gst + sc;

    // Optimistically update local state
    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      items: updatedItems,
      subtotal,
      gst,
      service_charge: sc,
      total,
      updated_at: new Date().toISOString()
    } : o));

    try {
      const { error } = await db
        .from('orders')
        .update({
          items:          updatedItems,
          subtotal,
          gst,
          service_charge: sc,
          total,
          updated_at:     new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
    } catch (err) {
      console.error('[Waiter] replaceOrderItem error:', err);
      fetchOrders(); // Revert
    }
  }

  async function fetchOrders() {
    if (!venue?.id) return;
    setLoading(true);
    try {
      const { data, error } = await db
        .from('orders')
        .select('*')
        .eq('venue_id', venue.id)
        .or('status.neq.ready,special_instructions.like.%[HELP REQUESTED]%')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (err) {
      console.error('[Waiter] fetchOrders:', err);
    } finally {
      setLoading(false);
    }
  }

  function subscribeToOrders() {
    if (!venue?.id) return;
    const channel = db
      .channel(`waiter-${venue.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${venue.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setOrders(prev => prev.filter(o => o.id !== oldId));
            return;
          }

          const updated = payload.new as Order;
          const hasHelp = updated.special_instructions?.includes('[HELP REQUESTED]');
          const isDeliverable = updated.status !== 'ready';

          if (isDeliverable || hasHelp) {
            setOrders(prev => {
              const existing = prev.find(o => o.id === updated.id);

              if (hasHelp) {
                const prevCount = existing ? getHelpCallCount(existing.special_instructions) : 0;
                const currentCount = getHelpCallCount(updated.special_instructions);
                const fingerprint = `help-${updated.table_num}-${currentCount}`;

                if (currentCount > prevCount || !existing) {
                  if (!recentAlerts.current.has(fingerprint)) {
                    playHelpCallAlarm(currentCount || 1);
                  }
                }
              }

              // Ring bell if any item was marked ready (compared by index to handle duplicate items/addons)
              const becameReady = (prevItems: any[] | undefined, nextItems: any[] | undefined) => {
                if (!nextItems) return false;
                return nextItems.some((item, idx) => {
                  const prevItem = prevItems?.[idx];
                  return item.ready && (!prevItem || !prevItem.ready);
                });
              };

              if (becameReady(existing?.items, updated.items)) {
                const fingerprint = `item-ready-${updated.id}-${Date.now()}`;
                if (!recentAlerts.current.has(fingerprint)) {
                  recentAlerts.current.add(fingerprint);
                  setTimeout(() => recentAlerts.current.delete(fingerprint), 2000);
                  playWaiterBell();
                }
              }

              const exists = prev.some(o => o.id === updated.id);
              if (!exists) {
                return [updated, ...prev];
              }
              return prev.map(o => o.id === updated.id ? updated : o);
            });
          } else {
            setOrders(prev => prev.filter(o => o.id !== updated.id));
          }
        }
      )
      .on(
        'broadcast',
        { event: 'help_call' },
        (payload) => {
          const data = payload.payload || {};
          const count = data.help_count || 1;
          const tableNum = data.table_num || 'N/A';
          const fingerprint = `help-${tableNum}-${count}`;

          if (!recentAlerts.current.has(fingerprint)) {
            recentAlerts.current.add(fingerprint);
            setTimeout(() => {
              recentAlerts.current.delete(fingerprint);
            }, 15000);

            // Play the alarm immediately
            playHelpCallAlarm(count);
            // Refresh order list immediately to show the help request in UI
            fetchOrders();
          }
        }
      )
      .on(
        'broadcast',
        { event: 'deliver_bell' },
        (payload) => {
          const data = payload.payload || {};
          const orderId = data.order_id;
          if (orderId) {
            const fingerprint = `deliver-${orderId}`;
            if (!recentAlerts.current.has(fingerprint)) {
              recentAlerts.current.add(fingerprint);
              setTimeout(() => {
                recentAlerts.current.delete(fingerprint);
              }, 15000);

              // Play waiter bell immediately
              playWaiterBell();
              // Refresh order list immediately to show in UI
              fetchOrders();
            }
          }
        }
      )
      .on(
        'broadcast',
        { event: 'item_ready' },
        (payload) => {
          const data = payload.payload || {};
          const orderId = data.order_id;
          const itemId = data.item_id;
          const itemIndex = data.item_index;
          if (orderId && itemId) {
            const fingerprint = `item-ready-${orderId}-${itemId}-${itemIndex !== undefined ? itemIndex : ''}`;
            if (!recentAlerts.current.has(fingerprint)) {
              recentAlerts.current.add(fingerprint);
              setTimeout(() => {
                recentAlerts.current.delete(fingerprint);
              }, 5000);

              // Play waiter bell immediately
              playWaiterBell();
              // Refresh order list immediately to show in UI
              fetchOrders();
            }
          }
        }
      )
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = channel;
  }

  async function markAsDelivered(orderId: string) {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, waiter_delivered: true } : o));
    try {
      const { error } = await db
        .from('orders')
        .update({
          waiter_delivered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err) {
      console.error('[Waiter] markAsDelivered:', err);
      fetchOrders();
    }
  }

  async function markAsPaid(orderId: string) {
    // Optimistic update
    setOrders(prev => prev.filter(o => o.id !== orderId));
    try {
      const { error } = await db
        .from('orders')
        .update({
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err) {
      console.error('[Waiter] markAsPaid:', err);
      fetchOrders();
    }
  }

  const helpOrders = orders.filter(o => o.special_instructions?.includes('[HELP REQUESTED]'));
  const deliverOrders = orders.filter(o => !o.waiter_delivered && o.status !== 'ready' && o.items && o.items.length > 0);
  const paymentOrders = orders.filter(o => o.waiter_delivered && o.status !== 'ready' && o.items && o.items.length > 0);
  const activeList = activeTab === 'deliver' ? deliverOrders : paymentOrders;

  return (
    <div className={`p-8 space-y-8 ${isWaiterMode ? 'fixed inset-0 z-[100] bg-background overflow-y-auto' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HandPlatter className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-black tracking-tight">Waiter Terminal</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Orders for Table Delivery & Payment Confirmation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
            {connected ? <><Wifi className="w-4 h-4" /> Live</> : <><WifiOff className="w-4 h-4" /> Connecting...</>}
          </div>

          <button
            onClick={() => isWaiterMode ? setShowUnlockModal(true) : lockWaiterMode()}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border shadow-sm cursor-pointer ${isWaiterMode
                ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                : 'bg-primary text-primary-foreground border-transparent hover:opacity-90'
              }`}
          >
            {isWaiterMode ? <><ShieldAlert className="w-5 h-5" /> Locked</> : <><Lock className="w-5 h-5" /> Waiter Mode</>}
          </button>
        </div>
      </div>

      {/* ── ACTIVE WAITER CALLS DASHBOARD ────────────────── */}
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
                for (const order of helpOrders) {
                  await dismissHelpCall(order);
                }
              }}
              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider cursor-pointer bg-red-950/30 border border-red-900/50 px-3 py-1.5 rounded-lg"
            >
              Dismiss All Calls
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {helpOrders.map(order => {
              const count = getHelpCallCount(order.special_instructions);
              let cardClass = "bg-yellow-400 text-black border-yellow-500";
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

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-px">
        <button
          onClick={() => setActiveTab('deliver')}
          className={`pb-4 px-2 font-bold text-sm border-b-2 transition-all relative cursor-pointer ${activeTab === 'deliver' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          To Deliver
          {deliverOrders.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
              {deliverOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className={`pb-4 px-2 font-bold text-sm border-b-2 transition-all relative cursor-pointer ${activeTab === 'payment' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Awaiting Payment
          {paymentOrders.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
              {paymentOrders.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-border rounded-3xl bg-accent/5">
          <Utensils className="w-16 h-16 text-muted-foreground opacity-20 mb-6" />
          <h2 className="text-2xl font-bold text-muted-foreground">All caught up!</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            {activeTab === 'deliver'
              ? 'No active orders currently pending delivery.'
              : 'No orders awaiting payment confirmation right now.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {activeList.map(order => (
            <div key={order.id} className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
              <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl">
                    <span className="text-xs uppercase tracking-widest font-black opacity-80 block">Table</span>
                    <span className="text-3xl font-black">{order.table_num || '??'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Order ID</span>
                    <span className="font-mono font-bold text-sm">#{order.id.slice(-6).toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {activeTab === 'deliver'
                      ? `Placed ${Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000))}m ago`
                      : `Delivered ${Math.max(0, Math.floor((Date.now() - new Date(order.updated_at).getTime()) / 60000))}m ago`
                    }
                  </span>
                </div>
              </div>

              <div className="p-6 flex-1 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Items</h4>
                  <div className="space-y-2">
                    {(() => {
                      const itemsToRender = order.items || [];
                       return itemsToRender.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex justify-between items-center p-3 rounded-xl text-sm border ${
                            item.ready
                              ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200/40 dark:border-green-900/30'
                              : 'bg-accent/30 border-transparent'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-bold flex items-center gap-1.5 flex-wrap">
                              {item.ready ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[9px] font-black uppercase rounded-lg border border-green-200/50 shrink-0">
                                  ✓ Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-750 dark:bg-yellow-900/30 dark:text-yellow-400 text-[9px] font-black uppercase rounded-lg border border-yellow-200/50 shrink-0 animate-pulse">
                                  ○ Preparing
                                </span>
                              )}
                              <span className={item.ready ? "text-green-700 dark:text-green-400 font-semibold" : "text-foreground"}>
                                {item.name}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-full shrink-0">
                                x{item.qty}
                              </span>
                              {item.addon && (
                                <span className="px-2 py-0.5 bg-yellow-500 text-white text-[9px] font-black uppercase rounded tracking-wider shrink-0">
                                  Add-on
                                </span>
                              )}
                              {activeTab === 'deliver' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplacingOrder(order);
                                    setReplacingItemIndex(idx);
                                    setSearchItemQuery('');
                                  }}
                                  title="Replace Item"
                                  className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-muted-foreground hover:text-primary transition-all shrink-0 cursor-pointer flex items-center justify-center border border-border/30 bg-background/50 hover:scale-[1.05]"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-foreground shrink-0">
                            ₹{(item.price * item.qty).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {order.special_instructions && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-yellow-800 tracking-wider block mb-1">Notes</span>
                    <p className="text-sm text-yellow-900 font-medium">{order.special_instructions}</p>
                  </div>
                )}

                {activeTab === 'payment' && (
                  <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-200/60 dark:border-green-900/40 p-4 rounded-xl text-foreground font-semibold space-y-2 text-sm">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>Subtotal:</span>
                      <span>₹{(order.subtotal || (order.total - (order.gst || 0) - (order.service_charge || 0))).toLocaleString('en-IN')}</span>
                    </div>
                    {(order.gst || 0) > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>CGST:</span>
                          <span>₹{(order.gst / 2).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>SGST:</span>
                          <span>₹{(order.gst / 2).toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    )}
                    {(order.service_charge || 0) > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Service Charge:</span>
                        <span>₹{order.service_charge.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="border-t border-green-200/60 dark:border-green-900/40 my-2 pt-2"></div>
                    <div className="flex justify-between items-center text-green-800 dark:text-green-400 font-extrabold text-base">
                      <span>Total Bill:</span>
                      <span className="text-xl">₹{(order.total || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-accent/10 border-t border-border">
                {activeTab === 'deliver' ? (
                  <button
                    onClick={() => markAsDelivered(order.id)}
                    className="w-full py-4 bg-primary hover:opacity-90 text-primary-foreground rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95 cursor-pointer"
                  >
                    <CheckCircle className="w-6 h-6" />
                    Mark Delivered
                  </button>
                ) : (
                  <button
                    onClick={() => setPaymentConfirmOrder(order)}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20 active:scale-95 cursor-pointer"
                  >
                    <CheckCircle className="w-6 h-6" />
                    Payment Received
                  </button>
                )}
              </div>
            </div>
          ))}
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
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-foreground font-medium">
                Are you sure you have received payment for this order?
              </p>

              {/* Item cost breakdown */}
              <div className="border border-border/50 rounded-xl p-4 space-y-2 max-h-40 overflow-y-auto bg-accent/10">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Items Summary</div>
                {(paymentConfirmOrder.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="text-muted-foreground ml-1.5 font-semibold">x{item.qty}</span>
                    </span>
                    <span className="font-mono font-semibold">₹{(item.price * item.qty).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>

              <div className="bg-accent/30 rounded-xl p-4 border border-border space-y-2 text-sm">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono font-bold">#{paymentConfirmOrder.id.slice(-6).toUpperCase()}</span>
                </div>
                {paymentConfirmOrder.table_num && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Table:</span>
                    <span className="font-bold text-primary">Table {paymentConfirmOrder.table_num}</span>
                  </div>
                )}

                <div className="border-t border-border/40 my-2"></div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>₹{(paymentConfirmOrder.subtotal || (paymentConfirmOrder.total - (paymentConfirmOrder.gst || 0) - (paymentConfirmOrder.service_charge || 0))).toLocaleString('en-IN')}</span>
                </div>
                {(paymentConfirmOrder.gst || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>CGST:</span>
                      <span>₹{(paymentConfirmOrder.gst / 2).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>SGST:</span>
                      <span>₹{(paymentConfirmOrder.gst / 2).toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
                {(paymentConfirmOrder.service_charge || 0) > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Service Charge:</span>
                    <span>₹{paymentConfirmOrder.service_charge.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-border/50 pt-2 text-base font-extrabold">
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
                  markAsPaid(paymentConfirmOrder.id);
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

      {/* Item Replacement Modal */}
      {replacingOrder && replacingItemIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border flex justify-between items-center bg-accent/20">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Replace Ordered Item
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Order #{replacingOrder.id.slice(-6).toUpperCase()} at Table {replacingOrder.table_num || '??'}
                </p>
              </div>
              <button
                onClick={() => {
                  setReplacingOrder(null);
                  setReplacingItemIndex(null);
                  setSearchItemQuery('');
                }}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Target item selection */}
              <div>
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block mb-2">
                  1. SELECT ITEM TO REPLACE
                </span>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                  {(replacingOrder.items || []).map((item: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setReplacingItemIndex(idx)}
                      className={`flex justify-between items-center p-3 rounded-xl border text-sm transition-all cursor-pointer text-left ${
                        idx === replacingItemIndex
                          ? 'border-primary bg-primary/5 font-bold shadow-sm ring-1 ring-primary'
                          : 'border-border/50 bg-accent/15 hover:bg-accent/30 text-muted-foreground'
                      }`}
                    >
                      <span>
                        {item.name} <span className="text-xs opacity-75">(Qty: {item.qty})</span>
                      </span>
                      <span className="font-mono font-bold">
                        ₹{(item.price * item.qty).toLocaleString('en-IN')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu items search & selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">
                    2. SEARCH & SELECT REPLACEMENT DISH
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {menuItems.length} Available Dishes
                  </span>
                </div>

                {/* Search input */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchItemQuery}
                    onChange={(e) => setSearchItemQuery(e.target.value)}
                    placeholder="Search menu (e.g. Pizza, Brownie)..."
                    className="w-full pl-4 pr-10 py-3 bg-accent/20 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 font-medium"
                  />
                  {searchItemQuery && (
                    <button
                      onClick={() => setSearchItemQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* List of items */}
                <div className="border border-border/40 rounded-2xl bg-accent/5 p-2 space-y-1.5 max-h-[30vh] overflow-y-auto">
                  {(() => {
                    const filtered = menuItems.filter(item =>
                      item.name.toLowerCase().includes(searchItemQuery.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return (
                        <div className="py-8 text-center text-xs text-muted-foreground font-medium">
                          No menu items match your search.
                        </div>
                      );
                    }
                    return filtered.map((menuItem) => (
                      <button
                        key={menuItem.id}
                        onClick={async () => {
                          await replaceOrderItem(replacingOrder.id, replacingItemIndex, menuItem);
                          setReplacingOrder(null);
                          setReplacingItemIndex(null);
                          setSearchItemQuery('');
                        }}
                        className="w-full flex justify-between items-center p-3 rounded-xl hover:bg-primary/5 hover:border-primary/30 border border-transparent text-sm transition-all cursor-pointer text-left group"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold block group-hover:text-primary transition-colors truncate">
                            {menuItem.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground capitalize font-bold">
                            {menuItem.category || 'dish'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-foreground shrink-0">
                          ₹{Number(menuItem.price).toLocaleString('en-IN')}
                        </span>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
