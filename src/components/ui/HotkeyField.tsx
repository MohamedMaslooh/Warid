// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useRef, useEffect } from "react";
import { Keyboard, XCircle } from "lucide-react";
import { acceleratorFromEvent, formatAccelerator } from "../../lib/hotkey";
import { useLang } from "../../lib/useLang";

interface Props {
  value: string | null;
  onChange: (hk: string | null) => void;
  error?: string | null;
  label?: string | null;
  hint?: string | null;
}

export function HotkeyField({ value, onChange, error, label, hint }: Props) {
  const { t } = useLang();
  const labelText = label === undefined ? t("tpl_hotkey") : label;
  const hintText = hint === undefined ? t("tpl_hk_hint") : hint;
  const [capturing, setCapturing] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setCapturing(false); return; }
      const accel = acceleratorFromEvent(e);
      if (!accel) return;
      onChange(accel);
      setCapturing(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, onChange]);

  const display = formatAccelerator(value);

  return (
    <div className="space-y-1.5">
      {labelText && <label className="section-label">{labelText}</label>}
      <div ref={captureRef} className="flex items-center gap-2">
        {capturing ? (
          <div
            className="input-base flex-1 flex items-center justify-center font-mono text-xs"
            style={{ color: "var(--accent)", borderColor: "var(--accent-border)" }}
          >
            {t("tpl_hk_capture")}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCapturing(true)}
            className="input-base flex-1 flex items-center justify-between text-start hover:border-[var(--accent-border)] transition-colors"
          >
            <span
              className={display ? "font-mono text-sm" : "text-sm"}
              style={{ color: display ? "var(--text)" : "var(--muted)" }}
              dir="ltr"
            >
              {display || t("tpl_hk_click")}
            </span>
            <Keyboard size={16} strokeWidth={1.75} style={{ color: "var(--muted)" }} />
          </button>
        )}
        {value && !capturing && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="transition-colors p-2"
            style={{ color: "var(--muted)", borderRadius: 8 }}
          >
            <XCircle size={20} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
      {hintText && <p className="text-xs" style={{ color: "var(--muted)" }}>{hintText}</p>}
    </div>
  );
}
