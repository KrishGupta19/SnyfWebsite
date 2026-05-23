import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { Upload, Link, X, ImagePlus, Loader2 } from 'lucide-react';
import { db } from '../../lib/supabase';

interface ImageUploaderProps {
  /** Called with the public URL of the uploaded/pasted image */
  onUpload: (url: string) => void;
  /** Supabase storage bucket name */
  bucket?: string;
  /** Sub-folder inside the bucket, e.g. venue slug */
  folder?: string;
  /** Small mode: compact inline layout */
  compact?: boolean;
  /** Label shown above the drop zone */
  label?: string;
  /** Current image URL to show as preview */
  currentUrl?: string;
}

type Tab = 'upload' | 'url';

export function ImageUploader({
  onUpload,
  bucket = 'venue-images',
  folder = '',
  compact = false,
  label,
  currentUrl,
}: ImageUploaderProps) {
  const [tab, setTab]           = useState<Tab>('upload');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]   = useState(currentUrl || '');
  const [urlInput, setUrlInput] = useState('');
  const [error, setError]       = useState('');
  const fileInputRef            = useRef<HTMLInputElement>(null);

  /* ── helpers ─────────────────────────────────────────── */

  async function uploadFile(file: File) {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }

    setUploading(true);
    const ext  = file.name.split('.').pop() || 'jpg';
    const path = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await db.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setError('Upload failed: ' + upErr.message);
      setUploading(false);
      return;
    }

    const { data } = db.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data.publicUrl;
    setPreview(publicUrl);
    onUpload(publicUrl);
    setUploading(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  /* ── drag & drop ─────────────────────────────────────── */

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  /* ── URL tab ─────────────────────────────────────────── */

  function applyUrl() {
    const u = urlInput.trim();
    if (!u) return;
    setPreview(u);
    onUpload(u);
    setUrlInput('');
  }

  /* ── render ──────────────────────────────────────────── */

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent'
    }`;

  if (compact) {
    /* ── Compact layout (inside modal) ─────────────────── */
    return (
      <div className="space-y-3">
        {label && <label className="block text-sm font-medium">{label}</label>}

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-accent/50 rounded-xl w-fit">
          <button type="button" className={tabCls('upload')} onClick={() => setTab('upload')}>
            <span className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Upload</span>
          </button>
          <button type="button" className={tabCls('url')} onClick={() => setTab('url')}>
            <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5" />URL</span>
          </button>
        </div>

        {tab === 'upload' ? (
          <div
            className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
              ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">Uploading…</p>
              </div>
            ) : preview ? (
              <div className="relative">
                <img src={preview} alt="" className="w-full h-28 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setPreview(''); onUpload(''); }}
                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-center text-xs text-muted-foreground py-2">Click or drag to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">
                  <span className="text-primary font-medium">Click to upload</span> or drag & drop<br />
                  <span className="text-[11px]">JPG, PNG, WebP · max 5 MB</span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyUrl()}
              className="flex-1 px-3 py-2 bg-input-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="https://example.com/image.jpg"
            />
            <button
              type="button"
              onClick={applyUrl}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Apply
            </button>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  /* ── Full layout (venue photos section) ─────────────────── */
  return (
    <div className="space-y-4">
      {label && <label className="block text-sm font-medium">{label}</label>}

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-accent/50 rounded-xl w-fit">
        <button type="button" className={tabCls('upload')} onClick={() => setTab('upload')}>
          <span className="flex items-center gap-1.5"><Upload className="w-4 h-4" />Upload from Device</span>
        </button>
        <button type="button" className={tabCls('url')} onClick={() => setTab('url')}>
          <span className="flex items-center gap-1.5"><Link className="w-4 h-4" />Paste URL</span>
        </button>
      </div>

      {tab === 'upload' ? (
        <div
          className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer
            ${dragging
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border hover:border-primary/60 hover:bg-accent/20'
            }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
          />

          {uploading ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">Uploading image…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
                ${dragging ? 'bg-primary/20' : 'bg-accent'}`}>
                <ImagePlus className={`w-7 h-7 transition-colors ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {dragging ? 'Drop image here' : (
                    <><span className="text-primary">Click to browse</span> or drag & drop your image</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP, AVIF · Maximum 5 MB</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyUrl()}
            className="flex-1 px-4 py-3 bg-input-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="https://images.unsplash.com/..."
          />
          <button
            type="button"
            onClick={applyUrl}
            className="px-5 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
