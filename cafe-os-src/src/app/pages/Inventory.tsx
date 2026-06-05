import { useState } from 'react';
import { Package, Scale, ArrowDownUp, AlertCircle, Plus, Search, Filter, X } from 'lucide-react';

const mockInventory = [
  { id: 1, name: 'Coffee Beans (Arabica)', unit: 'kg', stock: 4.5, threshold: 5, category: 'Raw Material', cost: 1200 },
  { id: 2, name: 'Whole Milk', unit: 'L', stock: 12, threshold: 10, category: 'Dairy', cost: 65 },
  { id: 3, name: 'Almond Milk', unit: 'L', stock: 4, threshold: 3, category: 'Dairy', cost: 280 },
  { id: 4, name: 'Sugar Packets', unit: 'box', stock: 15, threshold: 5, category: 'Consumable', cost: 150 },
  { id: 5, name: 'Takeaway Cups (8oz)', unit: 'pcs', stock: 450, threshold: 500, category: 'Packaging', cost: 4 },
];

export function Inventory() {
  const [activeTab, setActiveTab] = useState<'stock' | 'recipes'>('stock');
  const [inventoryItems, setInventoryItems] = useState(mockInventory);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [updateStockVal, setUpdateStockVal] = useState<string>('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);

  const [newMaterial, setNewMaterial] = useState({ name: '', category: 'Raw Material', unit: 'kg', stock: 0, threshold: 0, cost: 0 });
  
  const [recipes, setRecipes] = useState<any[]>([]);
  const [newRecipeItem, setNewRecipeItem] = useState('Cappuccino (Regular)');
  const [newRecipeIngredients, setNewRecipeIngredients] = useState<any[]>([{ materialId: 1, amount: '' }]);

  const handleSaveNewMaterial = () => {
    if (!newMaterial.name) return;
    setInventoryItems(prev => [...prev, { id: Date.now(), ...newMaterial }]);
    setIsAddingMaterial(false);
    setNewMaterial({ name: '', category: 'Raw Material', unit: 'kg', stock: 0, threshold: 0, cost: 0 });
  };

  const handleSaveRecipe = () => {
    setRecipes(prev => [...prev, { id: Date.now(), item: newRecipeItem, ingredients: newRecipeIngredients }]);
    setIsCreatingRecipe(false);
    setNewRecipeItem('Cappuccino (Regular)');
    setNewRecipeIngredients([{ materialId: 1, amount: '' }]);
  };

  const handleUpdateClick = (item: any) => {
    setSelectedItem(item);
    setUpdateStockVal(item.stock.toString());
  };

  const handleSaveStock = () => {
    if (!selectedItem) return;
    const newStock = parseFloat(updateStockVal);
    if (isNaN(newStock) || newStock < 0) return;

    setInventoryItems(prev =>
      prev.map(item => item.id === selectedItem.id ? { ...item, stock: newStock } : item)
    );
    setSelectedItem(null);
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Inventory & Recipes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage raw materials, track stock levels, and build precise item recipes.
          </p>
        </div>
        <button 
          onClick={() => activeTab === 'stock' ? setIsAddingMaterial(true) : setIsCreatingRecipe(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'stock' ? 'Add Material' : 'Create Recipe'}
        </button>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-4 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'stock'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Raw Materials Stock
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`pb-4 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recipes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Recipe Mapping
        </button>
      </div>

      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search inventory..."
                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition-colors">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Item Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">In Stock</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Unit Cost</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inventoryItems.map((item) => {
                  const isLow = item.stock <= item.threshold;
                  return (
                    <tr key={item.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium text-foreground">{item.name}</div>
                        {isLow && (
                          <div className="flex items-center gap-1 text-[10px] text-destructive mt-1 font-semibold uppercase tracking-wider">
                            <AlertCircle className="w-3 h-3" />
                            Low Stock
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{item.category}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                            {item.stock} {item.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-muted-foreground">
                        ₹{item.cost.toLocaleString()}/{item.unit}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button 
                          onClick={() => handleUpdateClick(item)}
                          className="text-primary hover:underline font-medium text-sm px-3 py-1 rounded-md hover:bg-primary/10 transition-colors"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'recipes' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col space-y-4 min-h-[400px]">
            {recipes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Scale className="w-8 h-8 text-primary" />
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-bold">No Recipes Mapped Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mt-2">
                    Connect raw materials to your menu items so Snyf can automatically deplete stock when an order is placed.
                  </p>
                </div>
                <button 
                  onClick={() => setIsCreatingRecipe(true)}
                  className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium mt-6 hover:bg-primary/90 transition-colors"
                >
                  Start Mapping
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Mapped Recipes</h3>
                  <button onClick={() => setIsCreatingRecipe(true)} className="flex items-center gap-2 text-primary font-medium text-sm hover:underline">
                    <Plus className="w-4 h-4" /> Add Recipe
                  </button>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                  {recipes.map(recipe => (
                    <div key={recipe.id} className="border border-border rounded-xl p-4">
                      <h4 className="font-semibold text-foreground mb-3">{recipe.item}</h4>
                      <div className="space-y-2">
                        {recipe.ingredients.map((ing: any, i: number) => {
                          const material = inventoryItems.find(m => m.id === ing.materialId);
                          return (
                            <div key={i} className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">{material?.name || 'Unknown Material'}</span>
                              <span className="font-medium font-mono">{ing.amount} {material?.unit}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold px-2">How Recipe Mapping Works</h3>
            <div className="bg-accent/50 rounded-xl p-4 flex gap-4 items-start">
              <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">1</div>
              <div>
                <p className="text-sm font-medium">Select a Menu Item</p>
                <p className="text-xs text-muted-foreground mt-1">Pick an existing item from your Snyf Menu Manager (e.g., "Cappuccino").</p>
              </div>
            </div>
            <div className="flex justify-center -my-2 text-muted-foreground">
              <ArrowDownUp className="w-4 h-4" />
            </div>
            <div className="bg-accent/50 rounded-xl p-4 flex gap-4 items-start">
              <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">2</div>
              <div>
                <p className="text-sm font-medium">Add Ingredients</p>
                <p className="text-xs text-muted-foreground mt-1">Select from your raw materials and specify the exact quantity used (e.g., 18g Coffee Beans, 150ml Milk).</p>
              </div>
            </div>
            <div className="flex justify-center -my-2 text-muted-foreground">
              <ArrowDownUp className="w-4 h-4" />
            </div>
            <div className="bg-accent/50 rounded-xl p-4 flex gap-4 items-start">
              <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">3</div>
              <div>
                <p className="text-sm font-medium">Auto-Depletion</p>
                <p className="text-xs text-muted-foreground mt-1">Whenever a customer orders this item, Snyf will instantly deduct the precise ingredient amounts from your inventory.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Stock Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-lg">Update Stock</h3>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Item Name</label>
                <div className="font-semibold text-foreground text-lg">{selectedItem.name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  New Quantity (in {selectedItem.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={updateStockVal}
                  onChange={(e) => setUpdateStockVal(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-mono"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-end gap-3">
              <button 
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveStock}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Material Modal */}
      {isAddingMaterial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-lg">Add New Material</h3>
              <button onClick={() => setIsAddingMaterial(false)} className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Material Name</label>
                  <input type="text" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="e.g., Arabica Coffee Beans" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
                  <select value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                    <option>Raw Material</option>
                    <option>Dairy</option>
                    <option>Consumable</option>
                    <option>Packaging</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Unit</label>
                  <select value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                    <option>kg</option>
                    <option>L</option>
                    <option>pcs</option>
                    <option>box</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Initial Stock</label>
                  <input type="number" value={newMaterial.stock || ''} onChange={e => setNewMaterial({...newMaterial, stock: parseFloat(e.target.value) || 0})} placeholder="0" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Low Stock Alert at</label>
                  <input type="number" value={newMaterial.threshold || ''} onChange={e => setNewMaterial({...newMaterial, threshold: parseFloat(e.target.value) || 0})} placeholder="0" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-end gap-3">
              <button onClick={() => setIsAddingMaterial(false)} className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleSaveNewMaterial} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors">Save Material</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Recipe Modal */}
      {isCreatingRecipe && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-lg">Create Recipe Mapping</h3>
              <button onClick={() => setIsCreatingRecipe(false)} className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Select Menu Item</label>
                <select value={newRecipeItem} onChange={e => setNewRecipeItem(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium">
                  <option>Cappuccino (Regular)</option>
                  <option>Cappuccino (Large)</option>
                  <option>Cold Brew</option>
                  <option>Margherita Pizza</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium text-muted-foreground">Ingredients</label>
                
                {newRecipeIngredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select 
                      value={ing.materialId}
                      onChange={e => {
                        const newIngs = [...newRecipeIngredients];
                        newIngs[idx].materialId = parseInt(e.target.value);
                        setNewRecipeIngredients(newIngs);
                      }}
                      className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                    >
                      {inventoryItems.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Amount" 
                      value={ing.amount}
                      onChange={e => {
                        const newIngs = [...newRecipeIngredients];
                        newIngs[idx].amount = e.target.value;
                        setNewRecipeIngredients(newIngs);
                      }}
                      className="w-24 bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground" 
                    />
                    <span className="text-sm font-medium text-muted-foreground w-8">
                      {inventoryItems.find(m => m.id === ing.materialId)?.unit || ''}
                    </span>
                    <button 
                      onClick={() => {
                        if (newRecipeIngredients.length > 1) {
                          setNewRecipeIngredients(prev => prev.filter((_, i) => i !== idx));
                        }
                      }}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <button 
                  onClick={() => setNewRecipeIngredients(prev => [...prev, { materialId: inventoryItems[0]?.id || 1, amount: '' }])}
                  className="flex items-center gap-2 text-primary font-medium text-sm mt-2 hover:underline"
                >
                  <Plus className="w-4 h-4" /> Add Ingredient
                </button>
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-between items-center gap-3">
              <div className="text-xs text-muted-foreground max-w-[200px]">
                Stock will automatically deplete based on these amounts per order.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsCreatingRecipe(false)} className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleSaveRecipe} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors">Save Recipe</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
