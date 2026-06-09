/**
 * offlineQueue.ts
 * ───────────────
 * Persists manual orders and write actions to localStorage
 * when Supabase is unreachable. Syncs when connection returns.
 *
 * Key design decisions:
 * - Uses localStorage only (no IndexedDB) for simplicity
 * - Each queued item has a unique local ID (timestamp + random)
 * - Sync is idempotent — safe to call multiple times
 * - Conflict check: if active order exists for same table, merge as addon
 */

import { db } from './supabase';

const QUEUE_KEY = 'snyf_offline_queue_v1';

export interface OfflineOrderPayload {
  venue_id:             string;
  table_num:            number;
  items:                any[];
  subtotal:             number;
  gst:                  number;
  service_charge:       number;
  total:                number;
  special_instructions: string | null;
  status:               'received';
  source:               'waiter_manual';
  table_verified:       true;
  is_advanced_to_deliver: false;
  waiter_delivered:     false;
  created_at:           string;
  updated_at:           string;
  // user_id is intentionally omitted for offline orders
  // /get-or-create-user runs on sync instead
}

export interface OfflineWritePayload {
  type:      'update_status' | 'toggle_item_ready' | 'mark_delivered' | 'mark_paid';
  order_id:  string;
  data:      Record<string, any>;
}

export interface QueuedItem {
  local_id:   string;
  kind:       'order' | 'write';
  phone?:     string; // stored for /get-or-create-user on sync
  order?:     OfflineOrderPayload;
  write?:     OfflineWritePayload;
  queued_at:  string;
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readQueue(): QueuedItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('[OfflineQueue] writeQueue failed:', e);
  }
}

export function queueOrder(phone: string, order: OfflineOrderPayload): QueuedItem {
  const item: QueuedItem = {
    local_id:  generateLocalId(),
    kind:      'order',
    phone,
    order,
    queued_at: new Date().toISOString(),
  };
  const q = readQueue();
  q.push(item);
  writeQueue(q);
  console.log('[OfflineQueue] Queued order:', item.local_id);
  return item;
}

export function queueWrite(write: OfflineWritePayload): void {
  const item: QueuedItem = {
    local_id:  generateLocalId(),
    kind:      'write',
    write,
    queued_at: new Date().toISOString(),
  };
  const q = readQueue();
  q.push(item);
  writeQueue(q);
}

export function getPendingCount(): number {
  return readQueue().length;
}

export function getPendingOrders(): QueuedItem[] {
  return readQueue().filter(i => i.kind === 'order');
}

function removeFromQueue(localId: string): void {
  const q = readQueue().filter(i => i.local_id !== localId);
  writeQueue(q);
}

/**
 * Flush all queued items to Supabase.
 * Returns number of successfully synced items.
 */
export async function flushQueue(netlifyBaseUrl: string = ''): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  let synced = 0;

  for (const item of queue) {
    try {
      if (item.kind === 'order' && item.order) {
        await syncOrder(item, netlifyBaseUrl);
        synced++;
      } else if (item.kind === 'write' && item.write) {
        await syncWrite(item.write);
        synced++;
      }
      removeFromQueue(item.local_id);
    } catch (err) {
      // Leave in queue — will retry next time
      console.warn('[OfflineQueue] Sync failed for', item.local_id, err);
    }
  }

  console.log(`[OfflineQueue] Flushed ${synced}/${queue.length} items`);
  return synced;
}

async function syncOrder(item: QueuedItem, netlifyBaseUrl: string): Promise<void> {
  if (!item.order || !item.phone) throw new Error('Missing order data');

  const order = item.order;

  // Step 1: Get or create user by phone
  let userId: string | null = null;
  try {
    const res = await fetch(`${netlifyBaseUrl}/get-or-create-user`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone: item.phone }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) userId = data.userId;
    }
  } catch {
    // user lookup failed — proceed with null user_id
  }

  // Step 2: Check for existing active order at same table (conflict check)
  const { data: existingOrders } = await db
    .from('orders')
    .select('id, items, subtotal, gst, service_charge, total')
    .eq('venue_id', order.venue_id)
    .eq('table_num', order.table_num)
    .neq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1);

  const existing = existingOrders?.[0];

  if (existing) {
    // Merge: add offline items as addons to existing order
    const mergedItems = [
      ...(existing.items || []),
      ...order.items.map((i: any) => ({ ...i, addon: true })),
    ];
    const newSubtotal = mergedItems.reduce(
      (sum: number, i: any) => sum + Number(i.price) * Number(i.qty), 0
    );
    // Use same tax rates from original order
    const taxRatio = existing.total > 0
      ? (existing.total - existing.subtotal) / existing.subtotal
      : 0;
    const newTotal = newSubtotal * (1 + taxRatio);

    const { error } = await db
      .from('orders')
      .update({
        items:   mergedItems,
        subtotal: newSubtotal,
        total:    newTotal,
        status:   'received',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    // No conflict — insert as new order
    const { error } = await db
      .from('orders')
      .insert({
        ...order,
        user_id: userId,
      });

    if (error) throw error;
  }
}

async function syncWrite(write: OfflineWritePayload): Promise<void> {
  const { error } = await db
    .from('orders')
    .update({ ...write.data, updated_at: new Date().toISOString() })
    .eq('id', write.order_id);

  if (error) throw error;
}
