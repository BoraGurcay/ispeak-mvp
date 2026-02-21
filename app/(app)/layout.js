"use client";
import { useEffect, useState } from "react";
import NavBar from "../../components/NavBar";
import { supabase } from "../../lib/supabaseClient";

export default function AppLayout({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let ignore = false;

    async function init() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setErrMsg("Missing Supabase config. Copy .env.example to .env.local and fill values.");
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (ignore) return;
      setSession(data.session ?? null);
      setReady(true);
      if (!data.session) window.location.href = "/login";
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) window.location.href = "/login";
    });

    return () => {
      ignore = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">iSpeak</div>
          <div className="muted">Loading…</div>
        </div>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Setup needed</div>
          <div className="muted">{errMsg}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {session ? <NavBar /> : null}
    </>
  );
}
