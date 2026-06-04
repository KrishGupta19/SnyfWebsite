import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, Check } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { MenuItem } from '../../lib/types';
import { ImageUploader } from '../components/ImageUploader';

export function MenuManager() {
  const { venue }               = useVenue();
  const [items,    setItems]    = useState<MenuItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<MenuItem | null>(null);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showBulkTimeModal, setShowBulkTimeModal] = useState(false);
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkUntil, setBulkUntil] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', price: '',
    category: '', photo_url: '', tag: '', available: true,
    available_from: '', available_until: '',
  });

  useEffect(() => {
    if (venue?.id) fetchItems();
  }, [venue?.id]);

  async function fetchItems() {
    if (!venue?.id) return;
    setLoading(true);
    const { data } = await db
      .from('menu_items')
      .select('*')
      .eq('venue_id', venue.id)
      .order('sort_order');
    setItems((data || []) as MenuItem[]);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name:'', description:'', price:'', category:'', photo_url:'', tag:'', available:true, available_from:'', available_until:'' });
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name:            item.name,
      description:     item.description || '',
      price:           item.price.toString(),
      category:        item.category    || '',
      photo_url:       item.photo_url   || '',
      tag:             item.tag         || '',
      available:       item.available,
      available_from:  item.available_from  || '',
      available_until: item.available_until || '',
    });
    setShowForm(true);
  }

  async function saveItem() {
    if (!venue?.id || !form.name || !form.price) return;

    // Validate time window: both must be set or both empty
    const hasFrom  = form.available_from.trim()  !== '';
    const hasUntil = form.available_until.trim() !== '';
    if (hasFrom !== hasUntil) {
      alert('Please set both "Available From" and "Available Until", or leave both empty.');
      return;
    }

    const payload = {
      venue_id:        venue.id,
      name:            form.name,
      description:     form.description,
      price:           parseFloat(form.price),
      category:        form.category,
      photo_url:       form.photo_url,
      tag:             form.tag || null,
      available:       form.available,
      available_from:  hasFrom  ? form.available_from.trim()  : null,
      available_until: hasUntil ? form.available_until.trim() : null,
    };

    if (editing) {
      await db.from('menu_items')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
    } else {
      const maxOrder = items.length > 0
        ? Math.max(...items.map(i => i.sort_order)) + 1
        : 1;
      await db.from('menu_items').insert({ ...payload, sort_order: maxOrder });
    }

    setShowForm(false);
    fetchItems();
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this menu item? This cannot be undone.')) return;
    await db.from('menu_items').delete().eq('id', id);
    fetchItems();
  }

  async function toggleAvailable(item: MenuItem) {
    await db.from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id);
    setItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i)
    );
  }

  function handleCardClick(item: MenuItem) {
    if (isBulkMode) {
      setSelectedItemIds(prev =>
        prev.includes(item.id)
          ? prev.filter(id => id !== item.id)
          : [...prev, item.id]
      );
    }
  }

  async function applyBulkUnavailability(from: string, until: string) {
    if (selectedItemIds.length === 0) return;

    const hasFrom  = from.trim() !== '';
    const hasUntil = until.trim() !== '';
    if (hasFrom !== hasUntil) {
      alert('Please set both "Unavailable From" and "Unavailable Until", or leave both empty.');
      return;
    }

    const payload = {
      available_from:  hasFrom  ? from.trim()  : null,
      available_until: hasUntil ? until.trim() : null,
      updated_at: new Date().toISOString()
    };

    setLoading(true);
    await db.from('menu_items')
      .update(payload)
      .in('id', selectedItemIds);

    setSelectedItemIds([]);
    setIsBulkMode(false);
    setShowBulkTimeModal(false);
    fetchItems();
  }

  async function clearBulkUnavailability() {
    if (selectedItemIds.length === 0) return;
    if (!confirm(`Clear unavailability times for ${selectedItemIds.length} selected items?`)) return;

    setLoading(true);
    await db.from('menu_items')
      .update({
        available_from: null,
        available_until: null,
        updated_at: new Date().toISOString()
      })
      .in('id', selectedItemIds);

    setSelectedItemIds([]);
    setIsBulkMode(false);
    fetchItems();
  }

  async function setBulkAvailable(available: boolean) {
    if (selectedItemIds.length === 0) return;

    setLoading(true);
    await db.from('menu_items')
      .update({
        available,
        updated_at: new Date().toISOString()
      })
      .in('id', selectedItemIds);

    setSelectedItemIds([]);
    setIsBulkMode(false);
    fetchItems();
  }

  /** Format "HH:MM" → "8:00 AM" for display */
  function formatTime(t: string | null) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour  = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  return (
    <div className="p-8 space-y-8">

      <div className="flex items-center justify-between">
        <div>
          <h1>Menu Manager</h1>
          <p className="text-muted-foreground mt-1">
            Add, edit, and manage your menu. Changes go live on your Snyf page instantly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedItemIds([]);
            }}
            className={`flex items-center gap-2 px-6 py-3 border rounded-xl font-semibold transition-colors ${
              isBulkMode
                ? 'bg-accent border-accent text-accent-foreground'
                : 'bg-card border-border hover:bg-accent/50'
            }`}
          >
            {isBulkMode ? 'Cancel Bulk' : 'Bulk Edit'}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl border border-border p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-6">
              {editing ? 'Edit Item' : 'Add Menu Item'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Signature Flat White"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  rows={2}
                  placeholder="Short description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price (₹) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({...form, price: e.target.value})}
                    className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="280"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <input
                    value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Coffee, Food..."
                    list="cat-list"
                  />
                  <datalist id="cat-list">
                    {categories.map(c => <option key={c} value={c} />)}
                    <option value="Coffee" />
                    <option value="Food" />
                    <option value="Snacks" />
                    <option value="Cold Drinks" />
                    <option value="Breakfast" />
                    <option value="Desserts" />
                  </datalist>
                </div>
              </div>

              <ImageUploader
                compact
                bucket="venue-images"
                folder={`${venue?.id ?? 'menu'}/items`}
                label="Item Photo"
                currentUrl={form.photo_url}
                onUpload={url => setForm({ ...form, photo_url: url })}
              />

              <div>
                <label className="block text-sm font-medium mb-2">Tag</label>
                <select
                  value={form.tag}
                  onChange={e => setForm({...form, tag: e.target.value})}
                  className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">None</option>
                  <option value="Bestseller">Bestseller</option>
                  <option value="Popular">Popular</option>
                  <option value="Veg">Veg</option>
                  <option value="Chef's Pick">Chef's Pick</option>
                </select>
              </div>

              {/* ── Time Availability ──────────────────────────── */}
              <div className="border border-border rounded-xl p-4 space-y-3 bg-accent/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Time Availability</span>
                  <span className="text-xs text-muted-foreground ml-1">(optional · IST)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to show all day. If set, this item will NOT be available on the menu during the specified hours.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Unavailable From</label>
                    <input
                      type="time"
                      value={form.available_from}
                      onChange={e => setForm({...form, available_from: e.target.value})}
                      className="w-full px-3 py-2.5 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Unavailable Until</label>
                    <input
                      type="time"
                      value={form.available_until}
                      onChange={e => setForm({...form, available_until: e.target.value})}
                      className="w-full px-3 py-2.5 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                </div>
                {(form.available_from || form.available_until) && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-destructive font-medium">
                      🚫 Unavailable {form.available_from ? formatTime(form.available_from) : '?'} – {form.available_until ? formatTime(form.available_until) : '?'} IST
                    </p>
                    <button
                      type="button"
                      onClick={() => setForm({...form, available_from: '', available_until: ''})}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm({...form, available: !form.available})}>
                  {form.available
                    ? <ToggleRight className="w-8 h-8 text-primary" />
                    : <ToggleLeft  className="w-8 h-8 text-muted-foreground" />
                  }
                </button>
                <span className="text-sm font-medium">
                  {form.available ? 'Available for ordering' : 'Hidden from menu'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveItem}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                {editing ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No menu items yet</p>
          <p className="text-sm mt-1">Click "Add Item" to build your menu</p>
        </div>
      )}

      {/* Items grouped by category */}
      {!loading && (() => {
        const cats = [...new Set(items.map(i => i.category || 'Uncategorised'))];
        return cats.map(cat => (
          <div key={cat} className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {cat} ({items.filter(i => (i.category || 'Uncategorised') === cat).length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {items
                .filter(i => (i.category || 'Uncategorised') === cat)
                .map(item => {
                  const isSelected = selectedItemIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleCardClick(item)}
                      className={`relative bg-card rounded-2xl border overflow-hidden transition-all hover:shadow-md ${
                        isBulkMode
                          ? isSelected
                            ? 'border-primary ring-2 ring-primary/20 cursor-pointer'
                            : 'border-border opacity-80 cursor-pointer'
                          : item.available ? 'border-border' : 'border-border opacity-60'
                      }`}
                    >
                      {isBulkMode && (
                        <div className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-black/30 border-white text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                      <img
                        src={item.photo_url || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
                        alt={item.name}
                        className="w-full h-36 object-cover"
                        style={!item.photo_url ? { background: 'var(--card)' } : {}}
                        onError={e => {
                          e.currentTarget.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                          e.currentTarget.style.background = 'var(--card)';
                        }}
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{item.name}</h4>
                            {item.tag && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full mt-1 inline-block">
                                {item.tag}
                              </span>
                            )}
                            {/* Time availability badge in admin */}
                            {item.available_from && item.available_until && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full mt-1 ml-1 inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                🚫 Not available: {formatTime(item.available_from)}–{formatTime(item.available_until)}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-lg flex-shrink-0">₹{item.price}</span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {!isBulkMode ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAvailable(item);
                              }}
                              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                                item.available
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-accent text-accent-foreground'
                              }`}
                            >
                              {item.available ? '✓ Available' : '✕ Hidden'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(item);
                              }}
                              className="p-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/70 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteItem(item.id);
                              }}
                              className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between py-2 border-t border-border/50 mt-2">
                            <span className="text-xs text-muted-foreground">
                              {isSelected ? 'Selected' : 'Click to select'}
                            </span>
                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-border bg-input-background text-transparent'
                            }`}>
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        ));
      })()}
      {isBulkMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border shadow-2xl rounded-2xl p-4 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="text-sm font-medium">
            <span className="text-primary font-bold">{selectedItemIds.length}</span> items selected
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedItemIds.length > 0) {
                  setBulkFrom('');
                  setBulkUntil('');
                  setShowBulkTimeModal(true);
                }
              }}
              disabled={selectedItemIds.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              Set Unavailability
            </button>
            <button
              onClick={clearBulkUnavailability}
              disabled={selectedItemIds.length === 0}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-xs font-semibold hover:bg-accent/70 transition-colors disabled:opacity-50"
            >
              Clear Unavailability
            </button>
            <button
              onClick={() => setBulkAvailable(true)}
              disabled={selectedItemIds.length === 0}
              className="px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Mark Available
            </button>
            <button
              onClick={() => setBulkAvailable(false)}
              disabled={selectedItemIds.length === 0}
              className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Mark Hidden
            </button>
            <button
              onClick={() => {
                setIsBulkMode(false);
                setSelectedItemIds([]);
              }}
              className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg text-xs font-semibold hover:bg-destructive/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showBulkTimeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl border border-border p-8 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-2">Set Bulk Unavailability</h2>
            <p className="text-xs text-muted-foreground mb-6">
              This will apply the unavailability time window to the {selectedItemIds.length} selected items.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Unavailable From</label>
                  <input
                    type="time"
                    value={bulkFrom}
                    onChange={e => setBulkFrom(e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Unavailable Until</label>
                  <input
                    type="time"
                    value={bulkUntil}
                    onChange={e => setBulkUntil(e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowBulkTimeModal(false)}
                className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => applyBulkUnavailability(bulkFrom, bulkUntil)}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Apply to {selectedItemIds.length} Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
