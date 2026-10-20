"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, LogOut } from "lucide-react";
import { API_URL } from "@/lib/constants";
import { getAvatarColor } from "@/utils/avatar";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface UserMe {
  user_id: string;
  email: string;
  full_name: string;
}

interface UserMenuProps {
  fallbackEmail: string;
}

export function UserMenu({ fallbackEmail }: UserMenuProps) {
  const router = useRouter();
  const [me, setMe] = useState<UserMe | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setMe(data);
      })
      .catch(() => {
        // Best-effort: falls back to fallbackEmail.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEscapeKey(open, () => setOpen(false));

  const displayName = me?.full_name?.trim() || fallbackEmail;
  const email = me?.email ?? fallbackEmail;
  const initial = displayName.charAt(0).toUpperCase();
  const avatarColor = me?.user_id ? getAvatarColor(me.user_id) : "bg-slate-400";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="cursor-pointer flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-md hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className={`w-6 h-6 rounded-full grid place-items-center text-white text-xs font-semibold shrink-0 ${avatarColor}`}>
          {initial}
        </span>
        <span className="hidden md:inline text-sm font-medium text-slate-900 max-w-45 truncate">
          {displayName}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50"
        >
          <div className="flex items-center gap-2.5 px-3 py-3 border-b border-slate-200">
            <span className={`w-8 h-8 rounded-full grid place-items-center text-white text-sm font-semibold shrink-0 ${avatarColor}`}>
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-600 truncate">{email}</p>
            </div>
          </div>
          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={loggingOut}
              className="cursor-pointer w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium text-danger hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {loggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
