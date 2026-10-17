import React, { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import "./AuthScreen.css";

const logoUrl = new URL("../../assets/logo.svg", import.meta.url).href;

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = window.forgeAI?.onOAuthCallback(async (callbackUrl) => {
      try {
        const callback = new URL(callbackUrl);
        if (callback.protocol !== "forgeai:" || callback.hostname !== "auth" || callback.pathname !== "/callback") {
          throw new Error("Received an invalid Google sign-in callback.");
        }

        const providerError = callback.searchParams.get("error_description") || callback.searchParams.get("error");
        if (providerError) throw new Error(providerError);

        const code = callback.searchParams.get("code");
        if (!code) throw new Error("Google sign-in did not return an authorization code.");

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        setMessage("Google sign-in complete. Loading your workspace…");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Google sign-in could not be completed.");
      } finally {
        setBusy(false);
      }
    });

    return () => unsubscribe?.();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setVerificationSent(false);
    setBusy(true);

    try {
      const normalizedEmail = email.trim();

      if (!normalizedEmail) throw new Error("Please enter your email address.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { display_name: displayName.trim() } },
        });

        if (error) {
          console.error("ForgeAI signup error:", error);
          throw error;
        }

        setMessage("Account created. Check your email and verify your account before signing in.");
        setVerificationSent(true);
        setPassword("");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          console.error("ForgeAI signin error:", error);
          if (error.message === "Email not confirmed") {
            throw new Error("Your email is not verified yet. Open the ForgeAI verification email, then sign in again.");
          }
          throw error;
        }

        console.log("ForgeAI signin successful:", {
          userId: data.user?.id,
          email: data.user?.email,
        });
      }
    } catch (error) {
      console.error("ForgeAI authentication error:", error);
      if (error instanceof Error) {
        setMessage(error.message);
      } else if (typeof error === "object" && error !== null && "message" in error) {
        setMessage(String(error.message));
      } else {
        setMessage("Authentication failed. Check the browser console for details.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("Enter your email address first.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });

      if (error) {
        console.error("ForgeAI verification resend error:", error);
        throw error;
      }

      setMessage("Verification email sent again. Check your inbox and spam folder.");
      setVerificationSent(true);
    } catch (error) {
      console.error("ForgeAI verification resend failed:", error);
      setMessage(error instanceof Error ? error.message : "Could not resend the verification email.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setMessage("");
    setBusy(true);

    try {
      const isDesktop = window.forgeAI?.isDesktop === true;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: isDesktop ? "forgeai://auth/callback" : window.location.origin,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error("ForgeAI Google sign-in error:", error);
        throw error;
      }

      if (!data.url) throw new Error("Supabase did not return a Google authorization URL.");

      if (isDesktop && window.forgeAI) {
        await window.forgeAI.openOAuthUrl(data.url);
      } else {
        window.location.assign(data.url);
      }
    } catch (error) {
      console.error("ForgeAI Google authentication error:", error);
      setMessage(error instanceof Error ? error.message : "Google sign-in failed. Check the browser console for details.");
      setBusy(false);
    }
  }

  function toggleMode() {
    setMode((current) => (current === "signin" ? "signup" : "signin"));
    setMessage("");
    setPassword("");
    setVerificationSent(false);
    setShowPassword(false);
  }

  return (
    <main className="auth-screen">
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />

      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-frame">
            <img src={logoUrl} alt="ForgeAI" className="auth-logo" />
          </div>
          <div>
            <strong>ForgeAI</strong>
            <span>AI SOFTWARE ENGINEER</span>
          </div>
        </div>

        <div className="auth-intro">
          <div className="auth-status"><span />Your engineering workspace</div>
          <h1>{mode === "signin" ? "Build without the busywork." : "Start building with ForgeAI."}</h1>
          <p>
            {mode === "signin"
              ? "Sign in to continue your conversations, preferences and engineering workspace."
              : "Create an account and keep your ForgeAI workspace synced across sessions."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="auth-field">
              <span>Display name</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should ForgeAI call you?" autoComplete="name" />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-password-wrap">
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required />
              <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
            </div>
          </label>

          <button className="auth-primary" type="submit" disabled={busy}>
            <span>{busy ? "Working..." : mode === "signin" ? "Sign in to ForgeAI" : "Create ForgeAI account"}</span>
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <div className="auth-divider"><span>OR CONTINUE WITH</span></div>

        <button className="auth-google" type="button" onClick={handleGoogleSignIn} disabled={busy}>
          <span className="auth-google-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" focusable="false">
              <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/>
              <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.2 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
              <path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18Z"/>
              <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.2 11.4-8.2Z"/>
            </svg>
          </span>
          <span className="auth-google-copy">
            <span className="auth-google-title">Continue with Google</span>
            <span className="auth-google-subtitle">Quick, secure sign-in with your Google account</span>
          </span>
          <span className="auth-google-arrow" aria-hidden="true">→</span>
        </button>

        {message && <p className="auth-message" role="alert">{message}</p>}

        {verificationSent && (
          <button className="auth-resend" type="button" onClick={() => void handleResendVerification()} disabled={busy}>Resend verification email</button>
        )}

        <button className="auth-switch" type="button" onClick={toggleMode}>
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>

        <p className="auth-footer">By continuing, you agree to use ForgeAI responsibly.</p>
      </section>
    </main>
  );
}
