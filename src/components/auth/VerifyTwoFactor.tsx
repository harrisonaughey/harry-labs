"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function VerifyTwoFactor() {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function startChallenge() {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];

      if (!totp) {
        // No factor enrolled — send to setup
        router.replace("/login/setup-2fa");
        return;
      }

      setFactorId(totp.id);
      const { data, error } = await supabase.auth.mfa.challenge({ factorId: totp.id });

      if (error || !data) {
        setError(error?.message ?? "Failed to start verification");
        setInitialising(false);
        return;
      }

      setChallengeId(data.id);
      setInitialising(false);
    }
    startChallenge();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid #1e1e2e",
        borderRadius: 16,
        padding: 40,
        width: "100%",
        maxWidth: 420,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "white",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          H
        </div>
        <div>
          <p style={{ color: "#f0f0ff", fontWeight: 600, fontSize: 15, margin: 0 }}>Harry Labs</p>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>Two-factor authentication</p>
        </div>
      </div>

      <h1 style={{ color: "#f0f0ff", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
        Enter your 2FA code
      </h1>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 28px", lineHeight: "1.5" }}>
        Open your authenticator app and enter the 6-digit code.
      </p>

      {initialising ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading…</div>
      ) : (
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div
              style={{
                background: "#2d1515",
                border: "1px solid #7f1d1d",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#fca5a5",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="code"
              style={{ display: "block", color: "#9ca3af", fontSize: 13, fontWeight: 500, marginBottom: 6 }}
            >
              Authentication code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
              style={{
                width: "100%",
                padding: "14px",
                background: "#0d0d14",
                border: "1px solid #2d2d3d",
                borderRadius: 8,
                color: "#f0f0ff",
                fontSize: 24,
                letterSpacing: "0.4em",
                textAlign: "center",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6 || !challengeId}
            style={{
              width: "100%",
              padding: "12px",
              background: "#6366f1",
              border: "none",
              borderRadius: 8,
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || code.length !== 6 ? "not-allowed" : "pointer",
              opacity: loading || code.length !== 6 ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "Verifying…" : "Verify and sign in →"}
          </button>

          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push("/login");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#6b7280",
              fontSize: 13,
              cursor: "pointer",
              padding: "4px 0",
              textAlign: "center",
            }}
          >
            ← Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
