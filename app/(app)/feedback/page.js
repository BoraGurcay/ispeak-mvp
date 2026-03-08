"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Sending...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus("Please log in first.");
      return;
    }

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      message: message.trim(),
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setMessage("");
    setStatus("Thanks! Your feedback has been sent.");
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Feedback</div>

        <div className="muted" style={{ marginBottom: 12 }}>
          Tell us what would make iSpeak better.
        </div>

        <form onSubmit={handleSubmit} className="col">
          <textarea
            className="input"
            rows={6}
            placeholder="Share your feedback, ideas, or anything that is not working..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button className="btn btnPrimary" disabled={!message.trim()}>
            Send feedback
          </button>

          {status && <div className="small muted">{status}</div>}
        </form>
      </div>
    </div>
  );
}