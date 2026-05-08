"use client";

export default function UpgradeModal({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#090f0b] border border-[#1a3320] rounded p-5 text-[#c8e8d0]">
        <div className="flex justify-between items-center">
        <h2 className="text-[#00ff88] tracking-[3px] text-xs">PRO ACCESS</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <p className="mt-3 text-sm text-[#7aaa8a]">Full Oracle analysis, Polymarket-style betting, and email alerts.</p>
        <div className="mt-4 text-3xl text-[#00ff88] font-bold">$7 / month</div>
        <button onClick={onUpgrade} className="mt-4 w-full border border-[#00bb66] text-[#00ff88] py-2 font-bold tracking-[2px]">
          ACTIVATE SUBSCRIPTION
        </button>
      </div>
    </div>
  );
}
