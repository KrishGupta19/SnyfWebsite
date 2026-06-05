import { useState, useEffect } from 'react';
import { LayoutDashboard, Plus, Settings, Users, GripVertical, SplitSquareHorizontal, MoveDiagonal, Check, Edit2, X } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useVenue } from '../../context/VenueContext';

const initialTables = [
  { id: 1, name: 'T1', capacity: 2, status: 'available', x: 1, y: 1 },
  { id: 2, name: 'T2', capacity: 2, status: 'occupied', x: 3, y: 1 },
  { id: 3, name: 'T3', capacity: 4, status: 'waiting_food', x: 1, y: 3 },
  { id: 4, name: 'T4', capacity: 4, status: 'bill_requested', x: 5, y: 3 },
  { id: 5, name: 'T5', capacity: 6, status: 'available', x: 3, y: 5 },
];

import { Order } from '../../lib/types';

export function TableManagement() {
  const { currentVenue } = useVenue();
  const [tables, setTables] = useState<any[]>(initialTables);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggingTable, setDraggingTable] = useState<number | null>(null);
  const [configuringTable, setConfiguringTable] = useState<any>(null);
  
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<number[]>([]);

  useEffect(() => {
    if (currentVenue) {
      loadTables();
      loadActiveOrders();
      
      const ordersSub = db.channel(`tables-orders-${currentVenue.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${currentVenue.id}` }, () => {
          loadActiveOrders();
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

  const loadActiveOrders = async () => {
    const { data, error } = await db.from('orders')
      .select('*')
      .eq('venue_id', currentVenue?.id)
      .neq('status', 'ready');
    if (!error && data) {
      setActiveOrders(data as Order[]);
    }
  };

  const getComputedStatus = (table: any) => {
    // If we're editing, default to available for styling
    if (isEditMode) return 'available';

    // Find active orders for this table
    // table.name is something like "T1" or "T1 + T2". order.table_num might be "1" or "T1".
    const tableOrder = activeOrders.find(o => 
      o.table_num === table.name || 
      `T${o.table_num}` === table.name || 
      o.table_num?.toString() === table.name?.replace('T', '')
    );

    if (tableOrder) {
      if (tableOrder.waiter_delivered) return 'bill_requested';
      return 'waiting_food';
    }

    // Default fallback to the table's manual status
    return table.status || 'available';
  };

  const loadTables = async () => {
    const { data, error } = await db.from('cafe_tables').select('*').eq('venue_id', currentVenue?.id);
    if (error) {
      console.error('Tables table might not exist yet:', error.message);
      // We keep the initial mock tables if the db fails
    } else if (data && data.length > 0) {
      setTables(data.map(t => ({ ...t, x: t.x_pos, y: t.y_pos })));
    }
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

    // Delete old tables
    for (const id of mergeSelection) {
      if (typeof id === 'string') { // Only delete if it's a real UUID from DB
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
      // Mock fallback
      setTables([...tables, { id: Date.now(), ...newTableData, x: 0, y: 0 }]);
    }
  };

  const handleDragStart = (id: number | string) => {
    if (!isEditMode) return;
    setDraggingTable(id as any);
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!isEditMode || draggingTable === null) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    const x = Math.max(0, Math.floor((e.clientX - rect.left) / 64));
    const y = Math.max(0, Math.floor((e.clientY - rect.top) / 64));

    setTables(prev => prev.map(t => t.id === draggingTable ? { ...t, x, y } : t));
  };

  const handleDragEnd = async () => {
    if (draggingTable !== null) {
      const table = tables.find(t => t.id === draggingTable);
      if (table && typeof table.id === 'string') {
        await db.from('cafe_tables').update({ x_pos: table.x, y_pos: table.y }).eq('id', table.id);
      }
    }
    setDraggingTable(null);
  };

  const saveConfig = async () => {
    if (typeof configuringTable.id === 'string') {
      await db.from('cafe_tables').update({
        name: configuringTable.name,
        capacity: configuringTable.capacity
      }).eq('id', configuringTable.id);
    }
    setTables(prev => prev.map(t => t.id === configuringTable.id ? configuringTable : t));
    setConfiguringTable(null);
  };

  const deleteTable = async () => {
    if (typeof configuringTable.id === 'string') {
      await db.from('cafe_tables').delete().eq('id', configuringTable.id);
    }
    setTables(prev => prev.filter(t => t.id !== configuringTable.id));
    setConfiguringTable(null);
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'occupied': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'waiting_food': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'bill_requested': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Floor & Table Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Map out your cafe floor plan, merge tables, and track real-time dining status.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors border ${
              isEditMode 
                ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' 
                : 'bg-background text-foreground border-border hover:bg-accent'
            }`}
          >
            {isEditMode ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            {isEditMode ? 'Finish Editing Layout' : 'Edit Floor Plan'}
          </button>
          {isEditMode && (
            <button 
              onClick={handleAddTable}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Table
            </button>
          )}
        </div>
      </div>

      {/* Legend & Quick Actions */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-card border border-border rounded-2xl p-4 shrink-0">
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div> Occupied
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div> Waiting for Food
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div> Bill Requested
          </div>
        </div>
        
        {!isEditMode && (
          <div className="flex gap-2">
            <button onClick={() => setIsMerging(true)} className="flex items-center gap-2 text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">
              <MoveDiagonal className="w-4 h-4" /> Merge Tables
            </button>
          </div>
        )}
      </div>

      <div 
        className="flex-1 bg-muted/20 border border-border rounded-2xl relative overflow-hidden select-none"
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Grid Background Pattern */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(128,128,128,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,128,128,0.15) 1px, transparent 1px)',
            backgroundSize: '4rem 4rem'
          }}
        />

        <div className="p-8 relative h-full">
          {tables.map((table) => (
            <div
              key={table.id}
              onMouseDown={() => handleDragStart(table.id)}
              className={`absolute transition-all w-32 h-32 rounded-2xl border-2 shadow-sm flex flex-col justify-between p-3 
                ${getStatusColor(getComputedStatus(table))} 
                ${isEditMode ? 'cursor-move hover:shadow-md' : 'cursor-pointer hover:scale-105'}
                ${draggingTable === table.id ? 'opacity-70 scale-105 z-50 duration-0' : 'duration-300 z-10'}
              `}
              style={{
                left: `calc(${table.x} * 4rem)`,
                top: `calc(${table.y} * 4rem)`,
              }}
            >
              {isEditMode && (
                <div 
                  onMouseDown={(e) => { e.stopPropagation(); setConfiguringTable(table); }}
                  className="absolute -top-2 -right-2 bg-background border border-border text-foreground rounded-full p-1 cursor-pointer hover:bg-accent z-20 shadow-sm"
                >
                  <Settings className="w-3 h-3" />
                </div>
              )}

              <div className="flex justify-between items-start pointer-events-none">
                <span className="font-bold text-lg">{table.name}</span>
                {isEditMode && <GripVertical className="w-4 h-4 opacity-50" />}
              </div>
              
              <div className="flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center gap-1 text-xs opacity-80 font-medium">
                  <Users className="w-3 h-3" /> {table.capacity} Seats
                </div>
                {!isEditMode && (
                  <div className="text-[10px] font-bold uppercase tracking-wider">
                    {getStatusLabel(getComputedStatus(table))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Configuration Modal */}
      {configuringTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-lg">Configure Table</h3>
              <button onClick={() => setConfiguringTable(null)} className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Table Name</label>
                <input 
                  type="text" 
                  value={configuringTable.name}
                  onChange={(e) => setConfiguringTable({...configuringTable, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Seating Capacity</label>
                <input 
                  type="number" 
                  value={configuringTable.capacity}
                  onChange={(e) => setConfiguringTable({...configuringTable, capacity: parseInt(e.target.value) || 1})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-between items-center">
              <button 
                onClick={deleteTable} 
                className="px-4 py-2 font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
              >
                Delete Table
              </button>
              <button onClick={saveConfig} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Tables Modal */}
      {isMerging && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-lg">Merge Tables</h3>
              <button onClick={() => { setIsMerging(false); setMergeSelection([]); }} className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Select tables to merge into one larger group:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tables.map(table => (
                  <label key={table.id} className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-primary focus:ring-primary"
                      checked={mergeSelection.includes(table.id)}
                      onChange={(e) => {
                        if (e.target.checked) setMergeSelection(prev => [...prev, table.id]);
                        else setMergeSelection(prev => prev.filter(id => id !== table.id));
                      }}
                    />
                    <div>
                      <div className="font-semibold">{table.name}</div>
                      <div className="text-xs text-muted-foreground">{table.capacity} Seats • {getStatusLabel(table.status)}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-end gap-3">
              <button 
                onClick={() => { setIsMerging(false); setMergeSelection([]); }} 
                className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleMergeTables} 
                disabled={mergeSelection.length < 2}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
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
