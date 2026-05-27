type Props = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
};

export default function SectionCard({ title, subtitle, action, children, className = "", noPad }: Props) {
  return (
    <div
      className={`rounded-xl ${noPad ? "" : "p-5"} ${className}`}
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {(title || action) && (
        <div className={`flex items-center justify-between ${noPad ? "px-5 py-4" : "mb-5"}`}
          style={noPad ? { borderBottom: "1px solid var(--border)" } : undefined}>
          <div>
            {title && <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {noPad ? <div>{children}</div> : children}
    </div>
  );
}
