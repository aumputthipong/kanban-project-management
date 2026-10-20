import { useEffect, useRef } from "react";

// Only the most recently opened layer handles Esc, so a confirm on top of a modal closes alone.
const layers: { current: () => void }[] = [];

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") layers[layers.length - 1]?.current();
}

export function useEscapeKey(
  active: boolean,
  onEscape: () => void,
): void {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    layers.push(latest);
    if (layers.length === 1) window.addEventListener("keydown", handleKeyDown);
    return () => {
      layers.splice(layers.indexOf(latest), 1);
      if (layers.length === 0) window.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);
}
