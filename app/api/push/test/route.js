import webpush from "web-push";

export async function POST(req) {
  try {
    const { subscription } = await req.json();

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      return Response.json({ error: "Missing VAPID env vars" }, { status: 500 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: "iSpeak",
        body: "✅ Push notifications are working!",
      })
    );

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message || String(e) }, { status: 500 });
  }
}