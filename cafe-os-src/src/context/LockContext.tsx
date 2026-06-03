import React, { createContext, useContext, useState, useEffect } from 'react';
import { useVenue } from './VenueContext';

interface LockContextType {
  isLockedToKitchen: boolean;
  isWaiterMode: boolean;
  lockPIN: string;
  setLockPIN: (pin: string) => void;
  lockInterface: () => void;
  lockWaiterMode: () => void;
  unlockInterface: (pin: string) => boolean;
  showUnlockModal: boolean;
  setShowUnlockModal: (show: boolean) => void;
  onUnlockSuccess: (() => void) | null;
  setOnUnlockSuccess: (cb: (() => void) | null) => void;
}

const LockContext = createContext<LockContextType | null>(null);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { venue } = useVenue();
  const [isLockedToKitchen, setIsLockedToKitchen] = useState<boolean>(() => {
    const venueId = venue?.id || 'default';
    return localStorage.getItem(`snyf_kitchen_locked_${venueId}`) === 'true';
  });
  const [isWaiterMode, setIsWaiterMode] = useState<boolean>(() => {
    const venueId = venue?.id || 'default';
    return localStorage.getItem(`snyf_waiter_locked_${venueId}`) === 'true';
  });
  const [lockPIN, setLockPINState] = useState<string>(() => {
    const venueId = venue?.id || 'default';
    return localStorage.getItem(`snyf_kitchen_pin_${venueId}`) || '1234';
  });

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [onUnlockSuccess, setOnUnlockSuccess] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (venue?.id) {
      const locked = localStorage.getItem(`snyf_kitchen_locked_${venue.id}`) === 'true';
      const waiterLocked = localStorage.getItem(`snyf_waiter_locked_${venue.id}`) === 'true';
      const pin = localStorage.getItem(`snyf_kitchen_pin_${venue.id}`) || '1234';
      setIsLockedToKitchen(locked);
      setIsWaiterMode(waiterLocked);
      setLockPINState(pin);
    }
  }, [venue?.id]);

  const setLockPIN = (newPin: string) => {
    if (!venue?.id) return;
    localStorage.setItem(`snyf_kitchen_pin_${venue.id}`, newPin);
    setLockPINState(newPin);
  };

  const lockInterface = () => {
    if (!venue?.id) return;
    localStorage.setItem(`snyf_kitchen_locked_${venue.id}`, 'true');
    setIsLockedToKitchen(true);
  };

  const lockWaiterMode = () => {
    if (!venue?.id) return;
    localStorage.setItem(`snyf_waiter_locked_${venue.id}`, 'true');
    setIsWaiterMode(true);
  };

  const unlockInterface = (pinInput: string): boolean => {
    if (pinInput === lockPIN) {
      if (venue?.id) {
        localStorage.setItem(`snyf_kitchen_locked_${venue.id}`, 'false');
        localStorage.setItem(`snyf_waiter_locked_${venue.id}`, 'false');
      }
      setIsLockedToKitchen(false);
      setIsWaiterMode(false);
      setShowUnlockModal(false);
      if (onUnlockSuccess) {
        onUnlockSuccess();
        setOnUnlockSuccess(null);
      }
      return true;
    }
    return false;
  };

  return (
    <LockContext.Provider
      value={{
        isLockedToKitchen,
        isWaiterMode,
        lockPIN,
        setLockPIN,
        lockInterface,
        lockWaiterMode,
        unlockInterface,
        showUnlockModal,
        setShowUnlockModal,
        onUnlockSuccess,
        setOnUnlockSuccess,
      }}
    >
      {children}
    </LockContext.Provider>
  );
}

export const useLock = () => {
  const context = useContext(LockContext);
  if (!context) throw new Error('useLock must be used within LockProvider');
  return context;
};
