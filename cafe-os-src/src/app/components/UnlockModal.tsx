import { useState, useEffect } from 'react';
import { useLock } from '../../context/LockContext';
import { X, Delete, ShieldAlert } from 'lucide-react';

export function UnlockModal() {
  const { showUnlockModal, setShowUnlockModal, unlockInterface, onUnlockSuccess } = useLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (showUnlockModal) {
      setPin('');
      setError(false);
    }
  }, [showUnlockModal]);

  if (!showUnlockModal) return null;

  const handleKeyPress = (num: string) => {
    setError(false);
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        setTimeout(() => {
          const success = unlockInterface(nextPin);
          if (!success) {
            setError(true);
            setPin('');
          }
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    setError(false);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(false);
    setPin('');
  };

  return (
    <div 
      className="fixed inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-[9999] select-none p-4 animate-fadeIn"
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 2;
        }
      `}</style>

      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl relative space-y-6">
        
        {onUnlockSuccess && (
          <button 
            onClick={() => setShowUnlockModal(false)}
            className="absolute top-4 right-4 p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-1">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Parental Lock Active</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            This device is restricted to Kitchen View. Enter the admin lock PIN to access Snyf Cafe OS.
          </p>
        </div>

        <div className={`flex justify-center gap-4 py-2 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => (
            <div 
              key={idx}
              className={`w-4 h-4 rounded-full border transition-all duration-150 ${
                idx < pin.length 
                  ? 'bg-primary border-primary scale-110' 
                  : error 
                    ? 'border-destructive bg-destructive/15' 
                    : 'border-border bg-input-background'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-[11px] font-semibold text-destructive text-center mt-[-8px]">
            Incorrect PIN. Try again.
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 justify-items-center max-w-[280px] mx-auto pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="w-16 h-16 rounded-full bg-accent hover:bg-accent/70 active:scale-95 transition-all flex items-center justify-center font-semibold text-lg text-foreground cursor-pointer"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={handleClear}
            className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
          >
            Clear
          </button>

          <button
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-full bg-accent hover:bg-accent/70 active:scale-95 transition-all flex items-center justify-center font-semibold text-lg text-foreground cursor-pointer"
          >
            0
          </button>

          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
