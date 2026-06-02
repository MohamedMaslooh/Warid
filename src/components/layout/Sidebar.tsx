import {
  Mic,
  History,
  LayoutTemplate,
  Settings,
  Terminal,
  BarChart2,
  Upload,
} from "lucide-react";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLang } from "../../lib/useLang";
import type { LangKey } from "../../lib/i18n";

const ALL_NAV_ITEMS: Array<{ to: string; icon: React.ElementType; key: LangKey; logsOnly: boolean }> = [
  { to: "/",          icon: Mic,           key: "nav_record",    logsOnly: false },
  { to: "/upload",    icon: Upload,        key: "nav_upload",    logsOnly: false },
  { to: "/history",   icon: History,       key: "nav_history",   logsOnly: false },
  { to: "/templates", icon: LayoutTemplate,key: "nav_templates", logsOnly: false },
  { to: "/analytics", icon: BarChart2,     key: "nav_analytics", logsOnly: false },
  { to: "/logs",      icon: Terminal,      key: "nav_logs",      logsOnly: true  },
];

export function Sidebar() {
  const { settings } = useSettingsStore();
  const { t } = useLang();
  const navItems = ALL_NAV_ITEMS.filter((item) => !item.logsOnly || settings.logsEnabled);
  return (
    <aside
      className="w-16 flex flex-col items-center py-4 shrink-0 z-20 backdrop-blur-xl"
      style={{
        background: "var(--surface)",
        borderInlineStart: "1px solid var(--border)",
      }}
    >
      <TooltipLink to="/" label={t("app_name")} className="mb-6" end>
        <div
          className="w-10 h-10 flex items-center justify-center text-white font-extrabold text-lg"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
            borderRadius: 12,
            boxShadow: "var(--shadow-accent)",
            fontFamily: '"Inter", sans-serif',
          }}
        >
          W
        </div>
      </TooltipLink>

      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(({ to, icon: Icon, key: navKey }) => (
          <TooltipLink key={to} to={to} label={t(navKey)} navIcon end={to === "/"}>
            <Icon size={20} strokeWidth={1.75} />
          </TooltipLink>
        ))}
      </nav>

      <TooltipLink to="/settings" label={t("nav_settings")} navIcon>
        <Settings size={20} strokeWidth={1.75} />
      </TooltipLink>
    </aside>
  );
}

function TooltipLink({
  to,
  label,
  children,
  navIcon = false,
  end = false,
  className = "",
}: {
  to: string;
  label: string;
  children: React.ReactNode;
  navIcon?: boolean;
  end?: boolean;
  className?: string;
}) {
  const { isRTL } = useLang();
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Sidebar is on the inline-start edge of content; place tooltip toward content.
    setPos({
      x: isRTL ? r.left - 10 : r.right + 10,
      y: r.top + r.height / 2,
    });
  }

  return (
    <NavLink
      ref={ref}
      to={to}
      end={end}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      className={({ isActive }) =>
        `${navIcon ? `nav-icon${isActive ? " active" : ""}` : "relative"} ${className}`.trim()
      }
    >
      {children}
      {pos && createPortal(
        <div
          role="tooltip"
          dir={isRTL ? "rtl" : "ltr"}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: `translateY(-50%) ${isRTL ? "translateX(-100%)" : ""}`,
            zIndex: 9999,
            pointerEvents: "none",
            padding: "7px 12px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--surface) 82%, transparent)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            border: "1px solid var(--accent-border)",
            boxShadow:
              "0 12px 32px -8px rgba(0,0,0,.55), 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
            color: "var(--text)",
            fontSize: 12.5,
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            fontFamily: '"Inter", system-ui, sans-serif',
          }}
        >
          {label}
        </div>,
        document.body,
      )}
    </NavLink>
  );
}
