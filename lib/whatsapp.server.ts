import "server-only";
import { env } from "@/lib/env";

// Sends the verification code over WhatsApp with Meta's Cloud API, using an
// approved *authentication* message template (docs/whatsapp-setup.md).
//
// Nothing here is needed to run the site: when the three WHATSAPP_* secrets are
// not set, whatsappEnabled() is false and customers sign up without a code,
// exactly as before.

export const whatsappEnabled = (): boolean => env.whatsapp() !== null;

/**
 * Sends `code` to `phone` (9647XXXXXXXXX). Returns true when Meta accepted the
 * message. Never throws: a failure is logged (without the code) and returns false.
 */
export async function sendWhatsAppCode(phone: string, code: string): Promise<boolean> {
  const cfg = env.whatsapp();
  if (!cfg) return false;

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: cfg.template,
      language: { code: cfg.language },
      components: [
        // Authentication templates carry the code twice: in the text, and in
        // the «copy code» button.
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return true;
    const err = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
    console.error("whatsapp send failed", res.status, err?.error?.code, err?.error?.message);
    return false;
  } catch (e) {
    console.error("whatsapp send failed", e instanceof Error ? e.message : e);
    return false;
  }
}
