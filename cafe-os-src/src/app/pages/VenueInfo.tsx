import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Trash2, GripVertical, KeyRound, Eye, EyeOff, Lock, Unlock, ShieldAlert } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';
import { VenuePhoto } from '../../lib/types';
import { ImageUploader } from '../components/ImageUploader';

export function VenueInfo() {
  const navigate = useNavigate();
  const { venue, slug }          = useVenue();
  const [saving,   setSaving]    = useState(false);
  const [saved,    setSaved]     = useState(false);
  const [photos,   setPhotos]    = useState<VenuePhoto[]>([]);

  const { isLockedToKitchen, lockPIN, setLockPIN, lockInterface, setShowUnlockModal } = useLock();
  const [newPIN, setNewPIN] = useState('');
  const [showPIN, setShowPIN] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

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

  /** Called by ImageUploader with the final public URL */
  async function handlePhotoUploaded(url: string) {
    if (!venue?.id || !url) return;
    if (photos.length >= 4) {
      alert('Maximum 4 photos allowed. Delete one first.');
      return;
    }
    await db.from('venue_photos').insert({
      venue_id:   venue.id,
      url,
      sort_order: photos.length,
      alt_text:   form.name,
    });
    fetchPhotos();
  }

  async function deletePhoto(photoId: string) {
    if (!venue?.id) return;
    await db.from('venue_photos').delete().eq('id', photoId);
    
    // Fetch remaining photos and re-index them
    const { data } = await db
      .from('venue_photos')
      .select('*')
      .eq('venue_id', venue.id)
      .order('sort_order');
      
    if (data && data.length > 0) {
      const promises = data.map((photo, index) => {
        return db
          .from('venue_photos')
          .update({ sort_order: index })
          .eq('id', photo.id);
      });
      await Promise.all(promises);
    }
    
    fetchPhotos();
  }

  async function makeHero(photoId: string) {
    if (!venue?.id) return;
    const targetPhoto = photos.find(p => p.id === photoId);
    if (!targetPhoto) return;

    // Filter out targetPhoto, then prepend it to remainingPhotos
    const remainingPhotos = photos.filter(p => p.id !== photoId);
    const newPhotosOrder = [targetPhoto, ...remainingPhotos];

    // Update sort_order for each photo in the database
    const promises = newPhotosOrder.map((photo, index) => {
      return db
        .from('venue_photos')
        .update({ sort_order: index })
        .eq('id', photo.id);
    });

    await Promise.all(promises);
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
          <div>
            <h3>
              Venue Photos
              <span className="text-sm text-muted-foreground ml-2">({photos.length}/4)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              First photo = hero image on your venue page &amp; discover card
            </p>
          </div>
        </div>

        {/* Existing photos */}
        {photos.length > 0 && (
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
                {i === 0 ? (
                  <span className="text-xs font-semibold px-3 py-1 bg-cyan-500 text-white rounded-full flex items-center gap-1 shadow-sm select-none">
                    ★ Hero
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeHero(photo.id)}
                    className="text-xs font-semibold text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 px-3 py-1 rounded-full border border-border hover:border-cyan-300 transition-all active:scale-95 cursor-pointer"
                  >
                    Make Hero
                  </button>
                )}
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No photos yet. Upload up to 4 photos for your venue page and discover card.
          </p>
        )}

        {/* Upload widget */}
        {photos.length < 4 && (
          <ImageUploader
            bucket="venue-images"
            folder={slug || 'venues'}
            onUpload={handlePhotoUploaded}
            label={`Add Photo ${photos.length + 1} of 4`}
          />
        )}
      </div>

      {/* Parental Lock Settings */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Kitchen Parental Lock</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Restrict tablet or kitchen screens to Kitchen View. Protect your dashboard and settings.
            </p>
          </div>
        </div>

        {/* PIN Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Lock PIN</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 bg-input-background rounded-lg font-mono text-sm tracking-widest font-bold flex items-center justify-between border border-border">
                <span>{showPIN ? lockPIN : '••••'}</span>
                <button
                  type="button"
                  onClick={() => setShowPIN(!showPIN)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPIN ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change PIN (4 digits)</label>
            <div className="flex gap-2">
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={4}
                value={newPIN}
                onChange={e => setNewPIN(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 5678"
                className="flex-1 px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono tracking-widest"
              />
              <button
                onClick={() => {
                  if (newPIN.length !== 4) {
                    alert('PIN must be exactly 4 digits');
                    return;
                  }
                  setLockPIN(newPIN);
                  setNewPIN('');
                  setPinSaved(true);
                  setTimeout(() => setPinSaved(false), 2000);
                }}
                className="px-4 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                {pinSaved ? 'Updated!' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
