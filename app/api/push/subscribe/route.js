import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { subscription } = await req.json();
    if (!subscription?.endpoint) {
      return Response.json({ error: "Missing subscription.endpoint" }, { status: 400 });
    }

    const p256dh = subscription?.keys?.p256dh ?? null;
    const auth = subscription?.keys?.auth ?? null;

    // Save 1 subscription per endpoint (works well across devices/browsers)
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}