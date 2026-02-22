"use client";

import { useEffect, useState } from "react";
import NavBar from "../../components/NavBar";
import { supabase } from "../../lib/supabaseClient";

export default function AppLayout({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (ignore) return;

      setSession(data.session ?? null);
      setReady(true);

      if (!data.session) {
        window.location.href = "/login";
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, newSession) => {
      setSession(newSession);
      if (!newSession) window.location.href = "/login";
    });

    return () => {
      ignore = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      {children}
      {session && <NavBar />}
    </>
  );
}