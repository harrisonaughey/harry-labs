"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message ?? "Invalid credentials");
      setLoading(false);
      return;
    }

    // Fetch profile to check role and active status
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", authData.user.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      setError("Account not found. Contact your administrator.");
      setLoading(false);
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setError("Account is inactive. Contact your administrator.");
      setLoading(false);
      return;
    }

    // Store role in user_metadata for fast middleware access
    await supabase.auth.updateUser({ data: { role: profile.role } });

    // Testers skip 2FA — direct to dashboard
    if (profile.role === "tester") {
      router.push("/");
      router.refresh();
      return;
    }

    // Check whether 2FA is already enrolled for admin / viewer
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasTotp = (factors?.totp?.length ?? 0) > 0;

    if (!hasTotp) {
      router.push("/login/setup-2fa");
    } else {
      router.push("/login/verify-2fa");
    }
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
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
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
          <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>Ecommerce Dashboard</p>
        </div>
      </div>

      <h1 style={{ color: "#f0f0ff", fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
        Sign in
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 28px" }}>
        Enter your credentials to continue
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            htmlFor="email"
            style={{ display: "block", color: "#9ca3af", fontSize: 13, fontWeight: 500, marginBottom: 6 }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@company.com"
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#0d0d14",
              border: "1px solid #2d2d3d",
              borderRadius: 8,
              color: "#f0f0ff",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            style={{ display: "block", color: "#9ca3af", fontSize: 13, fontWeight: 500, marginBottom: 6 }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#0d0d14",
              border: "1px solid #2d2d3d",
              borderRadius: 8,
              color: "#f0f0ff",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: "#6366f1",
            border: "none",
            borderRadius: 8,
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.65 : 1,
            marginTop: 4,
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "#4b5563" }}>
        Contact your administrator to request access
      </p>
    </div>
  );
}
