import { useState, useEffect } from 'react';
import { 
  Plus, Settings, Users, GripVertical, MoveDiagonal, X, 
  Flame, Clock, RotateCw, Moon, Eye, AlertTriangle, Layers, Filter
} from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';
import { Order } from '../../lib/types';

const initialTables = [
  { id: 1, name: 'T1', capacity: 2, status: 'available', x: 1, y: 1 },
  { id: 2, name: 'T2', capacity: 2, status: 'occupied', x: 3, y: 1 },
  { id: 3, name: 'T3', capacity: 4, status: 'waiting_food', x: 1, y: 3 },
  { id: 4, name: 'T4', capacity: 4, status: 'bill_requested', x: 5, y: 3 },
  { id: 5, name: 'T5', capacity: 6, status: 'available', x: 3, y: 5 },
];

const isUUID = (id: any) => 
  typeof id === 'string' && 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function TableManagement() {
  const { currentVenue } = useVenue();
  const [tables, setTables] = useState<any[]>(initialTables);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [completedOrdersToday, setCompletedOrdersToday] = useState<Order[]>([]);
  const [isEditMode] = useState(true); // always in edit mode — no toggle
  const [draggingTable, setDraggingTable] = useState<number | string | null>(null);
  const [configuringTable, setConfiguringTable] = useState<any>(null);
  
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<any[]>([]);

  // 6 Custom Features States
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('All');
  const [hoveredTableId, setHoveredTableId] = useState<number | string | null>(null);
  const [tick, setTick] = useState(0); // Trigger live timer updates

  // Live Timer Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 5000); // refresh timer calculations every 5s
    return () => clearInterval(timer);
  }, []);

  // Fetch / Sync Data
  useEffect(() => {
    if (currentVenue) {
      loadTables();
      loadActiveOrders();
      loadCompletedOrdersToday();
      
      const ordersSub = db.channel(`tables-orders-${currentVenue.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${currentVenue.id}` }, () => {
          loadActiveOrders();
          loadCompletedOrdersToday();
        })
        .subscribe();

      const tablesSub = db.channel(`tables-${currentVenue.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables', filter: `venue_id=eq.${currentVenue.id}` }, () => {
          loadTables();
        })
        .subscribe();

      return () => {
        db.removeChannel(ordersSub);
        db.removeChannel(tablesSub);
      };
    }
  }, [currentVenue]);

  // Handle Document Drag Events to avoid dropping outside the container boundary
  useEffect(() => {
    if (draggingTable === null || !isEditMode) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('floor-plan-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      
      // Calculate snap to grid size: 64px (4rem)
      const x = Math.max(0, Math.floor((e.clientX - rect.left) / 64));
      const y = Math.max(0, Math.floor((e.clientY - rect.top) / 64));
      
      setTables(prev => prev.map(t => t.id === draggingTable ? { ...t, x, y } : t));
    };

    const handleWindowMouseUp = async () => {
      setTables(prev => {
        const table = prev.find(t => t.id === draggingTable);
        if (table && isUUID(table.id)) {
          db.from('cafe_tables')
            .update({ x_pos: table.x, y_pos: table.y })
            .eq('id', table.id)
            .then(({ error }) => {
              if (error) console.error('Error updating position in database:', error);
            });
        }
        return prev;
      });
      setDraggingTable(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingTable, isEditMode]);

  const loadTables = async () => {
    const { data, error } = await db.from('cafe_tables').select('*').eq('venue_id', currentVenue?.id);
    if (error) {
      console.error('Tables table might not exist yet:', error.message);
    } else if (data && data.length > 0) {
      setTables(data.map(t => ({ ...t, x: t.x_pos, y: t.y_pos })));
    }
  };

  const loadActiveOrders = async () => {
    const { data, error } = await db.from('orders')
      .select('*')
      .eq('venue_id', currentVenue?.id)
      .neq('status', 'ready');
    if (!error && data) {
      setActiveOrders(data as Order[]);
    }
  };

  const loadCompletedOrdersToday = async () => {
    if (!currentVenue) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data, error } = await db.from('orders')
      .select('*')
      .eq('venue_id', currentVenue.id)
      .eq('status', 'ready')
      .gte('created_at', startOfToday.toISOString());
    
    if (!error && data) {
      setCompletedOrdersToday(data as Order[]);
    }
  };

  // Metadata Accessors (localStorage backend)
  const getTableMeta = (tableId: string | number) => {
    const idStr = String(tableId);
    return {
      shape: localStorage.getItem(`snyf_shape_${currentVenue?.id}_${idStr}`) || 'square',
      zone: localStorage.getItem(`snyf_zone_${currentVenue?.id}_${idStr}`) || 'Main Hall',
      dnd: localStorage.getItem(`snyf_dnd_${currentVenue?.id}_${idStr}`) === 'true',
      turnoverManual: parseInt(localStorage.getItem(`snyf_turnover_${currentVenue?.id}_${idStr}`) || '0'),
      timerManual: localStorage.getItem(`snyf_timer_${currentVenue?.id}_${idStr}`) || null,
    };
  };

  const saveTableMeta = (tableId: string | number, meta: { shape?: string, zone?: string, dnd?: boolean, turnoverManual?: number, timerManual?: string | null }) => {
    const idStr = String(tableId);
    if (meta.shape !== undefined) localStorage.setItem(`snyf_shape_${currentVenue?.id}_${idStr}`, meta.shape);
    if (meta.zone !== undefined) localStorage.setItem(`snyf_zone_${currentVenue?.id}_${idStr}`, meta.zone);
    if (meta.dnd !== undefined) localStorage.setItem(`snyf_dnd_${currentVenue?.id}_${idStr}`, String(meta.dnd));
    if (meta.turnoverManual !== undefined) localStorage.setItem(`snyf_turnover_${currentVenue?.id}_${idStr}`, String(meta.turnoverManual));
    if (meta.timerManual !== undefined) {
      if (meta.timerManual === null) localStorage.removeItem(`snyf_timer_${currentVenue?.id}_${idStr}`);
      else localStorage.setItem(`snyf_timer_${currentVenue?.id}_${idStr}`, meta.timerManual);
    }
  };

  // Status Derivation: handles waiter_delivered vs delivered vs ready
  const getComputedStatus = (table: any) => {
    if (isEditMode) return 'available';

    const tableOrder = activeOrders.find(o => 
      o.table_num === table.name || 
      `T${o.table_num}` === table.name || 
      o.table_num?.toString() === table.name?.replace('T', '')
    );

    if (tableOrder) {
      if (tableOrder.waiter_delivered) return 'bill_requested';
      if (tableOrder.status === 'delivered') return 'occupied';
      return 'waiting_food';
    }

    // fallback to manual setting
    return table.status || 'available';
  };

  // Turnover count
  const getTableTurnoversToday = (table: any) => {
    const completedCount = completedOrdersToday.filter(o => 
      o.table_num === table.name || 
      `T${o.table_num}` === table.name || 
      o.table_num?.toString() === table.name?.replace('T', '')
    ).length;
    const meta = getTableMeta(table.id);
    return completedCount + meta.turnoverManual;
  };

  // Timer Calculations
  const getElapsedTime = (table: any) => {
    const tableOrder = activeOrders.find(o => 
      o.table_num === table.name || 
      `T${o.table_num}` === table.name || 
      o.table_num?.toString() === table.name?.replace('T', '')
    );

    if (!tableOrder) {
      const meta = getTableMeta(table.id);
      if (meta.timerManual) {
        return Math.floor((Date.now() - parseInt(meta.timerManual)) / 1000);
      }
      return null;
    }

    const orderTime = new Date(tableOrder.created_at).getTime();
    return Math.floor((Date.now() - orderTime) / 1000);
  };

  const formatElapsed = (seconds: number | null) => {
    if (seconds === null || seconds < 0) return '';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  // Revenue (for Heatmap Mode)
  const getTableRevenueToday = (tableName: string) => {
    return completedOrdersToday
      .filter(o => 
        o.table_num === tableName || 
        `T${o.table_num}` === tableName || 
        o.table_num?.toString() === tableName?.replace('T', '')
      )
      .reduce((sum, o) => sum + o.total, 0);
  };

  // Get active order details for Hover Preview
  const getActiveOrderForTable = (table: any) => {
    return activeOrders.find(o => 
      o.table_num === table.name || 
      `T${o.table_num}` === table.name || 
      o.table_num?.toString() === table.name?.replace('T', '')
    );
  };

  const handleMergeTables = async () => {
    if (mergeSelection.length < 2 || !currentVenue) return;
    
    const selectedTables = tables.filter(t => mergeSelection.includes(t.id));
    const newName = selectedTables.map(t => t.name).join(' + ');
    const newCapacity = selectedTables.reduce((acc, t) => acc + t.capacity, 0);
    const primaryTable = selectedTables[0];

    const newTableData = {
      venue_id: currentVenue.id,
      name: newName,
      capacity: newCapacity,
      status: primaryTable.status,
      x_pos: primaryTable.x,
      y_pos: primaryTable.y,
    };

    const { data, error } = await db.from('cafe_tables').insert(newTableData).select().single();
    if (error) {
      console.error('Error merging:', error);
      return;
    }

    // Delete old tables with valid UUID format
    for (const id of mergeSelection) {
      if (isUUID(id)) {
        await db.from('cafe_tables').delete().eq('id', id);
      }
    }

    setTables(prev => [
      ...prev.filter(t => !mergeSelection.includes(t.id)),
      { ...data, x: data.x_pos, y: data.y_pos }
    ]);
    
    setIsMerging(false);
    setMergeSelection([]);
  };

  const handleAddTable = async () => {
    if (!currentVenue) return;
    const newTableData = {
      venue_id: currentVenue.id,
      name: `T${tables.length + 1}`,
      capacity: 4,
      status: 'available',
      x_pos: 0,
      y_pos: 0,
    };
    
    const { data, error } = await db.from('cafe_tables').insert(newTableData).select().single();
    if (!error && data) {
      setTables([...tables, { ...data, x: data.x_pos, y: data.y_pos }]);
    } else {
      console.error('Error adding table:', error);
      // Fallback
      setTables([...tables, { id: Date.now(), ...newTableData, x: 0, y: 0 }]);
    }
  };

  const handleDragStart = (id: number | string) => {
    if (!isEditMode) return;
    setDraggingTable(id);
  };

  const handleOpenConfig = (table: any) => {
    const meta = getTableMeta(table.id);
    setConfiguringTable({
      ...table,
      shape: meta.shape,
      zone: meta.zone,
      dnd: meta.dnd,
      turnoverManual: meta.turnoverManual,
      timerManual: meta.timerManual
    });
  };

  const saveConfig = async () => {
    if (isUUID(configuringTable.id)) {
      await db.from('cafe_tables').update({
        name: configuringTable.name,
        capacity: configuringTable.capacity,
        status: configuringTable.status
      }).eq('id', configuringTable.id);
    }
    setTables(prev => prev.map(t => t.id === configuringTable.id ? configuringTable : t));
    
    // Save local metadata
    saveTableMeta(configuringTable.id, {
      shape: configuringTable.shape,
      zone: configuringTable.zone,
      dnd: configuringTable.dnd,
      turnoverManual: configuringTable.turnoverManual,
      timerManual: configuringTable.timerManual
    });

    setConfiguringTable(null);
  };

  const deleteTable = async () => {
    if (isUUID(configuringTable.id)) {
      await db.from('cafe_tables').delete().eq('id', configuringTable.id);
    }
    setTables(prev => prev.filter(t => t.id !== configuringTable.id));
    setConfiguringTable(null);
  };
  
  const getStatusColor = (status: string, revenueGlow = false, revenue = 0, maxRev = 0) => {
    if (revenueGlow && maxRev > 0 && revenue > 0) {
      const ratio = revenue / maxRev;
      // Beautiful violet gradient scale for top earners
      return `bg-indigo-600/${Math.floor(ratio * 90) + 10} border-indigo-500 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.25)]`;
    }

    switch (status) {
      case 'available': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20';
      case 'occupied': return 'bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20';
      case 'waiting_food': return 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20';
      case 'bill_requested': return 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20';
      default: return 'bg-muted text-muted-foreground border-border hover:bg-accent';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Merge DB table row with localStorage metadata into one enriched object
  const getTableWithMeta = (t: any) => {
    const meta = getTableMeta(t.id);
    return {
      ...t,
      shape: meta.shape,
      zone: meta.zone,
      dnd: meta.dnd,
      turnoverManual: meta.turnoverManual,
      timerManual: meta.timerManual,
    };
  };

  // Get distinct zones list for filters
  const distinctZones = ['All', ...Array.from(new Set(tables.map(t => getTableMeta(t.id).zone)))];

  const maxRevenue = Math.max(...tables.map(t => getTableRevenueToday(t.name)), 0);

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      {/* Top Banner Control Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 bg-card border border-border px-5 py-3 rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Layers className="text-primary w-6 h-6" />
            Floor & Table Intelligence
          </h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          {/* Heatmap Toggle */}
          <button
            onClick={() => setIsHeatmapMode(!isHeatmapMode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all border ${
              isHeatmapMode 
                ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]' 
                : 'bg-background text-foreground border-border hover:bg-accent'
            }`}
          >
            <Flame className={`w-4 h-4 ${isHeatmapMode ? 'animate-pulse text-amber-300' : ''}`} />
            {isHeatmapMode ? 'Heatmap Active' : 'Revenue Heatmap'}
          </button>

          {/* Add Table Button - always visible */}
          <button 
            onClick={handleAddTable}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      </div>

      {/* Filters & Status Legend Panel */}
      <div className="flex flex-col md:flex-row gap-2 items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5 shrink-0 shadow-sm">
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span className="text-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span className="text-foreground">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
            <span className="text-foreground">Waiting Food</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
            <span className="text-foreground">Bill Requested</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-border pl-3">
            <Moon className="w-2.5 h-2.5 text-purple-500 fill-purple-500" />
            <span className="text-purple-500">DND</span>
          </div>
        </div>
        
        {/* Zone Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-xl text-sm font-semibold">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span>Zone:</span>
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-foreground font-medium"
            >
              {distinctZones.map(zone => (
                <option key={zone} value={zone} className="bg-card text-foreground">{zone}</option>
              ))}
            </select>
          </div>

          {!isEditMode && (
            <button 
              onClick={() => setIsMerging(true)} 
              className="flex items-center gap-2 text-sm px-4 py-2 border border-border rounded-xl hover:bg-accent transition-colors font-semibold text-foreground bg-background shadow-xs shrink-0"
            >
              <MoveDiagonal className="w-4 h-4 text-muted-foreground" />
              Merge Tables
            </button>
          )}
        </div>
      </div>

      {/* Grid Container */}
      <div 
        id="floor-plan-container"
        className="flex-1 bg-muted/20 border border-border rounded-2xl relative overflow-auto select-none shadow-inner min-h-[480px]"
        style={{ minWidth: '100%' }}
      >
        {/* Grid Background Pattern */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(128,128,128,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,128,128,0.15) 1px, transparent 1px)',
            backgroundSize: '4rem 4rem'
          }}
        />

        {/* Outer Layout Render */}
        <div className="p-8 relative h-full">
          {tables.map((baseTable) => {
            const table = getTableWithMeta(baseTable);
            const status = getComputedStatus(table);
            const turnovers = getTableTurnoversToday(table);
            const elapsedSeconds = getElapsedTime(table);
            const isOverstayed = elapsedSeconds && elapsedSeconds > 2700; // 45 mins
            const todayRevenue = getTableRevenueToday(table.name);

            // Filter logic
            const zoneMatches = selectedZoneFilter === 'All' || table.zone === selectedZoneFilter;

            // Shape Styling helper
            const getShapeStyles = (shape: string) => {
              switch (shape) {
                case 'circle': return 'rounded-full w-32 h-32';
                case 'rectangle': return 'rounded-2xl w-48 h-32';
                default: return 'rounded-2xl w-32 h-32'; // square
              }
            };

            return (
              <div
                key={table.id}
                onMouseDown={() => handleDragStart(table.id)}
                onMouseEnter={() => setHoveredTableId(table.id)}
                onMouseLeave={() => setHoveredTableId(null)}
                className={`absolute transition-all border-2 shadow-md flex flex-col justify-between p-4 group
                  ${getShapeStyles(table.shape)}
                  ${getStatusColor(status, isHeatmapMode, todayRevenue, maxRevenue)} 
                  ${isEditMode ? 'cursor-move hover:shadow-lg' : 'cursor-pointer hover:scale-105'}
                  ${draggingTable === table.id ? 'opacity-70 scale-105 z-50 duration-0' : 'duration-300 z-10'}
                  ${!zoneMatches ? 'opacity-25 grayscale-[30%] pointer-events-none' : 'opacity-100'}
                `}
                style={{
                  left: `calc(${table.x} * 4rem)`,
                  top: `calc(${table.y} * 4rem)`,
                }}
              >
                {/* Configuration / Action Overlays */}
                {isEditMode && (
                  <div 
                    onMouseDown={(e) => { e.stopPropagation(); handleOpenConfig(table); }}
                    className="absolute -top-2 -right-2 bg-background border border-border text-foreground rounded-full p-1.5 cursor-pointer hover:bg-accent z-20 shadow-md"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}

                {/* Table Header Details */}
                <div className="flex justify-between items-start pointer-events-none">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-lg tracking-tight">{table.name}</span>
                    <span className="text-[10px] opacity-75 font-semibold uppercase tracking-wider">{table.zone}</span>
                  </div>
                  {isEditMode ? (
                    <GripVertical className="w-4 h-4 opacity-50" />
                  ) : (
                    /* DND Mode Icon */
                    table.dnd && (
                      <Moon className="w-4 h-4 text-purple-600 fill-purple-600 animate-pulse" />
                    )
                  )}
                </div>
                
                {/* Hover Order Preview Tooltip */}
                {!isEditMode && hoveredTableId === table.id && getActiveOrderForTable(table) && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 bg-card/95 backdrop-blur-md border border-border text-card-foreground p-4 rounded-xl shadow-xl z-50 w-56 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none">
                    <div className="font-bold text-xs uppercase tracking-wider text-primary border-b border-border pb-1.5 mb-2 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Order Summary
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {getActiveOrderForTable(table)?.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-medium">
                          <span className="text-foreground">{item.qty}x {item.name}</span>
                          <span className="text-muted-foreground font-mono">₹{item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border mt-2 pt-2 flex justify-between items-center text-xs font-bold">
                      <span>Total:</span>
                      <span className="text-primary font-mono">₹{getActiveOrderForTable(table)?.total}</span>
                    </div>
                  </div>
                )}

                {/* Table Status Details & Custom Badges */}
                <div className="flex flex-col gap-1 pointer-events-none">
                  {/* Revenue or Turnover */}
                  {isHeatmapMode ? (
                    <div className="text-[11px] font-bold text-indigo-100 flex items-center gap-0.5 bg-indigo-500/80 px-2 py-0.5 rounded-lg w-max shadow-xs">
                      ₹{todayRevenue.toLocaleString('en-IN')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-90">
                      <RotateCw className="w-3 h-3 shrink-0" />
                      <span>{turnovers} Turns</span>
                    </div>
                  )}

                  {/* Table Capacity & Timer */}
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold opacity-80">
                      <Users className="w-3 h-3" /> {table.capacity}
                    </div>

                    {/* Timer Alert Badge */}
                    {!isEditMode && elapsedSeconds !== null && (
                      <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isOverstayed 
                          ? 'bg-rose-500 text-white animate-pulse' 
                          : 'bg-background/80 text-foreground border border-border'
                      }`}>
                        {isOverstayed ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        <span>{formatElapsed(elapsedSeconds)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table Configuration / Editing Modal */}
      {configuringTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
              <h3 className="font-bold text-lg text-foreground">Configure {configuringTable.name}</h3>
              <button onClick={() => setConfiguringTable(null)} className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Form Input fields */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Table Name</label>
                <input 
                  type="text" 
                  value={configuringTable.name}
                  onChange={(e) => setConfiguringTable({...configuringTable, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium text-foreground text-sm" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Capacity (Seats)</label>
                  <input 
                    type="number" 
                    value={configuringTable.capacity}
                    onChange={(e) => setConfiguringTable({...configuringTable, capacity: parseInt(e.target.value) || 1})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium text-foreground text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Zone Assignment</label>
                  <input 
                    type="text" 
                    value={configuringTable.zone}
                    placeholder="e.g. Bar, Balcony"
                    onChange={(e) => setConfiguringTable({...configuringTable, zone: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium text-foreground text-sm" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Table Shape</label>
                  <select
                    value={configuringTable.shape}
                    onChange={(e) => setConfiguringTable({...configuringTable, shape: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium text-foreground text-sm"
                  >
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Manual Status Override</label>
                  <select
                    value={configuringTable.status || 'available'}
                    onChange={(e) => setConfiguringTable({...configuringTable, status: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium text-foreground text-sm"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="waiting_food">Waiting for Food</option>
                    <option value="bill_requested">Bill Requested</option>
                  </select>
                </div>
              </div>

              {/* DND Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-2xl">
                <div className="flex items-center gap-2">
                  <Moon className="w-5 h-5 text-purple-600 fill-purple-600" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Do Not Disturb (DND)</div>
                    <div className="text-xs text-muted-foreground">Warns staff not to approach table</div>
                  </div>
                </div>
                <input 
                  type="checkbox"
                  checked={configuringTable.dnd}
                  onChange={(e) => setConfiguringTable({...configuringTable, dnd: e.target.checked})}
                  className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              {/* Manual Counter / Timer Override Controls */}
              <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Manual Turnover Offset</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfiguringTable(prev => ({ ...prev, turnoverManual: Math.max(0, prev.turnoverManual - 1) }))}
                      className="px-2.5 py-1 bg-background border border-border rounded-md hover:bg-accent text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-sm w-6 text-center">{configuringTable.turnoverManual}</span>
                    <button
                      onClick={() => setConfiguringTable(prev => ({ ...prev, turnoverManual: prev.turnoverManual + 1 }))}
                      className="px-2.5 py-1 bg-background border border-border rounded-md hover:bg-accent text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Manual Timer</span>
                  </div>
                  <div className="flex gap-2">
                    {configuringTable.timerManual ? (
                      <button
                        onClick={() => setConfiguringTable({...configuringTable, timerManual: null})}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg text-xs font-semibold"
                      >
                        Reset Timer
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfiguringTable({...configuringTable, timerManual: String(Date.now())})}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold"
                      >
                        Start Timer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-muted/40 border-t border-border flex justify-between items-center">
              <button 
                onClick={deleteTable} 
                className="px-4 py-2.5 font-bold text-sm text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors"
              >
                Delete Table
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfiguringTable(null)} 
                  className="px-4 py-2.5 font-bold text-sm text-muted-foreground hover:bg-accent rounded-xl transition-colors border border-border bg-background"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveConfig} 
                  className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Tables Modal */}
      {isMerging && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
              <h3 className="font-bold text-lg text-foreground">Merge Tables</h3>
              <button onClick={() => { setIsMerging(false); setMergeSelection([]); }} className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground font-medium">Select tables to merge into one larger group:</p>
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {tables.map(table => (
                  <label key={table.id} className="flex items-center gap-3.5 p-3.5 border border-border rounded-xl cursor-pointer hover:bg-accent transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer"
                      checked={mergeSelection.includes(table.id)}
                      onChange={(e) => {
                        if (e.target.checked) setMergeSelection(prev => [...prev, table.id]);
                        else setMergeSelection(prev => prev.filter(id => id !== table.id));
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-bold text-foreground text-sm">{table.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {table.capacity} Seats • Zone: {getTableMeta(table.id).zone} • {getStatusLabel(getComputedStatus(table))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/40 border-t border-border flex justify-end gap-3">
              <button 
                onClick={() => { setIsMerging(false); setMergeSelection([]); }} 
                className="px-4 py-2.5 font-bold text-sm text-muted-foreground hover:bg-accent rounded-xl transition-colors border border-border bg-background"
              >
                Cancel
              </button>
              <button 
                onClick={handleMergeTables} 
                disabled={mergeSelection.length < 2}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Merge Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
