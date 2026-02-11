import { config } from "./config";

export async function sendAlert(message: string) {
  if (!config.telegram.enabled) {
    console.log(`[alert] ${message}`);
    return;
  }

  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegram.chatId, text: message }),
  });
}
