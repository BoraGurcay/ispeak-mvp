"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Index() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        const { data } = await supabase.auth.getSession();
        if (ignore) return;

        if (data?.session) {
          window.location.href = "/home";
          return;
        }

        // Not logged in -> show landing
        setChecking(false);
      } catch (e) {
        // If anything fails, just show landing (don't block users)
        setChecking(false);
      }
    }

    run();
    return () => {
      ignore = true;
    };
  }, []);

  // While checking session (fast)
  if (checking) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">iSpeak</div>
          <div className="muted">Loading…</div>
        </div>
      </div>
    );
  }

  // Public landing page
  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="card">
        <div className="h1" style={{ fontSize: 40, lineHeight: 1.1 }}>
          iSpeak
        </div>

        <div className="muted" style={{ marginTop: 6, fontSize: 16 }}>
          Professional interpreter practice platform
        </div>

        <div className="small muted" style={{ marginTop: 10 }}>
          Train terminology • Build glossaries • Improve speed &amp; accuracy
        </div>

        <div className="hr" />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btnPrimary" href="/login">
            Log in
          </Link>
          <Link className="btn" href="/signup">
            Sign up
          </Link>
          <Link className="btn" href="/practice">
            Try Practice
          </Link>
          <Link className="btn" href="/play">
            Try Play
          </Link>
        </div>

        <div className="hr" />

        <div className="col" style={{ gap: 10 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }}>Practice</div>
            <div className="small muted">
              Self-paced training with forgiving answers and sound feedback.
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }}>Play</div>
            <div className="small muted">
              Timed rapid-fire mode to build speed under pressure.
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800 }}>Glossary</div>
            <div className="small muted">
              Browse by domain (court / immigration / family) and build your own.
            </div>
          </div>
        </div>

        <div className="hr" />

        <div className="small muted">
          Tip: You can install iSpeak Training on mobile/desktop for an app-like experience.
        </div>
      </div>
    </div>
  );
}