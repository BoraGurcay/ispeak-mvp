"use client";
import Link from "next/link";
import { signOut } from "../../../lib/auth";

export default function Home() {
  return (
    <div className="container">
      <div className="card">
        <div className="h1">iSpeak</div>
        <div className="muted">Professional interpreter practice platform</div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Train terminology • Build glossaries • Improve speed &amp; accuracy
        </div>

        <div className="hr" />

        <div className="col">
          <Link className="btn btnPrimary" href="/practice">Start Practice</Link>
          <Link className="btn" href="/play">Play</Link>
          <Link className="btn" href="/glossary">Open Glossary</Link>
          <Link className="btn" href="/settings">Settings</Link>
          <button className="btn btnDanger" onClick={() => signOut()}>Log out</button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="h2">What’s next</div>
        <div className="small muted">
          Premium AI explainer &amp; advanced tools coming after beta.
        </div>
      </div>
    </div>
  );
}