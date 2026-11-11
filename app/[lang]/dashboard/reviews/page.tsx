import { canManage, requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REPLY_FIELDS } from "@/lib/forms";
import { fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Review } from "@/lib/types";
import { replyToReview } from "@/app/[lang]/dashboard/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { Stars } from "@/components/ui/Stars";

// Customer reviews (written in the customer app after a completed visit).
// Owners and managers reply once; nobody here can edit or delete a review.

export default async function ReviewsPage() {
  const [{ shop, role }, { t, f }] = await Promise.all([requireShop(), getI18n()]);
  const tr = t.dashboard.reviews;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const reviews = (data ?? []) as Review[];
  const visible = reviews.filter((r) => !r.is_hidden);
  const avg = visible.length ? visible.reduce((sum, r) => sum + r.rating, 0) / visible.length : 0;

  return (
    <div className="space-y-5">
      <h1 className="page-title">{tr.title}</h1>
      <p className="text-sm text-slate-500">{tr.help}</p>

      {visible.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3">
          <span className="text-3xl font-bold">{f.num(avg.toFixed(1))}</span>
          <Stars rating={avg} className="size-5" />
          <span className="text-sm text-slate-500">{fill(tr.count, { n: f.num(visible.length) })}</span>
        </div>
      )}

      {reviews.length === 0 && <p className="card text-center text-sm text-slate-500">{tr.empty}</p>}

      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className={`card space-y-3 ${r.is_hidden ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="sr-only">{f.num(r.rating)} / {f.num(5)}</span>
                <span className="font-semibold">{r.reviewer_name || "—"}</span>
                {r.is_hidden && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{tr.hidden}</span>}
              </div>
              <span className="text-xs text-slate-400">{f.shortDate(r.created_at, shop.timezone)}</span>
            </div>
            {r.body && <p className="whitespace-pre-line text-sm text-slate-700">{r.body}</p>}

            {r.reply ? (
              <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-slate-500">{tr.yourReply}</p>
                <p className="whitespace-pre-line">{r.reply}</p>
              </div>
            ) : (
              canManage(role) && (
                <FieldsForm action={replyToReview.bind(null, r.id)} fields={REPLY_FIELDS} submitLabel={tr.reply} columns={1} />
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
