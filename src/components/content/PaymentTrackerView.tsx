"use client";
import { useState, useEffect, useCallback } from "react";

type PaymentStatus = "paid" | "due" | "pending_revision" | "pending_submission";

interface PaymentEntry {
  id: string;
  creator: string;
  brief: string;
  video_ids: string[];
  payment_status: PaymentStatus;
  payment_date: string | null;
  amount: number | null;
  notes: string | null;
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  paid:             { label: "Paid",            color: "#10b981", bg: "#10b98115" },
  due:              { label: "Payment Due",      color: "#f59e0b", bg: "#f59e0b15" },
  pending_revision: { label: "Pending Revision", color: "#6b7280", bg: "#6b728015" },
  pending_submission:{ label: "Not Submitted",   color: "#6b7280", bg: "#6b728015" },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_submission;
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function CreatorSummary({ creator, entries, getAmount }: {
  creator: string;
  entries: PaymentEntry[];
  getAmount: (e: PaymentEntry) => number;
}) {
  const paid    = entries.filter(e => e.payment_status === "paid").length;
  const due     = entries.filter(e => e.payment_status === "due").length;
  const pending = entries.filter(e => e.payment_status === "pending_revision" || e.payment_status === "pending_submission").length;
  const total   = entries.length;
  const pct     = total > 0 ? Math.round((paid / total) * 100) : 0;

  const amountDue  = entries.filter(e => e.payment_status === "due").reduce((s, e) => s + getAmount(e), 0);
  const amountPaid = entries.filter(e => e.payment_status === "paid").reduce((s, e) => s + getAmount(e), 0);

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Creator</p>
          <h3 className="text-base font-semibold capitalize" style={{ color: "var(--text-primary)" }}>{creator}</h3>
        </div>
        {due > 0 ? (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "#f59e0b20", color: "#f59e0b" }}>
            {due} due
          </span>
        ) : (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "#10b98120", color: "#10b981" }}>
            Up to date ✓
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full mb-3" style={{ background: "var(--border)" }}>
        <div className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: due > 0 ? "#f59e0b" : "#10b981" }} />
      </div>

      <div className="flex gap-4 text-sm">
        <div>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{paid}</span>
          <span className="ml-1" style={{ color: "var(--text-muted)" }}>paid</span>
        </div>
        {due > 0 && (
          <div>
            <span className="font-semibold" style={{ color: "#f59e0b" }}>{due}</span>
            <span className="ml-1" style={{ color: "var(--text-muted)" }}>due</span>
          </div>
        )}
        {pending > 0 && (
          <div>
            <span className="font-semibold" style={{ color: "var(--text-muted)" }}>{pending}</span>
            <span className="ml-1" style={{ color: "var(--text-muted)" }}>pending</span>
          </div>
        )}
        <div className="ml-auto text-xs" style={{ color: "var(--text-faint)" }}>
          {paid}/{total} briefs
        </div>
      </div>

      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          ${amountPaid} paid total
        </span>
        {amountDue > 0 ? (
          <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>
            ${amountDue} USD owed
          </span>
        ) : (
          <span className="text-sm font-semibold" style={{ color: "#10b981" }}>$0 owed</span>
        )}
      </div>
    </div>
  );
}

export default function PaymentTrackerView() {
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "jenne" | "nick">("all");

  const entryAmount = (e: PaymentEntry) => {
    if (e.amount !== null) return e.amount;
    const rate = rates[e.creator] ?? 10;
    return e.video_ids.length * rate;
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/payments");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setRates(data.rates ?? {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (id: string) => {
    setMarking(id);
    try {
      const today = new Date().toISOString().split("T")[0];
      await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, payment_status: "paid", payment_date: today }),
      });
      setEntries(prev =>
        prev.map(e => e.id === id ? { ...e, payment_status: "paid", payment_date: today } : e)
      );
    } finally {
      setMarking(null);
    }
  };

  const jenneEntries = entries.filter(e => e.creator === "jenne");
  const nickEntries  = entries.filter(e => e.creator === "nick");
  const dueEntries   = entries.filter(e => e.payment_status === "due");
  const totalDue     = dueEntries.reduce((s, e) => s + entryAmount(e), 0);

  const visibleEntries = filter === "all" ? entries
    : filter === "jenne" ? jenneEntries
    : nickEntries;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: "var(--text-muted)" }}>
        Loading payment data…
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Action banner — only when payments are due */}
      {dueEntries.length > 0 && (
        <div className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: "#f59e0b10", border: "1px solid #f59e0b30" }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">💰</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
                {dueEntries.length} video{dueEntries.length !== 1 ? "s" : ""} awaiting payment
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {dueEntries.map(e => `${e.creator === "jenne" ? "Jenne" : "Nick"} ${e.brief}`).join(" · ")}
              </p>
              <p className="text-xs mt-1 font-semibold" style={{ color: "#f59e0b" }}>
                ${totalDue} USD total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Creator summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <CreatorSummary creator="jenne" entries={jenneEntries} getAmount={entryAmount} />
        <CreatorSummary creator="nick"  entries={nickEntries}  getAmount={entryAmount} />
      </div>

      {/* Filter + table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Payment Ledger</h3>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-card-inner)" }}>
            {(["all", "jenne", "nick"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="text-xs px-3 py-1 rounded-md capitalize transition-all"
                style={{
                  background: filter === f ? "#6366f120" : "transparent",
                  color:      filter === f ? "#a5b4fc"   : "var(--text-muted)",
                }}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {visibleEntries.map((entry, i) => {
            const isDue = entry.payment_status === "due";
            return (
              <div key={entry.id}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                style={{
                  background: isDue ? "#f59e0b05" : i % 2 === 0 ? "transparent" : "var(--bg-card-inner)10",
                }}>

                {/* Video number */}
                <span className="text-xs w-5 text-right flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                  {i + 1}
                </span>

                {/* Creator */}
                <span className="text-xs font-medium w-10 flex-shrink-0 capitalize"
                  style={{ color: entry.creator === "jenne" ? "#a5b4fc" : "#34d399" }}>
                  {entry.creator === "jenne" ? "J" : "N"}
                </span>

                {/* Brief */}
                <span className="text-sm font-medium w-24 flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                  {entry.brief}
                </span>

                {/* Video count */}
                {entry.video_ids.length > 0 ? (
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {entry.video_ids.length} clip{entry.video_ids.length !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>—</span>
                )}

                {/* Notes */}
                {entry.notes && (
                  <span className="text-xs flex-1 truncate" style={{ color: "var(--text-muted)" }}>
                    {entry.notes}
                  </span>
                )}
                {!entry.notes && <span className="flex-1" />}

                {/* Amount */}
                <span className="text-xs font-medium w-12 text-right flex-shrink-0"
                  style={{ color: isDue ? "#f59e0b" : "var(--text-muted)" }}>
                  ${entryAmount(entry)}
                </span>

                {/* Payment date */}
                {entry.payment_date && (
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                    {entry.payment_date}
                  </span>
                )}

                {/* Status badge */}
                <div className="flex-shrink-0">
                  <StatusBadge status={entry.payment_status} />
                </div>

                {/* Mark paid button */}
                {isDue ? (
                  <button onClick={() => markPaid(entry.id)}
                    disabled={marking === entry.id}
                    className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98130" }}>
                    {marking === entry.id ? "Saving…" : "Mark Paid"}
                  </button>
                ) : (
                  <div className="flex-shrink-0 w-24" />
                )}
              </div>
            );
          })}
        </div>

        {visibleEntries.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No entries
          </div>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        Rate: $10 USD per video. Payment is triggered when a video reaches GREEN LIGHT in the audit — pending revision = awaiting audit pass before payment is owed.
      </p>
    </div>
  );
}
