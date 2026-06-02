import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
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

  const [form, setForm] = useState({
    name: '', description: '', price: '',
    category: '', photo_url: '', tag: '', available: true,
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
    setForm({ name:'', description:'', price:'', category:'', photo_url:'', tag:'', available:true });
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name:        item.name,
      description: item.description || '',
      price:       item.price.toString(),
      category:    item.category    || '',
      photo_url:   item.photo_url   || '',
      tag:         item.tag         || '',
      available:   item.available,
    });
    setShowForm(true);
  }

  async function saveItem() {
    if (!venue?.id || !form.name || !form.price) return;

    const payload = {
      venue_id:    venue.id,
      name:        form.name,
      description: form.description,
      price:       parseFloat(form.price),
      category:    form.category,
      photo_url:   form.photo_url,
      tag:         form.tag || null,
      available:   form.available,
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
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
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
                .map(item => (
                  <div
                    key={item.id}
                    className={`bg-card rounded-2xl border overflow-hidden transition-all hover:shadow-md ${
                      item.available ? 'border-border' : 'border-border opacity-60'
                    }`}
                  >
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
                        </div>
                        <span className="font-bold text-lg flex-shrink-0">₹{item.price}</span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleAvailable(item)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                            item.available
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-accent text-accent-foreground'
                          }`}
                        >
                          {item.available ? '✓ Available' : '✕ Hidden'}
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/70 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        ));
      })()}
    </div>
  );
}
