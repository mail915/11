const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const expoTokens = tokens.filter((t) => t.startsWith("ExponentPushToken"));
  if (expoTokens.length === 0) return;

  const messages: PushMessage[] = expoTokens.map((to) => ({ to, title, body, data }));

  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("Failed to send push notification", err);
  }
}
