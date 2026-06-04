import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Trash2, GripVertical, KeyRound, Eye, EyeOff, Lock, Unlock, ShieldAlert, Key, Volume2, VolumeX, MapPin, Navigation } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { useLock } from '../../context/LockContext';
import { VenuePhoto } from '../../lib/types';
import { ImageUploader } from '../components/ImageUploader';
import {
  getVolume, setVolume, incrementVolume, decrementVolume,
  VolumeKey, MAX_VOLUME, MIN_VOLUME, STEP
} from '../../lib/audioVolume';

export function VenueInfo() {
  const navigate = useNavigate();
  const { venue, slug, username, credentialId, updateUsername, updateVenue } = useVenue();
  const [saving,   setSaving]    = useState(false);
  const [saved,    setSaved]     = useState(false);
  const [photos,   setPhotos]    = useState<VenuePhoto[]>([]);

  const { isLockedToKitchen, lockPIN, setLockPIN, lockInterface, setShowUnlockModal } = useLock();
  const [newPIN, setNewPIN] = useState('');
  const [showPIN, setShowPIN] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  // ── Volume settings ──────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }

  type VolState = Record<VolumeKey, number>;
  const [volumes, setVolumes] = useState<VolState>(() => ({
    kitchenOrderBell:  getVolume('kitchenOrderBell'),
    helpCallAlarm:     getVolume('helpCallAlarm'),
    waiterDeliverBell: getVolume('waiterDeliverBell'),
  }));

  function adjustVolume(key: VolumeKey, direction: 'up' | 'down') {
    const next = direction === 'up' ? incrementVolume(key) : decrementVolume(key);
    setVolumes(prev => ({ ...prev, [key]: next }));
  }

  function testVolume(key: VolumeKey) {
    try {
      const ctx = getAudioCtx();
      const vol = volumes[key];
      if (vol === 0) return;
      const now = ctx.currentTime;

      if (key === 'kitchenOrderBell') {
        // 3-ring bell preview
        const harmonics = [
          { freq: 880, peakGain: 1.0, decay: 1.2 },
          { freq: 1320, peakGain: 1.0, decay: 0.9 },
          { freq: 1760, peakGain: 0.9, decay: 0.7 },
        ];
        const ringAt = (t: number) => harmonics.forEach(({ freq, peakGain, decay }) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(peakGain * vol, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + decay);
          o.connect(g); g.connect(ctx.destination);
          o.start(t); o.stop(t + decay);
        });
        ringAt(now); ringAt(now + 0.65); ringAt(now + 1.3);

      } else if (key === 'helpCallAlarm') {
        // Beep siren preview
        const beep = (t: number, freq: number, dur: number) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.5 * vol, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur);
          o.start(t); o.stop(t + dur);
        };
        beep(now, 987.77, 0.15);
        beep(now + 0.2, 1318.51, 0.25);
        beep(now + 0.45, 987.77, 0.15);
        beep(now + 0.65, 1318.51, 0.35);

      } else {
        // Waiter desk bell preview
        const harmonics = [
          { freq: 1800, peakGain: 1.0, decay: 0.6 },
          { freq: 2400, peakGain: 0.6, decay: 0.45 },
          { freq: 3000, peakGain: 3.0, decay: 0.3 },
        ];
        const ringAt = (t: number) => harmonics.forEach(({ freq, peakGain, decay }) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(peakGain * vol, t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.001, t + decay);
          o.connect(g); g.connect(ctx.destination);
          o.start(t); o.stop(t + decay);
        });
        ringAt(now); ringAt(now + 0.7); ringAt(now + 1.4);
      }
    } catch { /* silent */ }
  }

  // ── Google Maps Coordinate Picker ──
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const mapMarkerRef = useRef<any>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if ((window as any).google && (window as any).google.maps) {
      setGoogleMapsLoaded(true);
      return;
    }
    const scriptId = 'google-maps-js-sdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://maps.googleapis.com/maps/api/js?v=weekly';
      script.async = true;
      script.defer = true;
      script.onload = () => setGoogleMapsLoaded(true);
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          setGoogleMapsLoaded(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (!googleMapsLoaded || !mapContainerRef.current) return;

    const defaultLat = form.lat || 28.6139;
    const defaultLng = form.lng || 77.2090;

    const mapOptions = {
      center: { lat: defaultLat, lng: defaultLng },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#212121" }] },
        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
        { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#181818" }] },
        { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212121" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
      ]
    };

    const map = new (window as any).google.maps.Map(mapContainerRef.current, mapOptions);
    googleMapInstanceRef.current = map;

    const marker = new (window as any).google.maps.Marker({
      position: { lat: defaultLat, lng: defaultLng },
      map: map,
      draggable: true,
      animation: (window as any).google.maps.Animation.DROP
    });
    mapMarkerRef.current = marker;

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        setForm(prev => ({
          ...prev,
          lat: parseFloat(pos.lat().toFixed(7)),
          lng: parseFloat(pos.lng().toFixed(7))
        }));
      }
    });

    map.addListener("click", (e: any) => {
      const latLng = e.latLng;
      if (latLng) {
        marker.setPosition(latLng);
        setForm(prev => ({
          ...prev,
          lat: parseFloat(latLng.lat().toFixed(7)),
          lng: parseFloat(latLng.lng().toFixed(7))
        }));
      }
    });
  }, [googleMapsLoaded]);

  useEffect(() => {
    if (googleMapInstanceRef.current && mapMarkerRef.current && form.lat && form.lng) {
      const newPos = { lat: Number(form.lat), lng: Number(form.lng) };
      const currentPos = mapMarkerRef.current.getPosition();
      if (!currentPos || Math.abs(currentPos.lat() - newPos.lat) > 0.0001 || Math.abs(currentPos.lng() - newPos.lng) > 0.0001) {
        mapMarkerRef.current.setPosition(newPos);
        googleMapInstanceRef.current.panTo(newPos);
      }
    }
  }, [form.lat, form.lng]);

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setFetchingLocation(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = parseFloat(position.coords.latitude.toFixed(7));
        const longitude = parseFloat(position.coords.longitude.toFixed(7));
        setForm(prev => ({
          ...prev,
          lat: latitude,
          lng: longitude
        }));
        setFetchingLocation(false);
      },
      (err) => {
        setLocationError(err.message || 'Unable to retrieve location.');
        setFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const [newUsername,     setNewUsername]     = useState('');
  const [userSaving,      setUserSaving]      = useState(false);
  const [userSaved,       setUserSaved]       = useState(false);
  const [userError,       setUserError]       = useState('');

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass,     setShowNewPass]     = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passError,       setPassError]       = useState('');
  const [passSaving,      setPassSaving]      = useState(false);
  const [passSaved,       setPassSaved]       = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', tagline: '',
    zone: '', category: '', hours: '', location: '',
    cgst_pct: 0, sgst_pct: 0, service_tax_pct: 0,
    lat: null as number | null,
    lng: null as number | null,
  });

  useEffect(() => {
    if (venue) {
      setForm({
        name:            venue.name            || '',
        description:     venue.description     || '',
        tagline:         venue.tagline         || '',
        zone:            venue.zone            || '',
        category:        venue.category        || '',
        hours:           venue.hours           || '',
        location:        venue.location        || '',
        cgst_pct:        venue.cgst_pct        || 0,
        sgst_pct:        venue.sgst_pct        || 0,
        service_tax_pct: venue.service_tax_pct || 0,
        lat:             venue.lat !== undefined ? venue.lat : null,
        lng:             venue.lng !== undefined ? venue.lng : null,
      });
      fetchPhotos();
    }
  }, [venue]);

  useEffect(() => {
    if (username) {
      setNewUsername(username);
    }
  }, [username]);

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
    
    const cgst = parseFloat(form.cgst_pct.toString()) || 0;
    const sgst = parseFloat(form.sgst_pct.toString()) || 0;
    const service_tax = parseFloat(form.service_tax_pct.toString()) || 0;
    const lat = form.lat !== null && !isNaN(Number(form.lat)) ? parseFloat(form.lat.toString()) : null;
    const lng = form.lng !== null && !isNaN(Number(form.lng)) ? parseFloat(form.lng.toString()) : null;

    await db.from('venues').update({
      name:            form.name,
      description:     form.description,
      tagline:         form.tagline,
      zone:            form.zone,
      category:        form.category,
      hours:           form.hours,
      location:        form.location,
      cgst_pct:        cgst,
      sgst_pct:        sgst,
      service_tax_pct: service_tax,
      lat:             lat,
      lng:             lng,
      updated_at:      new Date().toISOString(),
    }).eq('id', venue.id);

    if (updateVenue) {
      updateVenue({
        ...venue,
        name:            form.name,
        description:     form.description,
        tagline:         form.tagline,
        zone:            form.zone,
        category:        form.category,
        hours:           form.hours,
        location:        form.location,
        cgst_pct:        cgst,
        sgst_pct:        sgst,
        service_tax_pct: service_tax,
        lat:             lat ?? undefined,
        lng:             lng ?? undefined,
      });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function changeUsername() {
    setUserError('');
    if (!newUsername) {
      setUserError('Please enter a username.');
      return;
    }
    if (newUsername === username) {
      setUserError('New username must be different from current username.');
      return;
    }
    if (!credentialId) {
      setUserError('Could not identify credentials. Please sign out and sign in again.');
      return;
    }

    setUserSaving(true);
    try {
      const { data: existing, error: checkError } = await db
        .from('venue_credentials')
        .select('id')
        .eq('username', newUsername)
        .neq('id', credentialId)
        .limit(1);

      if (checkError) throw checkError;
      if (existing && existing.length > 0) {
        setUserError('This username is already taken by another café.');
        setUserSaving(false);
        return;
      }

      const { error } = await db
        .from('venue_credentials')
        .update({
          username: newUsername,
          last_changed:  new Date().toISOString(),
          changed_by:    'venue_admin',
        })
        .eq('id', credentialId);

      if (error) throw error;

      if (updateUsername) {
        updateUsername(newUsername);
      }

      setUserSaved(true);
      setTimeout(() => setUserSaved(false), 3000);
    } catch (err: any) {
      setUserError(err.message || 'Failed to update username. Please try again.');
    } finally {
      setUserSaving(false);
    }
  }

  async function changePassword() {
    setPassError('');

    // Validate
    if (!newPassword) {
      setPassError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPassError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match.');
      return;
    }
    if (!credentialId) {
      setPassError('Could not identify credentials. Please sign out and sign in again.');
      return;
    }

    setPassSaving(true);

    try {
      const { error } = await db
        .from('venue_credentials')
        .update({
          password_hash: newPassword,
          last_changed:  new Date().toISOString(),
          changed_by:    'venue_admin',
        })
        .eq('id', credentialId);

      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      setPassSaved(true);
      setTimeout(() => setPassSaved(false), 3000);

    } catch (err: any) {
      setPassError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setPassSaving(false);
    }
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

        <div className="border-t border-border pt-6 mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-semibold">📍 Geofenced Coordinates</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lock order placement to a 150m physical radius around your venue.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={fetchingLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Navigation className="w-3.5 h-3.5" />
              {fetchingLocation ? 'Locating...' : 'Use My Location'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Latitude</label>
              <input
                type="number"
                step="0.0000001"
                placeholder="e.g. 28.4944"
                value={form.lat === null ? '' : form.lat}
                onChange={e => setForm({...form, lat: e.target.value === '' ? null : parseFloat(e.target.value)})}
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Longitude</label>
              <input
                type="number"
                step="0.0000001"
                placeholder="e.g. 77.0896"
                value={form.lng === null ? '' : form.lng}
                onChange={e => setForm({...form, lng: e.target.value === '' ? null : parseFloat(e.target.value)})}
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
              />
            </div>
          </div>

          {locationError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {locationError}
            </p>
          )}

          {/* Map Picker Container */}
          <div className="relative w-full h-64 rounded-xl overflow-hidden border border-border bg-accent/20 flex items-center justify-center">
            {googleMapsLoaded ? (
              <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
            ) : (
              <div className="text-center p-4">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-bounce" />
                <p className="text-xs text-muted-foreground">Loading interactive map...</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground italic mt-1">
            Drag the marker or click anywhere on the map to pin your exact location.
          </p>
        </div>

        <div className="border-t border-border pt-6 mt-6">
          <h4 className="text-base font-semibold mb-4">Taxes & Service Charges (%)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">CGST (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cgst_pct}
                onChange={e => setForm({...form, cgst_pct: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">SGST (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.sgst_pct}
                onChange={e => setForm({...form, sgst_pct: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Service Tax / Charge (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.service_tax_pct}
                onChange={e => setForm({...form, service_tax_pct: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.0"
              />
            </div>
          </div>
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

      {/* Admin Credentials */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">Admin Credentials</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Change your Café OS login username or password. The super admin panel is updated automatically.
            </p>
          </div>
        </div>

        {/* Change Username Section */}
        <div className="space-y-4 pt-2 border-b border-border pb-6">
          <h4 className="font-bold text-sm text-foreground">Admin Username</h4>
          
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Current Username
            </label>
            <div className="px-4 py-3 bg-accent/40 rounded-lg text-sm font-mono text-muted-foreground select-all border border-border">
              {username || '—'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              New Username
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value.trim())}
              placeholder="Enter new username"
              className="w-full px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
            />
          </div>

          {userError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              {userError}
            </p>
          )}

          <button
            onClick={changeUsername}
            disabled={userSaving || !newUsername || newUsername === username}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <Save className="w-4 h-4" />
            {userSaving ? 'Updating...' : userSaved ? '✓ Username Updated!' : 'Update Username'}
          </button>
        </div>

        {/* Change Password Section */}
        <div className="space-y-4 pt-2">
          <h4 className="font-bold text-sm text-foreground">Admin Password</h4>

          {/* New password */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-4 py-3 pr-12 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showNewPass
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye    className="w-4 h-4" />
                }
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-4 py-3 pr-12 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showConfirmPass
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye    className="w-4 h-4" />
                }
              </button>
            </div>
          </div>

          {/* Password strength indicator */}
          {newPassword.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      newPassword.length >= i * 3
                        ? i <= 2 ? 'bg-yellow-400' : 'bg-green-500'
                        : 'bg-accent'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {newPassword.length < 6
                  ? 'Too short'
                  : newPassword.length < 9
                  ? 'Acceptable'
                  : newPassword.length < 12
                  ? 'Good'
                  : 'Strong'}
              </p>
            </div>
          )}

          {/* Match indicator */}
          {confirmPassword.length > 0 && (
            <p className={`text-xs font-medium ${
              newPassword === confirmPassword
                ? 'text-green-600 dark:text-green-400'
                : 'text-destructive'
            }`}>
              {newPassword === confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
            </p>
          )}

          {/* Error */}
          {passError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              {passError}
            </p>
          )}

          {/* Save button */}
          <button
            onClick={changePassword}
            disabled={
              passSaving ||
              !newPassword ||
              !confirmPassword ||
              newPassword !== confirmPassword ||
              newPassword.length < 6
            }
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <Key className="w-4 h-4" />
            {passSaving ? 'Updating...' : passSaved ? '✓ Password Updated!' : 'Update Password'}
          </button>

          {passSaved && (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-sm">
              <p className="font-semibold">Password updated successfully.</p>
              <p className="text-xs mt-1 opacity-75">
                Use your new password next time you sign in to Café OS.
              </p>
            </div>
          )}
        </div>
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

      {/* ── Volume Settings ─────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Alert Volume Settings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adjust volume for each alert sound. Max is 1.5× the default. Click Test to preview.
            </p>
          </div>
        </div>

        {([
          {
            key: 'kitchenOrderBell' as VolumeKey,
            label: '🔔 Kitchen Order Bell',
            desc: 'Rings in Kitchen Backend when a customer places an order',
          },
          {
            key: 'helpCallAlarm' as VolumeKey,
            label: '🚨 Help Call Alarm',
            desc: 'Plays in Kitchen & Waiter when a customer calls for help',
          },
          {
            key: 'waiterDeliverBell' as VolumeKey,
            label: '🛎️ Waiter Delivery Bell',
            desc: 'Rings in Waiter Tab when kitchen marks an order "Advance to Deliver"',
          },
        ] as const).map(({ key, label, desc }) => {
          const vol = volumes[key];
          const pct = Math.round((vol / MAX_VOLUME) * 100);
          const isMin = vol <= MIN_VOLUME;
          const isMax = vol >= MAX_VOLUME;

          return (
            <div key={key} className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => testVolume(key)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all cursor-pointer"
                >
                  ▶ Test
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Decrease */}
                <button
                  onClick={() => adjustVolume(key, 'down')}
                  disabled={isMin}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-accent/50 text-foreground font-bold text-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                  aria-label="Decrease volume"
                >
                  −
                </button>

                {/* Volume bar */}
                <div className="flex-1 relative h-3 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${pct}%`,
                      background: vol === 0
                        ? '#6b7280'
                        : vol <= 1.0
                        ? `hsl(${Math.round(142 - (vol * 42))}, 60%, 42%)`
                        : `hsl(${Math.round(20 - ((vol - 1.0) / 0.5) * 20)}, 80%, 48%)`,
                    }}
                  />
                </div>

                {/* Increase */}
                <button
                  onClick={() => adjustVolume(key, 'up')}
                  disabled={isMax}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-accent/50 text-foreground font-bold text-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                  aria-label="Increase volume"
                >
                  +
                </button>

                {/* Label */}
                <span className={`w-14 text-right text-sm font-mono font-bold ${
                  vol === 0 ? 'text-muted-foreground'
                  : vol > 1.0 ? 'text-orange-500 dark:text-orange-400'
                  : 'text-foreground'
                }`}>
                  {vol === 0 ? 'Muted' : `${pct}%`}
                </span>
              </div>

              {vol > 1.0 && (
                <p className="text-[10px] text-orange-500 dark:text-orange-400 font-medium">
                  ⚠ Volume boosted above 100% — may sound distorted on some speakers
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
