// Sends push notifications via OneSignal's REST API. Targets users by their
// OneSignal "External ID", which the client sets to our own User.id via
// OneSignal.login(userId) — see src/components/PushNotificationSetup.tsx —
// so no separate device-token table needs to be maintained here.

interface SendPushOptions {
  userIds: string[];
  title: string;
  message: string;
  url?: string; // relative path to open in-app when the notification is tapped
}

export async function sendPushToUsers({ userIds, title, message, url }: SendPushOptions): Promise<void> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    console.error("Push notification skipped: ONESIGNAL_APP_ID / ONESIGNAL_API_KEY not configured.");
    return;
  }
  if (userIds.length === 0) return;

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_external_user_ids: userIds,
        channel_for_external_user_ids: "push",
        headings: { en: title },
        contents: { en: message },
        ...(url ? { data: { url }, web_url: url } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("OneSignal push failed:", res.status, text);
    }
  } catch (error) {
    // Never let a notification failure break the calling API's main action.
    console.error("Error sending push notification:", error);
  }
}
