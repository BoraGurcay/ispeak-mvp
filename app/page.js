"use client";

import Image from "next/image";
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
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Image
            src="/brand/logo.png"
            alt="iSpeak"
            width={140}
            height={140}
            priority
          />
        </div>

        <div className="h1">iSpeak</div>
        <div className="muted" style={{ marginTop: 6 }}>
          {msg}
        </div>
      </div>
    </div>
  );
}