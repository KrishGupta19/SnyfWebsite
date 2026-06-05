import { useState, useEffect } from 'react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { Order } from '../../lib/types';
import { 
  Search, Receipt, Printer, Image, FileText, 
  Calendar, Clock, Download, ChevronRight, X 
} from 'lucide-react';

export function Bills() {
  const { venue } = useVenue();
  const [bills, setBills] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | '3month' | '6month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedBill, setSelectedBill] = useState<Order | null>(null);

  useEffect(() => {
    if (!venue?.id) return;
    fetchBills();
  }, [venue?.id]);

  async function fetchBills() {
    setLoading(true);
    try {
      // Fetch orders where status = 'ready' (which indicates paid in the Cafe OS model)
      const { data, error } = await db
        .from('orders')
        .select('*')
        .eq('venue_id', venue?.id)
        .eq('status', 'ready')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      const fetchedBills = (data || []) as Order[];
      setBills(fetchedBills);
      
      // Auto-select first bill if available
      if (fetchedBills.length > 0) {
        setSelectedBill(fetchedBills[0]);
      }
    } catch (err) {
      console.error('[Bills] Error fetching paid bills:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter bills based on search query and selected date range
  const filteredBills = bills.filter(bill => {
    // 1. Search Query filter (matches table number or order ID shortcode)
    const matchesSearch = 
      (bill.table_num && String(bill.table_num).includes(searchQuery)) ||
      bill.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Date filter
    const billDate = new Date(bill.updated_at);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (dateFilter === 'today') {
      return billDate >= today;
    } else if (dateFilter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return billDate >= yesterday && billDate < today;
    } else if (dateFilter === 'week') {
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return billDate >= oneWeekAgo;
    } else if (dateFilter === 'month') {
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      return billDate >= oneMonthAgo;
    } else if (dateFilter === '3month') {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
      return billDate >= threeMonthsAgo;
    } else if (dateFilter === '6month') {
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      return billDate >= sixMonthsAgo;
    } else if (dateFilter === 'custom') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0,0,0,0);
        if (billDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23,59,59,999);
        if (billDate > end) return false;
      }
    }

    return true;
  });

  // Export CSV of the filtered transactions
  const handleExportCSV = () => {
    if (filteredBills.length === 0) return;
    
    // CSV Headers
    const headers = [
      'Bill ID',
      'Date',
      'Time',
      'Table Number',
      'Items Ordered',
      'Subtotal (INR)',
      'GST (INR)',
      'Service Charge (INR)',
      'Total Amount (INR)'
    ];

    // CSV Rows mapping
    const rows = filteredBills.map(bill => {
      const dateObj = new Date(bill.updated_at);
      const dateStr = dateObj.toLocaleDateString('en-IN');
      const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      
      const itemsStr = (bill.items || [])
        .map(item => `${item.name} (x${item.qty})`)
        .join('; ');

      return [
        bill.id.toUpperCase(),
        dateStr,
        timeStr,
        bill.table_num || 'N/A',
        `"${itemsStr.replace(/"/g, '""')}"`, // escape quotes for CSV
        bill.subtotal,
        bill.gst,
        bill.service_charge,
        bill.total
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    let filename = `bills-export-${dateFilter}`;
    if (dateFilter === 'custom') {
      filename += `-${customStartDate || 'start'}-to-${customEndDate || 'end'}`;
    }
    filename += '.csv';

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Option A: Print Receipt (injects CSS specific to thermal receipt paper width 80mm)
  const handlePrint = (bill: Order) => {
    if (!venue) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const cgst = bill.gst / 2;
    const sgst = bill.gst / 2;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${bill.id.slice(-6).toUpperCase()}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 76mm;
              padding: 5px;
              margin: 0;
              font-size: 11px;
              color: #000;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
            .subtitle { font-size: 9px; margin-bottom: 8px; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin: 4px 0; }
            th, td { padding: 3px 0; font-size: 11px; vertical-align: top; }
            .totals td { padding: 1px 0; }
            .grand-total { font-size: 13px; font-weight: bold; margin-top: 4px; }
            @media print {
              body { width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${venue.name.toUpperCase()}</div>
            <div class="subtitle">${venue.zone || 'Snyf Partner'}</div>
          </div>
          
          <div>
            <div>Date: ${new Date(bill.updated_at).toLocaleString('en-IN')}</div>
            <div>Table: ${bill.table_num || 'N/A'}</div>
            <div>Bill No: #${bill.id.slice(-6).toUpperCase()}</div>
          </div>
          
          <div class="divider"></div>
          
          <table>
            <thead>
              <tr>
                <th align="left" style="width: 50%;">Item</th>
                <th align="right" style="width: 15%;">Qty</th>
                <th align="right" style="width: 35%;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${bill.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td align="right">${item.qty}</td>
                  <td align="right">₹${(item.price * item.qty).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="divider"></div>
          
          <table class="totals">
            <tr>
              <td>Subtotal:</td>
              <td align="right">₹${bill.subtotal.toLocaleString('en-IN')}</td>
            </tr>
            ${bill.gst > 0 ? `
              <tr>
                <td>CGST (2.5%):</td>
                <td align="right">₹${cgst.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>SGST (2.5%):</td>
                <td align="right">₹${sgst.toLocaleString('en-IN')}</td>
              </tr>
            ` : ''}
            ${bill.service_charge > 0 ? `
              <tr>
                <td>Service Charge:</td>
                <td align="right">₹${bill.service_charge.toLocaleString('en-IN')}</td>
              </tr>
            ` : ''}
          </table>
          
          <div class="divider"></div>
          
          <table class="grand-total">
            <tr>
              <td class="bold">TOTAL:</td>
              <td align="right" class="bold">₹${bill.total.toLocaleString('en-IN')}</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 12px; font-size: 9px; font-style: italic;">
            Thank you for dining with us!
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper function to wrap text on a 2D canvas context
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  // Export Receipt as a PNG Image using HTML Canvas
  const handleSaveImage = (bill: Order) => {
    if (!venue) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // First, calculate wrapped items height dynamically
    const width = 450;
    const itemHeight = 35;
    const headerHeight = 220;
    const footerHeight = 220;
    const maxNameWidth = 240;

    let itemsTotalHeight = 0;
    ctx.font = '13px "Courier New", Courier, monospace';
    bill.items.forEach(item => {
      const lines = wrapText(ctx, item.name, maxNameWidth);
      itemsTotalHeight += Math.max(lines.length * 16 + 8, itemHeight);
    });

    const height = headerHeight + itemsTotalHeight + footerHeight;

    canvas.width = width;
    canvas.height = height;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Receipt outline border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.fillStyle = '#000000';
    
    // Receipt Header / Cafe Name
    ctx.font = 'bold 22px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(venue.name.toUpperCase(), width / 2, 50);

    // Zone
    ctx.font = '13px "Courier New", Courier, monospace';
    ctx.fillText(venue.zone || 'Snyf Partner', width / 2, 75);
    ctx.fillText('------------------------------------------', width / 2, 95);

    // Bill metadata
    ctx.textAlign = 'left';
    ctx.font = '13px "Courier New", Courier, monospace';
    ctx.fillText(`Date: ${new Date(bill.updated_at).toLocaleString('en-IN')}`, 30, 120);
    ctx.fillText(`Table: ${bill.table_num || 'N/A'}`, 30, 140);
    ctx.fillText(`Bill No: #${bill.id.slice(-6).toUpperCase()}`, 30, 160);
    
    ctx.textAlign = 'center';
    ctx.fillText('------------------------------------------', width / 2, 180);

    // Table Header
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Courier New", Courier, monospace';
    ctx.fillText('ITEM', 30, 205);
    ctx.textAlign = 'right';
    ctx.fillText('QTY', width - 130, 205);
    ctx.fillText('PRICE', width - 30, 205);

    ctx.textAlign = 'center';
    ctx.fillText('------------------------------------------', width / 2, 220);

    // Render bill items with wrapping
    ctx.font = '13px "Courier New", Courier, monospace';
    let y = 245;
    bill.items.forEach((item) => {
      ctx.textAlign = 'left';
      const nameLines = wrapText(ctx, item.name, maxNameWidth);
      nameLines.forEach((line, lineIdx) => {
        ctx.fillText(line, 30, y + (lineIdx * 16));
      });

      ctx.textAlign = 'right';
      ctx.fillText(String(item.qty), width - 130, y);
      ctx.fillText(`₹${(item.price * item.qty).toLocaleString('en-IN')}`, width - 30, y);
      
      y += Math.max(nameLines.length * 16 + 8, itemHeight);
    });

    ctx.textAlign = 'center';
    ctx.fillText('------------------------------------------', width / 2, y);
    y += 20;

    // Subtotal & taxes
    ctx.textAlign = 'left';
    ctx.fillText('Subtotal:', 30, y);
    ctx.textAlign = 'right';
    ctx.fillText(`₹${bill.subtotal.toLocaleString('en-IN')}`, width - 30, y);
    y += 25;

    if (bill.gst > 0) {
      const cgst = bill.gst / 2;
      ctx.textAlign = 'left';
      ctx.fillText('CGST (2.5%):', 30, y);
      ctx.textAlign = 'right';
      ctx.fillText(`₹${cgst.toLocaleString('en-IN')}`, width - 30, y);
      y += 25;

      ctx.textAlign = 'left';
      ctx.fillText('SGST (2.5%):', 30, y);
      ctx.textAlign = 'right';
      ctx.fillText(`₹${cgst.toLocaleString('en-IN')}`, width - 30, y);
      y += 25;
    }

    if (bill.service_charge > 0) {
      ctx.textAlign = 'left';
      ctx.fillText('Service Charge:', 30, y);
      ctx.textAlign = 'right';
      ctx.fillText(`₹${bill.service_charge.toLocaleString('en-IN')}`, width - 30, y);
      y += 25;
    }

    ctx.textAlign = 'center';
    ctx.fillText('------------------------------------------', width / 2, y);
    y += 20;

    // Total Amount
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px "Courier New", Courier, monospace';
    ctx.fillText('TOTAL:', 30, y);
    ctx.textAlign = 'right';
    ctx.fillText(`₹${bill.total.toLocaleString('en-IN')}`, width - 30, y);
    y += 35;

    // Footer note
    ctx.textAlign = 'center';
    ctx.font = 'italic 12px "Courier New", Courier, monospace';
    ctx.fillText('Thank you for dining with us!', width / 2, y);

    // Download PNG
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `receipt-${bill.id.slice(-6).toUpperCase()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      {/* Header Info */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-black tracking-tight">Paid Bills</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Browse transaction history, export records, and print physical receipts.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredBills.length === 0}
            className="px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV ({filteredBills.length})</span>
          </button>
          <button
            onClick={fetchBills}
            className="px-4 py-2.5 bg-accent/60 hover:bg-accent border border-border/80 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden min-h-0">
        
        {/* Left Side: Filter tools and list of bills */}
        <div className="lg:col-span-7 flex flex-col space-y-4 min-h-0">
          
          {/* Controls toolbar */}
          <div className="bg-card border border-border p-4 rounded-2xl space-y-3 shrink-0">
            <div className="flex items-center gap-2.5 bg-accent/30 border border-border/60 px-3.5 py-2 rounded-xl">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by Table Number or Bill ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Date filter toggle list */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(['all', 'today', 'yesterday', 'week', 'month', '3month', '6month', 'custom'] as const).map((filter) => {
                const labelMap = {
                  all: 'All Time',
                  today: 'Today',
                  yesterday: 'Yesterday',
                  week: 'This Week',
                  month: '1 Month',
                  '3month': '3 Months',
                  '6month': '6 Months',
                  custom: 'Custom Range'
                };
                return (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border cursor-pointer ${
                      dateFilter === filter
                        ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                        : 'bg-accent/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/85'
                    }`}
                  >
                    {labelMap[filter]}
                  </button>
                );
              })}
            </div>

            {/* Custom range input drawer */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-3 pt-2.5 border-t border-border/40 animate-in fade-in duration-200">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-accent/40 border border-border/60 px-3 py-1.5 rounded-xl text-xs outline-none text-foreground w-full"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-accent/40 border border-border/60 px-3 py-1.5 rounded-xl text-xs outline-none text-foreground w-full"
                  />
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="self-end p-2 text-muted-foreground hover:text-foreground hover:bg-accent/80 rounded-xl transition-all cursor-pointer"
                    title="Clear Custom Dates"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto border border-border rounded-2xl bg-card scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <Receipt className="w-12 h-12 text-muted-foreground/35 mb-4" />
                <h3 className="font-bold text-muted-foreground">No bills found</h3>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                  Ensure transactions have been marked as "Payment Received" in the Waiter Terminal.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredBills.map((bill) => {
                  const isSelected = selectedBill?.id === bill.id;
                  return (
                    <div
                      key={bill.id}
                      onClick={() => setSelectedBill(bill)}
                      className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary' 
                          : 'hover:bg-accent/25 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-lg text-xs font-extrabold">
                            Table {bill.table_num || 'N/A'}
                          </span>
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            #{bill.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{new Date(bill.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(bill.updated_at).toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <span className="text-xs text-muted-foreground block font-medium">Grand Total</span>
                          <span className="font-black text-foreground">₹{bill.total.toLocaleString('en-IN')}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Paper receipt details panel */}
        <div className="lg:col-span-5 flex flex-col min-h-0 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {selectedBill ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Receipt Control Panel Actions */}
              <div className="p-4 bg-accent/20 border-b border-border flex items-center justify-between gap-2 flex-wrap shrink-0">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Receipt Actions</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(selectedBill)}
                    className="p-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg transition-all shadow-sm border border-transparent cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="Print Receipt (Option A)"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Bill</span>
                  </button>
                  <button
                    onClick={() => handleSaveImage(selectedBill)}
                    className="p-2 bg-background hover:bg-accent/40 border border-border text-foreground rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="Save PNG Receipt Image"
                  >
                    <Image className="w-4 h-4" />
                    <span>Save Image</span>
                  </button>
                  <button
                    onClick={() => handlePrint(selectedBill)}
                    className="p-2 bg-background hover:bg-accent/40 border border-border text-foreground rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="Export PDF (via Save as PDF print layout)"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Save PDF</span>
                  </button>
                </div>
              </div>

              {/* Realistic Paper Receipt Layout */}
              <div className="flex-1 bg-neutral-150 p-6 overflow-y-auto flex justify-center">
                <div className="bg-white text-black w-full max-w-[320px] p-6 shadow-lg border border-neutral-300 rounded-lg flex flex-col font-mono text-[12px] leading-relaxed self-start min-h-[420px] select-text">
                  
                  {/* Café Title */}
                  <div className="text-center font-bold text-base uppercase tracking-tight mb-0.5">
                    {venue?.name || 'Snyf Partner Cafe'}
                  </div>
                  <div className="text-center text-[10px] text-neutral-500 mb-4 uppercase">
                    {venue?.zone || 'Venue Partner'}
                  </div>
                  
                  {/* Bill Meta */}
                  <div className="space-y-0.5 text-[10px] text-neutral-600">
                    <div>Date: {new Date(selectedBill.updated_at).toLocaleString('en-IN')}</div>
                    <div>Table Num: {selectedBill.table_num || 'N/A'}</div>
                    <div>Order Ref: #{selectedBill.id.slice(-6).toUpperCase()}</div>
                  </div>
                  
                  {/* Divider line */}
                  <div className="border-t border-dashed border-neutral-400 my-3" />
                  
                  {/* Bill Items Grid */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between font-bold text-[10px] text-neutral-500 uppercase">
                      <span className="w-1/2">Item Description</span>
                      <span className="w-1/6 text-right">Qty</span>
                      <span className="w-1/3 text-right">Price</span>
                    </div>
                    
                    <div className="border-t border-neutral-200 my-1" />
                    
                    {selectedBill.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-neutral-800">
                        <span className="w-1/2 text-left break-words pr-2">{item.name}</span>
                        <span className="w-1/6 text-right">x{item.qty}</span>
                        <span className="w-1/3 text-right">₹{(item.price * item.qty).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>

                  {/* Divider line */}
                  <div className="border-t border-dashed border-neutral-400 my-3.5" />
                  
                  {/* Tax summary breakdown */}
                  <div className="space-y-1.5 text-neutral-600 text-[11px]">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{selectedBill.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {selectedBill.gst > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span>CGST (2.5%):</span>
                          <span>₹{(selectedBill.gst / 2).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST (2.5%):</span>
                          <span>₹{(selectedBill.gst / 2).toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    )}
                    {selectedBill.service_charge > 0 && (
                      <div className="flex justify-between">
                        <span>Service Charge:</span>
                        <span>₹{selectedBill.service_charge.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Divider line */}
                  <div className="border-t border-dashed border-neutral-400 my-3.5" />
                  
                  {/* Grand total summary */}
                  <div className="flex justify-between items-center font-bold text-neutral-900 text-sm">
                    <span>GRAND TOTAL:</span>
                    <span className="text-base">₹{selectedBill.total.toLocaleString('en-IN')}</span>
                  </div>

                  {/* Divider line */}
                  <div className="border-t border-dashed border-neutral-400 my-3.5" />
                  
                  {/* Footer message */}
                  <div className="text-center font-bold italic text-[10px] text-neutral-500 mt-2">
                    THANK YOU FOR VISITING US!
                  </div>
                  
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Receipt className="w-14 h-14 text-muted-foreground/35 mb-4 animate-pulse" />
              <h3 className="font-bold text-muted-foreground">Select a Bill</h3>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                Choose a bill from the left list to view its receipt breakdown and print options.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
