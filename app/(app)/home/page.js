"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "../../../lib/auth";

export default function Home() {
  return (
    <div className="container">
      <div className="card" style={{ textAlign: "center" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Image
            src="/brand/logo.png"
            alt="iSpeak"
            width={160}
            height={160}
            priority
          />
        </div>

        <div className="h1">iSpeak</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Professional interpreter practice platform
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Train terminology • Build glossaries • Improve speed & accuracy
        </div>

        <div className="hr" />

        <div className="col" style={{ gap: 10 }}>
          <Link className="btn btnPrimary" href="/practice">
            Start Practice
          </Link>
          <Link className="btn" href="/play">
            Play (Timed)
          </Link>
          <Link className="btn" href="/glossary">
            Open Glossary
          </Link>
          <Link className="btn" href="/settings">
            Settings
          </Link>
          <button className="btn btnDanger" onClick={() => signOut()}>
            Log out
          </button>
        </div>

        <div style={{ height: 14 }} />

        {/* Who is it for */}
        <div style={{ textAlign: "left", maxWidth: 520, margin: "0 auto" }}>
          <div className="h2" style={{ marginBottom: 6 }}>
            Who is iSpeak for?
          </div>
          <div className="small muted" style={{ lineHeight: 1.7 }}>
            • Court interpreters <br />
            • Immigration interpreters <br />
            • Community interpreters <br />
            • Interpreter students
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="h2">What’s next</div>
        <div className="small muted">
          Premium AI explainer & advanced tools coming after beta.
        </div>
      </div>
    </div>
  );
}