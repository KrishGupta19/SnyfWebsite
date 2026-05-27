import { useState, useEffect, useRef } from 'react';
import { Clock, ChefHat, CheckCircle, Wifi, WifiOff, Edit, Plus, Minus, Trash2, X } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import {
  Order, OrderStatus, MenuItem,
  ORDER_STATUS_LABELS, ORDER_STATUS_FLOW,
} from '../../lib/types';

export function KitchenBackend() {
  const { venue }                   = useVenue();
  const [orders,    setOrders]      = useState<Order[]>([]);
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [loading,   setLoading]     = useState(true);
  const [connected, setConnected]   = useState(false);
  const [newOrderId, setNewOrderId] = useState<string | null>(null);
  const channelRef                  = useRef<ReturnType<typeof db.channel> | null>(null);

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
    setLoading(true);
    try {
      const { data, error } = await db
        .from('orders')
        .select('*')
        .eq('venue_id', venue.id)
        .not('status', 'eq', 'ready')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (err) {
      console.error('[Kitchen] fetchOrders:', err);
    } finally {
      setLoading(false);
    }
  }

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
          playAlert();
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
          setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
          if (updated.status === 'ready') {
            setTimeout(() => {
              setOrders(prev => prev.filter(o => o.id !== updated.id));
            }, 5000);
          }
        }
      )
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));

    channelRef.current = channel;
  }

  function playAlert() {
    try {
      const ctx  = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* silent if audio unavailable */ }
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

  const activeCount    = orders.length;
  const receivedCount  = orders.filter(o => o.status === 'received').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const lateCount      = orders.filter(o => isLate(o.created_at)).length;

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

          <div className="bg-card rounded-lg px-4 py-2 border border-border text-center">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </div>
          <div className="bg-card rounded-lg px-4 py-2 border border-border text-center">
            <p className="text-xs text-muted-foreground">Received</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{receivedCount}</p>
          </div>
          <div className="bg-card rounded-lg px-4 py-2 border border-border text-center">
            <p className="text-xs text-muted-foreground">Delivered</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{deliveredCount}</p>
          </div>
          {lateCount > 0 && (
            <div className="bg-red-100 dark:bg-red-900/30 rounded-lg px-4 py-2 border border-red-200 dark:border-red-800 text-center">
              <p className="text-xs text-red-500">Late</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{lateCount}</p>
            </div>
          )}
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/70 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ChefHat className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
          <p className="text-lg font-medium text-muted-foreground">No active orders</p>
          <p className="text-sm text-muted-foreground mt-1">
            New orders will appear here instantly when customers order
          </p>
        </div>
      )}

      {/* Order cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          {orders.map(order => (
            <div
              key={order.id}
              className={`bg-card rounded-2xl border overflow-hidden transition-all ${
                order.id === newOrderId
                  ? 'border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30'
                  : 'border-border hover:shadow-lg'
              }`}
            >
              {/* New order banner */}
              {order.id === newOrderId && (
                <div className="bg-primary text-primary-foreground text-center text-xs font-bold py-2 tracking-widest uppercase animate-pulse">
                  ⚡ New Order Received
                </div>
              )}

              {/* Order header */}
              <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
                <div className={`w-2 h-16 rounded-full flex-shrink-0 ${
                  isLate(order.created_at)   ? 'bg-red-500'    :
                  order.status === 'received'  ? 'bg-blue-500'   :
                  order.status === 'preparing' ? 'bg-yellow-500' :
                                                 'bg-green-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="font-bold">
                        Order #{order.id.slice(-6).toUpperCase()}
                      </h2>
                      {order.table_num && (
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                          Table {order.table_num}
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        ₹{(order.total || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <button
                      onClick={() => openEditModal(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-semibold hover:bg-accent/70 transition-all border border-border"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit Order
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{timeElapsed(order.created_at)}</span>
                    {isLate(order.created_at) && (
                      <span className="text-red-600 dark:text-red-400 font-medium">
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
                          className="flex items-center justify-between p-3 bg-accent/30 rounded-lg"
                        >
                          <span className="font-medium">{item.name}</span>
                          <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                            ×{item.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Special instructions */}
                  {order.special_instructions && (
                    <div>
                      <h4 className="mb-3">Special Instructions</h4>
                      <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl text-sm border border-yellow-200 dark:border-yellow-800">
                        {order.special_instructions}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status workflow */}
                <div className="border-t border-border pt-6 space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Order Controls</h4>
                  <div className="flex gap-4">
                    <button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      disabled={order.status !== 'received'}
                      className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border ${
                        order.status === 'received'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
                          : 'bg-accent/30 text-muted-foreground border-border cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                      {order.status === 'received' ? 'Advance to Delivered' : 'Delivered ✓'}
                    </button>

                    <button
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      disabled={order.status !== 'delivered'}
                      className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border ${
                        order.status === 'delivered'
                          ? 'bg-green-600 hover:bg-green-700 text-white border-transparent shadow-lg shadow-green-600/20'
                          : 'bg-accent/30 text-muted-foreground border-border cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                      Payment Received
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    defaultValue=""
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const item = menuItems.find(mi => mi.id === selectedId);
                      if (item) addItemToOrder(item);
                      e.target.value = ""; // reset selection
                    }}
                  >
                    <option value="" disabled>Select an item to add...</option>
                    {menuItems
                      .filter(mi => !editingOrder.items.some(oi => oi.id === mi.id))
                      .map(mi => (
                        <option key={mi.id} value={mi.id}>
                          {mi.name} — ₹{mi.price}
                        </option>
                      ))}
                  </select>
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
