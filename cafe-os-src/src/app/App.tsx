import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { VenueProvider }    from '../context/VenueContext';
import { LockProvider, useLock } from '../context/LockContext';
import { Sidebar }          from './components/Sidebar';
import { TopBar }           from './components/TopBar';
import { Dashboard }        from './pages/Dashboard';
import { Revenue }          from './pages/Revenue';
import { CustomerInsights } from './pages/CustomerInsights';
import { GrowthPlans }      from './pages/GrowthPlans';
import { KitchenBackend }   from './pages/KitchenBackend';
import { WaiterTab }        from './pages/WaiterTab';
import { MenuManager }      from './pages/MenuManager';
import { VenueInfo }        from './pages/VenueInfo';
import { QRCodes }          from './pages/QRCodes';
import { Placeholder }      from './pages/Placeholder';
import { UnlockModal }      from './components/UnlockModal';

export default function App() {
  return (
    <VenueProvider>
      <LockProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </LockProvider>
    </VenueProvider>
  );
}

function AppContent() {
  const { isLockedToKitchen, isWaiterMode, setShowUnlockModal, setOnUnlockSuccess } = useLock();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLockedToKitchen && location.pathname !== '/kitchen') {
      navigate('/kitchen', { replace: true });
      setShowUnlockModal(true);
      setOnUnlockSuccess(null);
    } else if (isWaiterMode && location.pathname !== '/waiter') {
      navigate('/waiter', { replace: true });
      setShowUnlockModal(true);
      setOnUnlockSuccess(null);
    }
  }, [location.pathname, isLockedToKitchen, isWaiterMode, navigate, setShowUnlockModal, setOnUnlockSuccess]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"          element={<Dashboard />}        />
            <Route path="/kitchen"   element={<KitchenBackend />}   />
            <Route path="/waiter"    element={<WaiterTab />}        />
            <Route path="/menu"      element={<MenuManager />}      />
            <Route path="/venue"     element={<VenueInfo />}        />
            <Route path="/revenue"   element={<Revenue />}          />
            <Route path="/customers" element={<CustomerInsights />} />
            <Route path="/growth"    element={<GrowthPlans />}      />
            <Route path="/campaigns" element={<Placeholder title="Campaign Engine"  description="Coming soon" />} />
            <Route path="/qr"        element={<QRCodes />} />
            <Route path="/rewards"   element={<Placeholder title="Rewards Program"  description="Coming soon" />} />
          </Routes>
        </main>
      </div>
      <UnlockModal />
    </div>
  );
}