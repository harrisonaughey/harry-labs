type EnvVar = { key: string; hint: string };

type Props = {
  platform: string;
  icon: string;
  color: string;
  description: string;
  vars: EnvVar[];
  docsUrl: string;
  consoleUrl?: string;
  consoleLabel?: string;
};

export default function ConnectPrompt({ platform, icon, color, description, vars, docsUrl, consoleUrl, consoleLabel }: Props) {
  return (
    <div className="flex items-start justify-center pt-8">
      <div className="w-full max-w-lg rounded-2xl p-8" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        {/* Icon */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: `${color}20`, border: `1px solid ${color}40` }}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Connect {platform}</h2>
            <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>{description}</p>
          </div>
        </div>

        {/* Env vars */}
        <div className="space-y-2 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>
            Required Environment Variables
          </p>
          {vars.map((v) => (
            <div
              key={v.key}
              className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}
            >
              <span className="text-xs font-mono" style={{ color: "#6b7280" }}>{v.hint}</span>
              <span className="text-xs font-mono font-medium" style={{ color: "#a5b4fc" }}>{v.key}</span>
            </div>
          ))}
        </div>

        <p className="text-xs mb-5" style={{ color: "#4b5563" }}>
          Add these keys to your Vercel environment variables, then redeploy.
        </p>

        <div className="flex gap-3">
          {consoleUrl && (
            <a
              href={consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm py-2.5 px-4 rounded-lg font-medium text-center transition-opacity hover:opacity-80"
              style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
            >
              {consoleLabel ?? "Open Console →"}
            </a>
          )}
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-sm py-2.5 px-4 rounded-lg text-center transition-opacity hover:opacity-80"
            style={{ background: "#1a1a24", color: "#9ca3af", border: "1px solid #2a2a3a" }}
          >
            API Docs →
          </a>
        </div>
      </div>
    </div>
  );
}
