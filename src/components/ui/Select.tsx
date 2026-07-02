// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  dir?: "rtl" | "ltr";
  className?: string;
  /** Optional formatter — render selected label differently from list label. */
  renderSelected?: (opt: SelectOption | undefined) => React.ReactNode;
}

/**
 * Design-system Select. Replaces native <select> everywhere so the dropdown
 * popup matches the app's theme (orange accent, glass surfaces, rounded
 * corners, light + dark). Positioned via fixed coords so it can escape
 * `overflow: hidden` ancestors.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "اختر…",
  disabled = false,
  dir,
  className = "",
  renderSelected,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    placeAbove: boolean;
  } | null>(null);

  const selected = options.find((o) => o.value === value);

  // Position popover dynamically under or above the trigger and recompute on scroll/resize.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      // If space below is less than 190px (popover max-height of 180px + margin)
      // and space above is larger, place it above.
      const placeAbove = spaceBelow < 190 && spaceAbove > spaceBelow;

      if (placeAbove) {
        setPos({
          bottom: window.innerHeight - r.top + 6,
          left: r.left,
          width: r.width,
          placeAbove: true,
        });
      } else {
        setPos({
          top: r.bottom + 6,
          left: r.left,
          width: r.width,
          placeAbove: false,
        });
      }
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(options.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIdx >= 0) {
          onChange(options[activeIdx].value);
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, activeIdx, onChange]);

  // Reset active index when opening.
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setActiveIdx(idx);
    }
  }, [open, value, options]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        dir={dir}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`select-trigger ${className}`}
      >
        <span className="truncate" style={{ color: selected ? "var(--text)" : "var(--muted)" }}>
          {renderSelected ? renderSelected(selected) : selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} strokeWidth={1.75} className="chev" />
      </button>

      {open && pos && (
        <div
          ref={popoverRef}
          role="listbox"
          dir={dir}
          className="select-popover fixed"
          style={{
            top: pos.placeAbove ? "auto" : pos.top,
            bottom: pos.placeAbove ? pos.bottom : "auto",
            left: pos.left,
            width: pos.width,
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === activeIdx;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected || undefined}
                data-active={isActive || undefined}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="select-option"
                dir={dir}
              >
                <span className="flex flex-col items-start min-w-0">
                  <span className="truncate w-full">{opt.label}</span>
                  {opt.hint && (
                    <span className="text-xs font-mono truncate w-full" style={{ color: "var(--muted)" }}>
                      {opt.hint}
                    </span>
                  )}
                </span>
                {isSelected && <Check size={14} strokeWidth={2.25} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
