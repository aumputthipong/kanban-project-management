"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useToastStore } from "@/store/useToastStore";

// Hydration-safe client check — a bare `typeof window` renders differently per side.
const subscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,   // client snapshot
    () => false,  // server snapshot
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const isClient = useIsClient();

  // createPortal needs document.body; render nothing until hydrated.
  if (!isClient) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 inset-x-4 z-10000 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto max-w-md flex items-center gap-3 px-4 py-2.5 bg-slate-900 text-white rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2"
        >
          <span>{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
              className="shrink-0 whitespace-nowrap px-2 py-0.5 text-blue-300 hover:text-blue-200 font-semibold cursor-pointer"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
