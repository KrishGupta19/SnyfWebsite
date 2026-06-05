import { useState, useEffect } from 'react';
import { Palette, Image as ImageIcon, LayoutTemplate, Save, CheckCircle2, Megaphone, RotateCcw } from 'lucide-react';
import { useVenue } from '../../context/VenueContext';
import { db } from '../../lib/supabase';

export function CustomizeSite() {
  const { venue } = useVenue();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Local state for the settings
  const [settings, setSettings] = useState({
    primaryColor: '#3b82f6',
    theme: 'light',
    buttonShape: 'rounded',
    menuLayout: 'grid',
    showAnnouncement: false,
    announcementText: '',
  });

  useEffect(() => {
    if (venue?.id) {
      loadSettings();
    }
  }, [venue?.id]);

  async function loadSettings() {
    setLoading(true);
    try {
      // @ts-ignore - Assuming theme_settings will be added to the Supabase types
      const { data, error } = await db
        .from('venues')
        .select('theme_settings')
        .eq('id', venue?.id)
        .single();

      if (!error && data?.theme_settings) {
        setSettings({ ...settings, ...data.theme_settings });
      }
    } catch (err) {
      console.error('Failed to load theme settings:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    if (!venue?.id) return;
    setSaving(true);
    setSuccessMessage('');

    try {
      const { error } = await db
        .from('venues')
        .update({ theme_settings: settings } as any)
        .eq('id', venue.id);

      if (error) throw error;

      setSuccessMessage('Site customizations saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving theme settings:', err);
      alert('Failed to save settings. Please ensure the theme_settings column exists in the database.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!venue?.id) return;
    if (!window.confirm('Are you sure you want to reset your site to the default template? All custom styling will be lost.')) return;
    
    setSaving(true);
    setSuccessMessage('');

    const defaultSettings = {
      primaryColor: '#3b82f6',
      theme: 'light',
      buttonShape: 'rounded',
      menuLayout: 'grid',
      showAnnouncement: false,
      announcementText: '',
    };

    try {
      const { error } = await db
        .from('venues')
        .update({ theme_settings: null } as any)
        .eq('id', venue.id);

      if (error) throw error;

      setSettings(defaultSettings);
      setSuccessMessage('Site reset to default successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error resetting theme settings:', err);
      alert('Failed to reset settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Customize Your Site</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize the look and feel of your venue's public ordering page.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          
          {/* Section 1: Brand Colors & Theme */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Brand Identity</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm font-mono text-muted-foreground">{settings.primaryColor.toUpperCase()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Site Theme</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSettings({ ...settings, theme: 'light' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      settings.theme === 'light' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Light Mode
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, theme: 'dark' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      settings.theme === 'dark' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Dark Mode
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: UI Style */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <LayoutTemplate className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Layout & Shapes</h3>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Button Shape</label>
                <div className="flex flex-wrap gap-3">
                  {['sharp', 'rounded', 'pill'].map((shape) => (
                    <button
                      key={shape}
                      onClick={() => setSettings({ ...settings, buttonShape: shape })}
                      className={`px-5 py-2 text-sm font-medium border transition-colors capitalize ${
                        shape === 'sharp' ? 'rounded-none' : shape === 'rounded' ? 'rounded-lg' : 'rounded-full'
                      } ${
                        settings.buttonShape === shape ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-sm font-medium text-foreground">Menu Display Style</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSettings({ ...settings, menuLayout: 'grid' })}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border transition-colors flex flex-col items-center gap-2 ${
                      settings.menuLayout === 'grid' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="w-8 h-8 grid grid-cols-2 gap-1 opacity-80">
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                      <div className="bg-current rounded-sm"></div>
                    </div>
                    Grid View
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, menuLayout: 'list' })}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border transition-colors flex flex-col items-center gap-2 ${
                      settings.menuLayout === 'list' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="w-8 h-8 flex flex-col gap-1 justify-center opacity-80">
                      <div className="h-2 bg-current rounded-sm w-full"></div>
                      <div className="h-2 bg-current rounded-sm w-full"></div>
                      <div className="h-2 bg-current rounded-sm w-3/4"></div>
                    </div>
                    List View
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Promotional */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Promotional Banner</h3>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showAnnouncement}
                  onChange={(e) => setSettings({ ...settings, showAnnouncement: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Show announcement banner on top of site</span>
              </label>

              {settings.showAnnouncement && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-xs text-muted-foreground">Banner Text</label>
                  <input
                    type="text"
                    value={settings.announcementText}
                    onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
                    placeholder="e.g., Happy Hour from 5 PM - 7 PM! 🍻"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-4 pt-4">
            {successMessage && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5 animate-in fade-in duration-300">
                <CheckCircle2 className="w-4 h-4" />
                {successMessage}
              </span>
            )}
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-2 bg-background border border-border text-foreground px-6 py-2.5 rounded-xl font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Set to Default
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Live Preview Pane */}
        <div className="hidden md:block col-span-1">
          <div className="sticky top-8 border-[6px] border-border/50 rounded-[2.5rem] bg-background overflow-hidden shadow-2xl h-[650px] w-full flex flex-col relative">
            {/* Notch */}
            <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
              <div className="w-1/3 h-full bg-border/50 rounded-b-2xl"></div>
            </div>

            {/* Simulated App View */}
            <div className={`flex-1 overflow-hidden flex flex-col ${settings.theme === 'dark' ? 'bg-[#121212] text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-300`}>
              {settings.showAnnouncement && settings.announcementText && (
                <div style={{ backgroundColor: settings.primaryColor }} className="text-white text-[10px] py-2 px-4 text-center font-medium truncate mt-6">
                  {settings.announcementText}
                </div>
              )}
              <div className={`p-5 ${!settings.showAnnouncement ? 'mt-6' : ''}`}>
                <div className="w-12 h-12 rounded-full bg-border/20 mb-4 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 opacity-40" />
                </div>
                <div className="h-6 w-3/4 rounded bg-border/20 mb-2"></div>
                <div className="h-3 w-1/2 rounded bg-border/20 mb-6"></div>

                <div className="space-y-4">
                  {settings.menuLayout === 'grid' ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`aspect-square ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'} rounded-xl p-3 flex flex-col justify-end`}>
                          <div className="h-2 w-full bg-border/20 rounded mb-1.5"></div>
                          <div className="h-2 w-1/2 bg-border/20 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`flex gap-3 p-3 ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'} rounded-xl`}>
                          <div className="w-16 h-16 rounded-lg bg-border/20 flex-shrink-0"></div>
                          <div className="flex-1 py-1">
                            <div className="h-2 w-full bg-border/20 rounded mb-2"></div>
                            <div className="h-2 w-3/4 bg-border/20 rounded mb-3"></div>
                            <div className="h-2 w-1/4 bg-border/20 rounded"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Floating Action Button simulation */}
                <div 
                  style={{ backgroundColor: settings.primaryColor }}
                  className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 text-white text-xs font-semibold shadow-xl transition-all ${
                    settings.buttonShape === 'sharp' ? 'rounded-none' : settings.buttonShape === 'rounded' ? 'rounded-xl' : 'rounded-full'
                  }`}
                >
                  View Cart
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
