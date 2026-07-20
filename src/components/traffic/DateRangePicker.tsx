"use client";
import { useState, useEffect, useRef } from "react";

export type DateRange = { since: string; until: string; label: string };

type Preset = { id: string; label: string };

const PRESETS: Preset[] = [
  { id: "today",      label: "Today"        },
  { id: "yesterday",  label: "Yesterday"    },
  { id: "7d",         label: "Last 7 days"  },
  { id: "14d",        label: "Last 14 days" },
  { id: "30d",        label: "Last 30 days" },
  { id: "90d",        label: "Last 90 days" },
  { id: "this_month", label: "This month"   },
  { id: "last_month", label: "Last month"   },
  { id: "custom",     label: "Custom range" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_HEADS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toYMD(d: Date): string { return d.toISOString().slice(0, 10); }
function fromYMD(s: string): Date { return new Date(s + "T00:00:00"); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

function getPresetRange(id: string): DateRange | null {
  const today = new Date();
  const label = PRESETS.find((p) => p.id === id)?.label ?? id;
  switch (id) {
    case "today":
      return { since: toYMD(today), until: toYMD(today), label };
    case "yesterday": {
      const y = addDays(today, -1);
      return { since: toYMD(y), until: toYMD(y), label };
    }
    case "7d":
      return { since: toYMD(addDays(today, -6)),  until: toYMD(today), label };
    case "14d":
      return { since: toYMD(addDays(today, -13)), until: toYMD(today), label };
    case "30d":
      return { since: toYMD(addDays(today, -29)), until: toYMD(today), label };
    case "90d":
      return { since: toYMD(addDays(today, -89)), until: toYMD(today), label };
    case "this_month":
      return { since: toYMD(startOfMonth(today)), until: toYMD(today), label };
    case "last_month": {
      const end   = addDays(startOfMonth(today), -1);
      const start = startOfMonth(end);
      return { since: toYMD(start), until: toYMD(end), label };
    }
    default: return null;
  }
}

function detectPreset(since: string, until: string): string {
  for (const p of PRESETS) {
    if (p.id === "custom") continue;
    const r = getPresetRange(p.id);
    if (r?.since === since && r?.until === until) return p.id;
  }
  return "custom";
}

function fmtDisplay(ymd: string): string {
  const d = fromYMD(ymd);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function Calendar({
  month, accent, selStart, selEnd, hoverDate,
  onDayClick, onDayHover, onMonthChange,
}: {
  month: Date;
  accent: string;
  selStart: string | null;
  selEnd: string | null;
  hoverDate: string | null;
  onDayClick: (ymd: string) => void;
  onDayHover: (ymd: string | null) => void;
  onMonthChange: (delta: number) => void;
}) {
  const today     = toYMD(new Date());
  const firstDay  = startOfMonth(month);
  const lastDay   = endOfMonth(month);
  const startDow  = firstDay.getDay();
  const daysCount = lastDay.getDate();

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const effectiveEnd = selStart && !selEnd ? hoverDate : selEnd;

  function inRange(ymd: string): boolean {
    if (!selStart || !effectiveEnd) return false;
    const lo = selStart <= effectiveEnd ? selStart : effectiveEnd;
    const hi = selStart <= effectiveEnd ? effectiveEnd : selStart;
    return ymd > lo && ymd < hi;
  }

  return (
    <div style={{ width: 252 }}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(-1)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-base"
          style={{ background: "var(--bg-subtle, #1a1a2e)", color: "var(--text-secondary, #9ca3af)", border: "1px solid var(--border, #2a2a3e)" }}
        >‹</button>
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary, #f1f5f9)" }}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-base"
          style={{ background: "var(--bg-subtle, #1a1a2e)", color: "var(--text-secondary, #9ca3af)", border: "1px solid var(--border, #2a2a3e)" }}
        >›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADS.map((h) => (
          <div key={h} className="text-center text-xs font-medium py-1" style={{ color: "var(--text-faint, #6b7280)" }}>{h}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />;
          const ymd    = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = ymd === today;
          const isSt    = ymd === selStart;
          const isEn    = ymd === (effectiveEnd ?? selStart);
          const isSel   = isSt || isEn;
          const isRange = inRange(ymd);

          let bg    = "transparent";
          let fg    = "var(--text-primary, #f1f5f9)";
          let radii = "6px";

          if (isSel) {
            bg    = accent;
            fg    = "#fff";
            radii = isSt && isEn ? "6px" : isSt ? "6px 0 0 6px" : "0 6px 6px 0";
          } else if (isRange) {
            bg  = accent + "22";
            fg  = accent;
            radii = "0";
          }

          return (
            <button
              key={ymd}
              onClick={() => onDayClick(ymd)}
              onMouseEnter={() => onDayHover(ymd)}
              onMouseLeave={() => onDayHover(null)}
              className="relative h-8 text-xs font-medium flex items-center justify-center"
              style={{ background: bg, color: fg, borderRadius: radii }}
            >
              {isToday && !isSel && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: accent }}
                />
              )}
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DateRangePicker({
  value,
  onChange,
  accentColor = "#6366f1",
  align = "left",
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  accentColor?: string;
  align?: "left" | "right";
}) {
  const [open,      setOpen]      = useState(false);
  const [calMonth,  setCalMonth]  = useState<Date>(() => {
    try { return startOfMonth(fromYMD(value.until)); } catch { return startOfMonth(new Date()); }
  });
  const [selStart,  setSelStart]  = useState<string | null>(null);
  const [selEnd,    setSelEnd]    = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [inCustom,  setInCustom]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePreset = detectPreset(value.since, value.until);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        resetCustom();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function resetCustom() {
    setInCustom(false);
    setSelStart(null);
    setSelEnd(null);
    setHoverDate(null);
  }

  function handlePresetClick(id: string) {
    if (id === "custom") {
      setInCustom(true);
      setSelStart(value.since);
      setSelEnd(value.until);
      try { setCalMonth(startOfMonth(fromYMD(value.until))); } catch { setCalMonth(startOfMonth(new Date())); }
      return;
    }
    const r = getPresetRange(id);
    if (r) { onChange(r); setOpen(false); resetCustom(); }
  }

  function handleDayClick(ymd: string) {
    if (!selStart || (selStart && selEnd)) {
      setSelStart(ymd);
      setSelEnd(null);
    } else {
      if (ymd >= selStart) {
        setSelEnd(ymd);
      } else {
        setSelEnd(selStart);
        setSelStart(ymd);
      }
    }
  }

  function handleApply() {
    if (!selStart) return;
    const since = selStart;
    const until = selEnd ?? selStart;
    const label = since === until
      ? fmtDisplay(since)
      : `${fmtDisplay(since)} – ${fmtDisplay(until)}`;
    onChange({ since, until, label });
    setOpen(false);
    resetCustom();
  }

  function shiftMonth(delta: number) {
    setCalMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  const triggerLabel = value.label || `${fmtDisplay(value.since)} – ${fmtDisplay(value.until)}`;
  const canApply     = inCustom && selStart != null;

  return (
    <div ref={containerRef} className="relative" style={{ userSelect: "none" }}>
      {/* Trigger */}
      <button
        onClick={() => { setOpen((v) => !v); if (!open) resetCustom(); }}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
        style={{
          background: open ? "#1e1e30" : "var(--bg-card, #111118)",
          color:      open ? accentColor : "var(--text-secondary, #9ca3af)",
          border:     `1px solid ${open ? accentColor + "60" : "var(--border, #2a2a3e)"}`,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1 5h10" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span>{triggerLabel}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="pop-in absolute mt-1 z-50 rounded-xl overflow-hidden"
          style={{
            [align === "right" ? "right" : "left"]: 0,
            background: "var(--bg-card, #111118)",
            border:     "1px solid var(--border, #2a2a3e)",
            boxShadow:  "0 8px 32px rgba(0,0,0,0.45)",
            minWidth:   440,
          }}
        >
          <div className="flex">
            {/* Presets panel */}
            <div className="flex-shrink-0 py-3" style={{ width: 160, borderRight: "1px solid var(--border, #2a2a3e)" }}>
              {PRESETS.map((p) => {
                const active = !inCustom && p.id === activePreset;
                const customSel = inCustom && p.id === "custom";
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePresetClick(p.id)}
                    className="w-full text-left text-xs px-4 py-2 font-medium flex items-center justify-between transition-colors"
                    style={{
                      background: (active || customSel) ? accentColor + "18" : "transparent",
                      color:      (active || customSel) ? accentColor : "var(--text-secondary, #9ca3af)",
                    }}
                  >
                    {p.label}
                    {(active || customSel) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar panel */}
            <div className="flex-1 p-4">
              <Calendar
                month={calMonth}
                accent={accentColor}
                selStart={inCustom ? selStart : value.since}
                selEnd={inCustom ? selEnd : value.until}
                hoverDate={inCustom ? hoverDate : null}
                onDayClick={(ymd) => {
                  if (!inCustom) { setInCustom(true); setSelStart(ymd); setSelEnd(null); }
                  else handleDayClick(ymd);
                }}
                onDayHover={(ymd) => { if (inCustom) setHoverDate(ymd); }}
                onMonthChange={shiftMonth}
              />

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border, #2a2a3e)" }}>
                {inCustom ? (
                  <div className="text-xs" style={{ color: "var(--text-faint, #6b7280)" }}>
                    {selStart ? (
                      selEnd ? (
                        <>
                          <span style={{ color: accentColor }}>{fmtDisplay(selStart)}</span>
                          {" → "}
                          <span style={{ color: accentColor }}>{fmtDisplay(selEnd)}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: accentColor }}>{fmtDisplay(selStart)}</span>
                          {" → pick end"}
                        </>
                      )
                    ) : "Click start date"}
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: "var(--text-faint, #6b7280)" }}>
                    {fmtDisplay(value.since)} – {fmtDisplay(value.until)}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {inCustom && (
                    <button
                      onClick={resetCustom}
                      className="text-xs px-3 py-1 rounded-md"
                      style={{ background: "var(--bg-subtle, #1a1a2e)", color: "var(--text-muted, #6b7280)", border: "1px solid var(--border, #2a2a3e)" }}
                    >
                      Cancel
                    </button>
                  )}
                  {inCustom ? (
                    <button
                      onClick={handleApply}
                      disabled={!canApply}
                      className="text-xs px-3 py-1 rounded-md font-medium disabled:opacity-40"
                      style={{ background: accentColor, color: "#fff" }}
                    >
                      Apply
                    </button>
                  ) : (
                    <button
                      onClick={() => setOpen(false)}
                      className="text-xs px-3 py-1 rounded-md"
                      style={{ background: "var(--bg-subtle, #1a1a2e)", color: "var(--text-muted, #6b7280)", border: "1px solid var(--border, #2a2a3e)" }}
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function defaultDateRange(preset = "30d"): DateRange {
  return getPresetRange(preset) ?? getPresetRange("30d")!;
}
