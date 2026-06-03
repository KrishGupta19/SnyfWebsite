import { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';
import { Order } from '../../lib/types';
import { CheckCircle, Clock, Utensils, HandPlatter, Wifi, WifiOff, Lock, ShieldAlert, X, Bell } from 'lucide-react';

export function WaiterTab() {
  const { venue } = useVenue();
  const { isWaiterMode, lockWaiterMode, setShowUnlockModal } = useLock();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'deliver' | 'payment'>('deliver');
  const [paymentConfirmOrder, setPaymentConfirmOrder] = useState<Order | null>(null);

  const channelRef = useRef<ReturnType<typeof db.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
          gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
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
      const playBeep = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const pitchMultiplier = 1 + Math.min(count - 1, 4) * 0.1;
        osc.frequency.setValueAtTime(freq * pitchMultiplier, time);

        const volume = Math.min(0.4 + (count - 1) * 0.2, 1.0);
        gain.gain.setValueAtTime(volume, time);
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
    subscribeToOrders();
    return () => {
      if (channelRef.current) db.removeChannel(channelRef.current);
    };
  }, [venue?.id]);

  async function fetchOrders() {
    if (!venue?.id) return;
    setLoading(true);
    try {
      const { data, error } = await db
        .from('orders')
        .select('*')
        .eq('venue_id', venue.id)
        .or('and(is_advanced_to_deliver.eq.true,status.neq.ready),special_instructions.like.%[HELP REQUESTED]%')
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
          const isDeliverable = updated.is_advanced_to_deliver && updated.status !== 'ready';

          if (isDeliverable || hasHelp) {
            setOrders(prev => {
              const existing = prev.find(o => o.id === updated.id);

              if (hasHelp) {
                const prevCount = existing ? getHelpCallCount(existing.special_instructions) : 0;
                const currentCount = getHelpCallCount(updated.special_instructions);
                if (currentCount > prevCount || !existing) {
                  playHelpCallAlarm(currentCount || 1);
                }
              }

              if (updated.is_advanced_to_deliver && !updated.waiter_delivered) {
                const wasDeliverable = existing?.is_advanced_to_deliver && !existing.waiter_delivered;
                if (!wasDeliverable) {
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
  const deliverOrders = orders.filter(o => o.is_advanced_to_deliver && !o.waiter_delivered && o.status !== 'ready' && o.items && o.items.length > 0);
  const paymentOrders = orders.filter(o => o.is_advanced_to_deliver && o.waiter_delivered && o.status !== 'ready' && o.items && o.items.length > 0);
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
              ? 'Waiting for the kitchen to advance new orders for delivery.'
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
                      ? `Ready for ${Math.max(0, Math.floor((Date.now() - new Date(order.updated_at).getTime()) / 60000))}m`
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
                      const showCompleteList = activeTab === 'payment';
                      const hasAddons = order.items.some(item => item.addon);
                      const itemsToRender = (hasAddons && !showCompleteList)
                        ? order.items.filter(item => item.addon)
                        : order.items;
                      return itemsToRender.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-accent/30 p-3 rounded-xl">
                          <span className="font-bold flex-1">
                            {item.name}
                            {item.addon && (
                              <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-[9px] font-black uppercase rounded tracking-wider">
                                Add-on
                              </span>
                            )}
                          </span>
                          <span className="bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm">
                            {item.qty}
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
                  <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/60 p-4 rounded-xl text-green-800 dark:text-green-400 font-extrabold">
                    <span>Total Bill:</span>
                    <span className="text-xl">₹{(order.total || 0).toLocaleString('en-IN')}</span>
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
    </div>
  );
}
