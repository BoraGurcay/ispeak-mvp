"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "../../../lib/auth";

export default function Home() {
  return (
    <div className="container">
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <Image
            src="/brand/logo.png"
            alt="iSpeak"
            width={150}
            height={150}
            priority
          />
        </div>

        <div className="h1">iSpeak</div>

        <div className="muted" style={{ marginTop: 6, fontWeight: 600 }}>
          Professional Interpreter Training
        </div>

        <div
          className="small muted"
          style={{
            marginTop: 8,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.6,
          }}
        >
          Practice terminology, build personal glossaries, and improve recall speed
          across real interpreting domains.
        </div>

        <div className="hr" />

        <div className="col" style={{ gap: 10, maxWidth: 420, margin: "0 auto" }}>
          <Link className="btn btnPrimary" href="/practice">
            Practice Terminology
          </Link>

          <Link className="btn" href="/play">
            Timed Challenge
          </Link>

          <Link className="btn" href="/glossary">
            Open Glossary
          </Link>

          <Link className="btn" href="/settings">
            Settings
          </Link>

          <Link className="btn" href="/feedback">
            Share Feedback
          </Link>

          <button className="btn btnDanger" onClick={() => signOut()}>
            Log Out
          </button>
        </div>

        <div style={{ height: 18 }} />

        <div
          style={{
            textAlign: "left",
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          <div className="h2" style={{ marginBottom: 8 }}>
            Built for
          </div>

          <div className="small muted" style={{ lineHeight: 1.8 }}>
            • Court interpreters <br />
            • Immigration interpreters <br />
            • Community interpreters <br />
            • Interpretation students
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="h2" style={{ marginBottom: 6 }}>
          Training Focus
        </div>

        <div className="small muted" style={{ lineHeight: 1.7 }}>
          Build terminology recall, strengthen speed and accuracy, and review weak
          terms across court, immigration, and family interpretation.
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="h2" style={{ marginBottom: 6 }}>
          Beta
        </div>

        <div className="small muted" style={{ lineHeight: 1.7 }}>
          iSpeak is currently in active development. Feedback from interpreters and
          students helps improve terminology, training flow, and future features.
        </div>
      </div>
    </div>
  );
}