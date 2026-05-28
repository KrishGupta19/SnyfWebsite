import { useState, useEffect, useRef } from 'react';
import { QrCode, Download, Trash2, Plus, RefreshCw } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';

interface QRCodeRow {
  id:         string;
  venue_id:   string;
  table_num:  number;
  url:        string;
  scan_count: number;
  active:     boolean;
  created_at: string;
}

declare const window: Window & { QRCode?: any };

export function QRCodes() {
  const { venue }               = useVenue();
  const [qrCodes,  setQrCodes]  = useState<QRCodeRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [newCount, setNewCount] = useState('');
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    if (venue?.id) fetchQRCodes();
  }, [venue?.id]);

  useEffect(() => {
    if (qrCodes.length > 0) {
      requestAnimationFrame(() => renderAllQRs());
    }
  }, [qrCodes]);

  // Load qrcode.js via CDN (not in npm deps)
  function loadQRLib(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (window.QRCode) { resolve(window.QRCode); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js';
      script.onload  = () => resolve(window.QRCode);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function fetchQRCodes() {
    if (!venue?.id) return;
    setLoading(true);
    try {
      const { data, error } = await db
        .from('qr_codes')
        .select('*')
        .eq('venue_id', venue.id)
        .eq('active', true)
        .order('table_num');
      if (error) throw error;
      setQrCodes((data || []) as QRCodeRow[]);
    } catch (err) {
      console.error('[QRCodes] fetch:', err);
    } finally {
      setLoading(false);
    }
  }

  async function renderAllQRs() {
    const QRCode = await loadQRLib();
    qrCodes.forEach(qr => {
      const canvas = canvasRefs.current[qr.id];
      if (canvas) {
        QRCode.toCanvas(canvas, qr.url, {
          width: 160, margin: 2,
          color: { dark: '#1E1E1B', light: '#F6F5F2' },
        }, (err: any) => { if (err) console.error('[QR render]', err); });
      }
    });
  }

  async function addTables() {
    if (!venue?.id || !venue?.slug) return;
    const count = parseInt(newCount);
    if (!count || count < 1 || count > 100) return;
    setAdding(true);
    try {
      const usedNums = new Set(qrCodes.map(q => q.table_num));
      const toInsert: Omit<QRCodeRow, 'id' | 'created_at'>[] = [];
      let next = 1;
      while (toInsert.length < count) {
        if (!usedNums.has(next)) {
          toInsert.push({
            venue_id:   venue.id,
            table_num:  next,
            url:        `https://snyf.co.in/${venue.slug}?table=${next}`,
            scan_count: 0,
            active:     true,
          });
        }
        next++;
      }
      const { error } = await db.from('qr_codes').insert(toInsert);
      if (error) throw error;
      setNewCount('');
      await fetchQRCodes();
    } catch (err) {
      console.error('[QRCodes] add:', err);
    } finally {
      setAdding(false);
    }
  }

  async function removeQR(id: string, tableNum: number) {
    if (!confirm(`Remove QR code for Table ${tableNum}? This cannot be undone.`)) return;
    try {
      await db.from('qr_codes').update({ active: false }).eq('id', id);
      setQrCodes(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('[QRCodes] remove:', err);
    }
  }

  async function downloadQR(qr: QRCodeRow) {
    const QRCode = await loadQRLib();
    QRCode.toDataURL(qr.url, {
      width: 1000, margin: 2,
      color: { dark: '#1E1E1B', light: '#F6F5F2' },
    }, (err: any, dataUrl: string) => {
      if (err) return;
      const canvas  = document.createElement('canvas');
      canvas.width  = 1000;
      canvas.height = 1200;
      const ctx     = canvas.getContext('2d')!;
      ctx.fillStyle = '#F6F5F2';
      ctx.fillRect(0, 0, 1000, 1200);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 100, 1000, 1000);
        ctx.fillStyle = '#6E6A64';
        ctx.font      = '600 36px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SNYF', 500, 60);
        ctx.fillStyle = '#1E1E1B';
        ctx.font      = 'bold 72px sans-serif';
        ctx.fillText(`TABLE ${qr.table_num}`, 500, 1155);
        const link = document.createElement('a');
        link.download = `snyf-${venue?.slug}-table-${qr.table_num}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      img.src = dataUrl;
    });
  }

  async function downloadAll() {
    for (let i = 0; i < qrCodes.length; i++) {
      await new Promise<void>(resolve => {
        setTimeout(() => { downloadQR(qrCodes[i]); resolve(); }, i * 400);
      });
    }
  }

  const totalScans = qrCodes.reduce((s, q) => s + (q.scan_count || 0), 0);

  return (
    <div className="p-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1>QR Codes</h1>
          <p className="text-muted-foreground mt-1">
            Per-table QR codes for {venue?.name}. Each table has a unique QR.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-card rounded-lg px-4 py-2 border border-border text-center">
            <p className="text-xs text-muted-foreground">Tables</p>
            <p className="text-2xl font-bold">{qrCodes.length}</p>
          </div>
          <div className="bg-card rounded-lg px-4 py-2 border border-border text-center">
            <p className="text-xs text-muted-foreground">Total Scans</p>
            <p className="text-2xl font-bold text-primary">{totalScans}</p>
          </div>
          <button
            onClick={fetchQRCodes}
            className="p-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/70 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {qrCodes.length > 0 && (
            <button
              onClick={downloadAll}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm"
            >
              <Download className="w-4 h-4" />
              Download All
            </button>
          )}
        </div>
      </div>

      {/* Add tables */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="mb-4">Add Tables</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="number"
            value={newCount}
            onChange={e => setNewCount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTables()}
            placeholder="How many tables to add?"
            min="1"
            max="100"
            className="flex-1 max-w-xs px-4 py-3 bg-input-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
          <button
            onClick={addTables}
            disabled={adding || !newCount}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
          >
            <Plus className="w-4 h-4" />
            {adding ? 'Adding...' : 'Add Tables'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Tables auto-number from next available. URL: snyf.co.in/{venue?.slug}?table=N
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && qrCodes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <QrCode className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
          <p className="text-lg font-medium text-muted-foreground">No QR codes yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your tables above to generate QR codes
          </p>
        </div>
      )}

      {/* QR grid */}
      {!loading && qrCodes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {qrCodes.map(qr => (
            <div key={qr.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <div className="font-bold text-primary text-lg">Table {qr.table_num}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {qr.scan_count} scan{qr.scan_count !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => removeQR(qr.id, qr.table_num)}
                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 flex justify-center" style={{ background: '#F6F5F2' }}>
                <canvas
                  ref={el => { canvasRefs.current[qr.id] = el; }}
                  width={160}
                  height={160}
                  style={{ display: 'block', borderRadius: '4px' }}
                />
              </div>
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-mono truncate border-t border-border">
                {qr.url}
              </div>
              <div className="p-3 pt-2">
                <button
                  onClick={() => downloadQR(qr)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-accent text-accent-foreground rounded-xl text-xs font-semibold hover:bg-accent/70 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print instructions */}
      {qrCodes.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="mb-3">Print Instructions</h3>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>• Print at minimum <strong className="text-foreground">4×4cm</strong> for reliable scanning on all phones</p>
            <p>• Laminate for durability — café tables get wet</p>
            <p>• Each QR is unique to its table — do not swap between tables</p>
            <p>• If a QR is damaged, remove it here and re-add that table number</p>
          </div>
        </div>
      )}
    </div>
  );
}
