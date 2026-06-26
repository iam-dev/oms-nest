"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_URL } from "@/services/api-config";

// FE-030: metadata cannot be exported from a "use client" module in the App Router.
// Set the no-referrer policy via an inline <meta> element rendered inside the form
// so the hash token is not leaked in the Referer header to third-party origins.

function PasswordChangeForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hash = searchParams.get("hash") || "";
  const expires = searchParams.get("expires");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // FE-030: remove the `hash` query param from the URL on mount so it is not
  // retained in browser history or shared via copy-paste.
  useEffect(() => {
    if (hash) {
      router.replace("/password-change");
    }
    // We only want to run this once on mount; router is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FE-029: The isExpired check is cosmetic only — it provides a faster
  // UX signal to the user, but the backend performs the authoritative
  // hash validation.  A manipulated `expires` param will be rejected
  // server-side regardless of what this client-side guard says.
  const isExpired = expires ? Date.now() > Number(expires) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // FE-028: minimum password length raised to 12
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.errors?.hash === "invalidHash"
            ? "This link is invalid or has expired."
            : "Failed to reset password. Please try again."
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (isExpired) {
    return (
      <div style={{ color: "#dc2626", textAlign: "center", marginTop: 16 }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Link Expired</p>
        <p style={{ fontSize: 14, marginTop: 8 }}>
          This password reset link has expired. Please contact your administrator.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: "#16a34a" }}>
          Password set successfully!
        </p>
        <p style={{ fontSize: 14, marginTop: 8, color: "#e0e0e0" }}>
          You can now log in with your new password.
        </p>
        <button
          onClick={() => router.push("/login")}
          style={{
            marginTop: 20,
            padding: "10px 32px",
            background: "#7b2326",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16, width: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="password"
          style={{ display: "block", marginBottom: 6, color: "#e0e0e0", fontSize: 14 }}
        >
          New Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 4,
            border: "1px solid #999",
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        {/* FE-028: complexity hint — no external libraries */}
        <p style={{ fontSize: 12, color: "#c0c0c0", marginTop: 4 }}>
          At least 12 characters. Use a mix of letters, numbers, and symbols for a stronger password.
        </p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="confirmPassword"
          style={{ display: "block", marginBottom: 6, color: "#e0e0e0", fontSize: 14 }}
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={12}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 4,
            border: "1px solid #999",
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
      </div>
      {error && (
        <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          background: loading ? "#999" : "#7b2326",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {loading ? "Setting Password..." : "Set Password"}
      </button>
    </form>
  );
}

export default function PasswordChangePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: `url('/login-bg.jpg') center center / cover no-repeat fixed`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* FE-030: prevent the reset hash from leaking in the Referer header */}
      <meta name="referrer" content="no-referrer" />
      <div
        style={{
          background: "#757575",
          borderRadius: 8,
          boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
          padding: 32,
          minWidth: 350,
          maxWidth: "90vw",
          border: "5px solid #7b2326",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-with-text.png"
          alt="Custom Saddlery"
          style={{ width: 120, margin: "0 auto" }}
        />
        <h2
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: 600,
            marginTop: 16,
            marginBottom: 0,
          }}
        >
          Set Your Password
        </h2>
        <Suspense fallback={<div style={{ color: "#e0e0e0" }}>Loading...</div>}>
          <PasswordChangeForm />
        </Suspense>
      </div>
    </div>
  );
}
