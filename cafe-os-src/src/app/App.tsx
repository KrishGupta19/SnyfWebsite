import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VenueProvider }    from '../context/VenueContext';
import { Sidebar }          from './components/Sidebar';
import { TopBar }           from './components/TopBar';
import { Dashboard }        from './pages/Dashboard';
import { Revenue }          from './pages/Revenue';
import { CustomerInsights } from './pages/CustomerInsights';
import { GrowthPlans }      from './pages/GrowthPlans';
import { KitchenBackend }   from './pages/KitchenBackend';
import { MenuManager }      from './pages/MenuManager';
import { VenueInfo }        from './pages/VenueInfo';
import { Placeholder }      from './pages/Placeholder';

export default function App() {
  return (
    <VenueProvider>
      <BrowserRouter>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/"          element={<Dashboard />}        />
                <Route path="/kitchen"   element={<KitchenBackend />}   />
                <Route path="/menu"      element={<MenuManager />}      />
                <Route path="/venue"     element={<VenueInfo />}        />
                <Route path="/revenue"   element={<Revenue />}          />
                <Route path="/customers" element={<CustomerInsights />} />
                <Route path="/growth"    element={<GrowthPlans />}      />
                <Route path="/campaigns" element={<Placeholder title="Campaign Engine"  description="Coming soon" />} />
                <Route path="/qr"        element={<Placeholder title="QR Analytics"     description="Coming soon" />} />
                <Route path="/rewards"   element={<Placeholder title="Rewards Program"  description="Coming soon" />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </VenueProvider>
  );
}