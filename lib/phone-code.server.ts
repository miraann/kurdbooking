import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { allowAttempt } from "@/lib/rate-limit";
import { sendWhatsAppCode } from "@/lib/whatsapp.server";

// Proves that a customer owns a phone: a 6-digit code over WhatsApp, valid for
// 10 minutes, 5 guesses, one new code per minute (0018_phone_codes.sql). The
// database keeps only a keyed hash of the code.

export type CodePurpose = "signup" | "reset";

const hashCode = (phone: string, purpose: CodePurpose, code: string) =>
  createHmac("sha256", env.supabaseSecret()).update(`${phone}:${purpose}:${code}`).digest("hex");

export type SendResult = "sent" | "too_fast" | "failed";

/**
 * Makes and sends a code. Costs money per message, so three limits apply on top
 * of the database's one-per-minute rule: per visitor, per phone, and for the
 * whole site per day.
 */
export async function sendPhoneCode(phone: string, purpose: CodePurpose): Promise<SendResult> {
  if (!(await allowAttempt("whatsappCode"))) return "too_fast";
  if (!(await allowAttempt("whatsappPhone", phone))) return "too_fast";
  if (!(await allowAttempt("whatsappDaily", "all"))) return "too_fast";

  const code = String(randomInt(100000, 1000000));
  const { data, error } = await createAdminClient().rpc("issue_phone_code", {
    p_phone: phone,
    p_purpose: purpose,
    p_code_hash: hashCode(phone, purpose, code),
  });
  if (error) {
    console.error("issue phone code failed", error.message);
    return "failed";
  }
  if (data === false) return "too_fast";
  return (await sendWhatsAppCode(phone, code)) ? "sent" : "failed";
}

/** true once for the right code. Digits typed in Kurdish/Arabic are accepted. */
export async function checkPhoneCode(phone: string, purpose: CodePurpose, input: string): Promise<boolean> {
  const code = input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
  if (code.length !== 6) return false;
  const { data, error } = await createAdminClient().rpc("check_phone_code", {
    p_phone: phone,
    p_purpose: purpose,
    p_code_hash: hashCode(phone, purpose, code),
  });
  if (error) {
    console.error("check phone code failed", error.message);
    return false;
  }
  return data === true;
}
