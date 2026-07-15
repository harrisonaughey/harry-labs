"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function TwoFactorSetup() {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function enroll() {
      const supabase = createClient();

      // Clean up any existing unverified TOTP factors first
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const unverified = existing?.totp?.filter((f: { status: string }) => f.status === "unverified") ?? [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error || !data) {
        setError(error?.message ?? "Failed to start 2FA setup");
        setEnrolling(false);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrolling(false);
    }
    enroll();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

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
        maxWidth: 440,
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
          <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>Two-factor authentication setup</p>
        </div>
      </div>

      <h1 style={{ color: "#f0f0ff", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
        Set up 2FA
      </h1>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 24px", lineHeight: "1.5" }}>
        Scan the QR code below with Google Authenticator, Authy, or any TOTP app. Then enter
        the 6-digit code to complete setup.
      </p>

      {enrolling ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading…</div>
      ) : (
        <>
          {/* QR Code */}
          {qrCode && (
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 16,
                display: "inline-block",
                marginBottom: 20,
              }}
            >
              <img
                src={qrCode}
                alt="Scan with authenticator app"
                style={{ width: 160, height: 160, display: "block" }}
              />
            </div>
          )}

          {/* Manual secret */}
          {secret && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 6px" }}>
                Can't scan? Enter this code manually:
              </p>
              <code
                style={{
                  display: "block",
                  background: "#0d0d14",
                  border: "1px solid #2d2d3d",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#a5b4fc",
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  wordBreak: "break-all",
                }}
              >
                {secret}
              </code>
            </div>
          )}

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
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#0d0d14",
                  border: "1px solid #2d2d3d",
                  borderRadius: 8,
                  color: "#f0f0ff",
                  fontSize: 20,
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
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
              {loading ? "Verifying…" : "Enable 2FA →"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
