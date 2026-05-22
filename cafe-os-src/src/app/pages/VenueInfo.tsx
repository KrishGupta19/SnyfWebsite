import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { VenuePhoto } from '../../lib/types';

export function VenueInfo() {
  const { venue, slug }          = useVenue();
  const [saving,   setSaving]    = useState(false);
  const [saved,    setSaved]     = useState(false);
  const [photos,   setPhotos]    = useState<VenuePhoto[]>([]);
  const [newPhoto, setNewPhoto]  = useState('');

  const [form, setForm] = useState({
    name: '', description: '', tagline: '',
    zone: '', category: '', hours: '', location: '',
  });

  useEffect(() => {
    if (venue) {
      setForm({
        name:        venue.name        || '',
        description: venue.description || '',
        tagline:     venue.tagline     || '',
        zone:        venue.zone        || '',
        category:    venue.category    || '',
        hours:       venue.hours       || '',
        location:    venue.location    || '',
      });
      fetchPhotos();
    }
  }, [venue]);

  async function fetchPhotos() {
    if (!venue?.id) return;
    const { data } = await db
      .from('venue_photos')
      .select('*')
      .eq('venue_id', venue.id)
      .order('sort_order');
    setPhotos((data || []) as VenuePhoto[]);
  }

  async function saveVenueInfo() {
    if (!venue?.id) return;
    setSaving(true);
    await db.from('venues').update({
      name:        form.name,
      description: form.description,
      tagline:     form.tagline,
      zone:        form.zone,
      category:    form.category,
      hours:       form.hours,
      location:    form.location,
      updated_at:  new Date().toISOString(),
    }).eq('id', venue.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function addPhoto() {
    if (!venue?.id || !newPhoto.trim()) return;
    if (photos.length >= 4) {
      alert('Maximum 4 photos allowed. Delete one first.');
      return;
    }
    await db.from('venue_photos').insert({
      venue_id:   venue.id,
      url:        newPhoto.trim(),
      sort_order: photos.length,
      alt_text:   form.name,
    });
    setNewPhoto('');
    fetchPhotos();
  }

  async function deletePhoto(photoId: string) {
    await db.from('venue_photos').delete().eq('id', photoId);
    fetchPhotos();
  }

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <div>
        <h1>Venue Info</h1>
        <p className="text-muted-foreground mt-1">
          Update your venue details. Changes reflect on your Snyf page instantly.
        </p>
        <p className="text-xs font-mono text-primary mt-2">
          snyf.co.in/{slug}
        </p>
      </div>

      {/* Basic info */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <h3>Basic Information</h3>

        <div>
          <label className="block text-sm font-medium mb-2">Venue Name</label>
          <input
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Tagline
            <span className="text-muted-foreground text-xs ml-2">(shows on discover card)</span>
          </label>
          <input
            value={form.tagline}
            onChange={e => setForm({...form, tagline: e.target.value})}
            className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="e.g. NCR's best specialty coffee"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
            className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Zone</label>
            <input
              value={form.zone}
              onChange={e => setForm({...form, zone: e.target.value})}
              className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Cyber Hub"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
              className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="Café">Café</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Bar">Bar</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Opening Hours</label>
          <input
            value={form.hours}
            onChange={e => setForm({...form, hours: e.target.value})}
            className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="e.g. 8AM – 10PM · Mon–Sun"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Location / Address</label>
          <input
            value={form.location}
            onChange={e => setForm({...form, location: e.target.value})}
            className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Ground floor, DLF Cyber Hub, Gurugram"
          />
        </div>

        <button
          onClick={saveVenueInfo}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Photos */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3>
            Photos
            <span className="text-sm text-muted-foreground ml-2">({photos.length}/4)</span>
          </h3>
          <span className="text-xs text-muted-foreground">First photo = hero image on venue page</span>
        </div>

        {/* Existing photos */}
        <div className="space-y-3">
          {photos.map((photo, i) => (
            <div key={photo.id} className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <img
                src={photo.url}
                alt=""
                className="w-16 h-12 object-cover rounded-lg flex-shrink-0 bg-accent"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
              <p className="text-xs text-muted-foreground flex-1 truncate">{photo.url}</p>
              <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                {i === 0 ? 'Hero' : `#${i + 1}`}
              </span>
              <button
                onClick={() => deletePhoto(photo.id)}
                className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No photos yet. Add up to 4 photos for your venue page and discover card.
          </p>
        )}

        {/* Add photo */}
        {photos.length < 4 && (
          <div className="flex gap-3">
            <input
              value={newPhoto}
              onChange={e => setNewPhoto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPhoto()}
              className="flex-1 px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              placeholder="Paste image URL and press Enter or click Add..."
            />
            <button
              onClick={addPhoto}
              className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
