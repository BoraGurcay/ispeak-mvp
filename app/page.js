"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Index() {
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        const { data } = await supabase.auth.getSession();
        if (ignore) return;

        if (data.session) {
          window.location.href = "/home";
        } else {
          window.location.href = "/login";
        }
      } catch (e) {
        // Don't show misleading "missing config" message.
        setMsg("Session check skipped.");
        window.location.href = "/login";
      }
    }

    run();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">iSpeak</div>
        <div className="muted">{msg}</div>
      </div>
    </div>
  );
}