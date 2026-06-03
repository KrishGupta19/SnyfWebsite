import { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';
import { Order, ORDER_STATUS_LABELS } from '../../lib/types';
import { CheckCircle, Clock, Utensils, HandPlatter, Wifi, WifiOff, Lock, ShieldAlert } from 'lucide-react';

export function WaiterTab() {
  const { venue } = useVenue();
  const { isWaiterMode, lockWaiterMode, setShowUnlockModal } = useLock();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof db.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  function getAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }

  function playAlert() {
    if (!isWaiterMode) return; // Only play sound in Waiter Mode
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const duration = 2.5; 
      const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];

      frequencies.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(index * 6, now);
        osc.connect(gain);
        gain.connect(ctx.destination);
        const initialGain = index === 0 ? 0.25 : 0.15 / (index + 1);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(initialGain, now + 0.02);
        const decayTime = duration * Math.pow(0.8, index);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.6, decayTime));
        osc.start(now);
        osc.stop(now + duration);
      });
    } catch { /* silent */ }
  }

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
        .eq('is_advanced_to_deliver', true)
        .eq('waiter_delivered', false)
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
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${venue.id}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          
          if (updated.is_advanced_to_deliver && !updated.waiter_delivered) {
            setOrders(prev => {
              const exists = prev.some(o => o.id === updated.id);
              if (!exists) {
                playAlert();
                return [updated, ...prev];
              }
              return prev.map(o => o.id === updated.id ? updated : o);
            });
          } else {
            // Remove if it's no longer deliverable by waiter
            setOrders(prev => prev.filter(o => o.id !== updated.id));
          }
        }
      )
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = channel;
  }

  async function markAsDelivered(orderId: string) {
    // Optimistic update
    setOrders(prev => prev.filter(o => o.id !== orderId));
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
            Orders for Table Delivery — view only
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
            connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {connected ? <><Wifi className="w-4 h-4" /> Live</> : <><WifiOff className="w-4 h-4" /> Connecting...</>}
          </div>

          <button
            onClick={() => isWaiterMode ? setShowUnlockModal(true) : lockWaiterMode()}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border shadow-sm cursor-pointer ${
              isWaiterMode 
                ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' 
                : 'bg-primary text-primary-foreground border-transparent hover:opacity-90'
            }`}
          >
            {isWaiterMode ? <><ShieldAlert className="w-5 h-5" /> Locked</> : <><Lock className="w-5 h-5" /> Waiter Mode</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-border rounded-3xl bg-accent/5">
          <Utensils className="w-16 h-16 text-muted-foreground opacity-20 mb-6" />
          <h2 className="text-2xl font-bold text-muted-foreground">All caught up!</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Waiting for the kitchen to advance new orders for delivery.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {orders.map(order => (
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
                  <span>Ready for {Math.floor((Date.now() - new Date(order.updated_at).getTime()) / 60000)}m</span>
                </div>
              </div>

              <div className="p-6 flex-1 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Items to Deliver</h4>
                  <div className="space-y-2">
                    {(() => {
                      const hasAddons = order.items.some(item => item.addon);
                      const itemsToRender = hasAddons ? order.items.filter(item => item.addon) : order.items;
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
              </div>

              <div className="p-6 bg-accent/10 border-t border-border">
                <button
                  onClick={() => markAsDelivered(order.id)}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20 active:scale-95 cursor-pointer"
                >
                  <CheckCircle className="w-6 h-6" />
                  Mark Delivered
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
