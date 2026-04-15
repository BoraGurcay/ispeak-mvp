"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const LANGUAGES = [
  { value: "tr", label: "🇹🇷 Turkish" },
  { value: "fr", label: "🇫🇷 French" },
  { value: "es", label: "🇪🇸 Spanish" },
  { value: "pt", label: "🇵🇹 Portuguese" },
  { value: "hi", label: "🇮🇳 Hindi" },
  { value: "ar", label: "🇸🇦 Arabic" },
  { value: "zh", label: "🇨🇳 Mandarin" },
  { value: "ta", label: "🇮🇳 Tamil" },
  { value: "pa", label: "🇮🇳 Punjabi" },
  { value: "tl", label: "🇵🇭 Tagalog" },
  { value: "so", label: "🇸🇴 Somali" },
  { value: "el", label: "🇬🇷 Greek" },
  { value: "ur", label: "🇵🇰 Urdu" },
  { value: "uk", label: "🇺🇦 Ukrainian" },
  { value: "fa", label: "🇮🇷 Farsi" },
  { value: "ru", label: "🇷🇺 Russian" },
  { value: "ro", label: "🇷🇴 Romanian" },
  { value: "hu", label: "🇭🇺 Hungarian" },
  { value: "pl", label: "🇵🇱 Polish" },
  { value: "vi", label: "🇻🇳 Vietnamese" },
];

const ROLE_OPTIONS = ["Interpreter", "Interpreting Student", "Other"];

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    country: "",
    role: "Interpreter",
    preferred_target_lang: "tr",
  });

  const [stats, setStats] = useState({
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: null,
    created_at: null,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("Please sign in again.");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Profile load error:", error);
        setStatus("Could not load profile.");
        return;
      }

      const savedLang = localStorage.getItem("ispeak_target_lang") || "tr";

      if (data) {
        setForm({
          full_name: data.full_name || "",
          country: data.country || "",
          role: data.role || "Interpreter",
          preferred_target_lang: data.preferred_target_lang || savedLang,
        });

        setStats({
          current_streak: data.current_streak || 0,
          longest_streak: data.longest_streak || 0,
          last_activity_date: data.last_activity_date || null,
          created_at: data.created_at || null,
        });
      } else {
        setForm((prev) => ({
          ...prev,
          preferred_target_lang: savedLang,
        }));
      }
    } catch (err) {
      console.error("Unexpected profile load error:", err);
      setStatus("Could not load profile.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setStatus("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("Please sign in again.");
        return;
      }

      const payload = {
        id: user.id,
        full_name: form.full_name.trim() || null,
        country: form.country.trim() || null,
        role: form.role,
        preferred_target_lang: form.preferred_target_lang || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload);

      if (error) {
        console.error("Profile save error:", error);
        setStatus("Could not save profile.");
        return;
      }

      localStorage.setItem("ispeak_target_lang", form.preferred_target_lang);
      setStatus("Profile saved ✓");
      await loadProfile();
    } catch (err) {
      console.error("Unexpected profile save error:", err);
      setStatus("Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  function memberSince(dateString) {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "—";
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">My Profile</div>

        <div className="small muted" style={{ marginTop: 6, lineHeight: 1.6, maxWidth: 620 }}>
          Keep your account details simple and personalize your learning experience.
        </div>

        <div className="hr" />

        {loading ? (
          <div className="small muted">Loading profile...</div>
        ) : (
          <form onSubmit={saveProfile} className="col" style={{ gap: 12 }}>
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Full Name
              </div>
              <input
                className="input"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Your name"
              />
            </label>

            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Country
              </div>
              <input
                className="input"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="e.g., Canada"
              />
            </label>

            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Role
              </div>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Preferred Target Language
              </div>
              <select
                className="input"
                value={form.preferred_target_lang}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preferred_target_lang: e.target.value }))
                }
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn btnPrimary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>

            {status ? <div className="small muted">{status}</div> : null}
          </form>
        )}
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Learning Summary
        </div>

        <div className="col" style={{ gap: 8 }}>
          <div className="badge">Current Streak: {stats.current_streak || 0}</div>
          <div className="badge">Longest Streak: {stats.longest_streak || 0}</div>
          <div className="small muted">
            Last Active: {stats.last_activity_date || "—"}
          </div>
          <div className="small muted">
            Member Since: {memberSince(stats.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}