"use client";

import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

function getURL() {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ||
    process?.env?.NEXT_PUBLIC_VERCEL_URL ||
    "http://localhost:3000";

  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  if (!url.endsWith("/")) {
    url = `${url}/`;
  }

  return url;
}

export default function Login() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const canSubmit = useMemo(
    () => email.includes("@") && password.length >= 6,
    [email, password]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Working…");

    try {
      let response;

      if (mode === "signup") {
        response = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${getURL()}home`,
          },
        });
      } else {
        response = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      const { data, error } = response;

      if (error) {
        setStatus(error.message);
        return;
      }

      if (mode === "signup" && !data.session) {
        setStatus("Check your email to confirm your account.");
        return;
      }

      window.location.href = "/home";
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Something went wrong.");
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">iSpeak</div>

        <div className="muted" style={{ marginBottom: 12 }}>
          Interpreter Terminology Training
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          <button
            className={"btn " + (mode === "login" ? "btnPrimary" : "")}
            onClick={() => setMode("login")}
            type="button"
          >
            Log in
          </button>

          <button
            className={"btn " + (mode === "signup" ? "btnPrimary" : "")}
            onClick={() => setMode("signup")}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="col">
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="input"
            placeholder="Password (min 6 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn btnPrimary" disabled={!canSubmit}>
            Continue
          </button>

          {status && <div className="small muted">{status}</div>}
        </form>

        <div className="hr" />

        <div className="small muted">
          Tip: Enable “Add to Home Screen” after deployment for an app-like feel.
        </div>
      </div>
    </div>
  );
}