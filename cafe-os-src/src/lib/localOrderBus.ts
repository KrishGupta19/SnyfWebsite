/**
 * localOrderBus.ts
 * ────────────────
 * BroadcastChannel wrapper for same-device tab communication.
 * Used to send offline manual orders from WaiterTab to KitchenBackend
 * without needing Supabase.
 *
 * BroadcastChannel works between:
 *   - Two browser tabs on the same device
 *   - PWA installed app + browser tab
 * Does NOT work across different devices or networks.
 */

import { Order } from './types';

const CHANNEL_NAME = 'snyf_local_order_bus';

export type BusEvent =
  | { type: 'new_order';       order: Order }
  | { type: 'update_order';    order_id: string; data: Partial<Order> }
  | { type: 'delete_order';    order_id: string };

type BusListener = (event: BusEvent) => void;

class LocalOrderBus {
  private channel: BroadcastChannel | null = null;
  private listeners: BusListener[] = [];

  private getChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!this.channel) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (e: MessageEvent<BusEvent>) => {
        this.listeners.forEach(fn => fn(e.data));
      };
    }
    return this.channel;
  }

  publish(event: BusEvent): void {
    try {
      const ch = this.getChannel();
      ch?.postMessage(event);
    } catch (e) {
      console.warn('[LocalOrderBus] publish failed:', e);
    }
  }

  subscribe(listener: BusListener): () => void {
    // Also ensure channel is open to receive
    this.getChannel();
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(fn => fn !== listener);
    };
  }

  isSupported(): boolean {
    return typeof BroadcastChannel !== 'undefined';
  }
}

// Singleton
export const localOrderBus = new LocalOrderBus();
