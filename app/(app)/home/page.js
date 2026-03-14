"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "../../../lib/auth";
import IntroSplash from "../../../components/IntroSplash";
import InstallPrompt from "../../../components/InstallPrompt";
import IPhoneInstallHint from "../../../components/TempInstallHint";

export default function Home() {
  async function shareApp() {
    const url = "https://ispeaktraining.com";
    const text =
      "iSpeak — Interpreter terminology training.\n\nPractice court, immigration, and family terminology and build your own glossary.\n\nhttps://ispeaktraining.com";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "iSpeak Interpreter Training",
          text,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Share failed:", err);
    }
  }

  return (
    <>
      <IntroSplash />

      <div className="container">
        <InstallPrompt />
        <IPhoneInstallHint />

        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <Image
              src="/brand/logo.png"
              alt="iSpeak"
              width={240}
              height={240}
              priority
              style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.12))" }}
            />
          </div>

          <div className="h1">iSpeak</div>

          <div className="muted" style={{ marginTop: 6, fontWeight: 600 }}>
            Interpreter Terminology Training
          </div>

          <div
            className="small muted"
            style={{
              marginTop: 8,
              maxWidth: 560,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.8,
            }}
          >
            Practice legal terminology.
            <br />
            Build personal glossaries.
            <br />
            Improve interpretation recall speed.
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
              Browse Glossary
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
            className="card"
            style={{
              maxWidth: 560,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div className="small muted" style={{ lineHeight: 1.7, marginBottom: 12 }}>
              Know another interpreter or interpreting student?
              <br />
              Share iSpeak with them.
            </div>

            <button
              className="btn btnPrimary"
              type="button"
              onClick={shareApp}
              style={{ minWidth: 180 }}
            >
              Share iSpeak
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
    </>
  );
}