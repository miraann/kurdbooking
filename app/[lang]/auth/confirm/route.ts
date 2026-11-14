import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LANG, isLang, localePath } from "@/lib/i18n/config";

// Where password-reset links land. It logs the person in for the reset, then
// sends them to /reset-password (or back to /forgot-password if the link is
// bad). Two kinds of link:
//
// - ?token_hash=…&type=recovery : the link /super makes for WhatsApp
//   (auth.admin.generateLink). Works on any device.
// - ?code=… : Supabase's default reset email (PKCE). Works only in the
//   browser that asked for it, because the code verifier is in its cookies.
//   To make emails work on any device too, change the Supabase "Reset
//   password" email template to link to
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery

export async function GET(request: NextRequest, ctx: RouteContext<"/[lang]/auth/confirm">) {
  const { lang: raw } = await ctx.params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const query = request.nextUrl.searchParams;
  const tokenHash = query.get("token_hash");
  const code = query.get("code");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && query.get("type") === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const to = request.nextUrl.clone();
  to.pathname = localePath(lang, ok ? "/reset-password" : "/forgot-password");
  to.search = ok ? "" : "?error=link";
  return NextResponse.redirect(to);
}
