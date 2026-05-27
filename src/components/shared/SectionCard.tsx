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
      style={{ background: "#111118", border: "1px solid #1e1e2e" }}
    >
      {(title || action) && (
        <div className={`flex items-center justify-between ${noPad ? "px-5 py-4" : "mb-5"}`}
          style={noPad ? { borderBottom: "1px solid #1e1e2e" } : undefined}>
          <div>
            {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {noPad ? <div>{children}</div> : children}
    </div>
  );
}
