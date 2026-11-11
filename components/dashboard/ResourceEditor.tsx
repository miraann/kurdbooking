import { canManage, requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RESOURCES, type ResourceKey } from "@/lib/resources";
import type { Field, FieldValues } from "@/lib/fields";
import { tx } from "@/lib/i18n/config";
import { getI18n, type I18n } from "@/lib/i18n/server";
import { deleteResource, saveResource } from "@/app/[lang]/dashboard/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { ActionButton } from "@/components/ui/ActionButton";

/** List + add + edit + delete for one entry of lib/resources.ts. */
export async function ResourceEditor({ resource }: { resource: ResourceKey }) {
  const cfg = RESOURCES[resource];
  const [{ shop, role }, i18n] = await Promise.all([requireShop(), getI18n()]);
  const { lang, t } = i18n;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(cfg.table)
    .select("*")
    .eq("shop_id", shop.id)
    .order(cfg.orderBy.column, { ascending: cfg.orderBy.ascending });
  if (error) throw error;
  const rows = (data ?? []) as (FieldValues & { id: string })[];
  const editable = canManage(role);
  const save = saveResource.bind(null, resource);

  return (
    <div className="space-y-4">
      {editable && (
        <details className="card group">
          <summary className="cursor-pointer list-none font-semibold text-brand">＋ {cfg.addLabel[lang]}</summary>
          <div className="mt-4">
            <FieldsForm action={save} fields={cfg.fields} submitLabel={t.common.add} />
          </div>
        </details>
      )}

      {rows.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">{cfg.emptyText[lang]}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const image = cfg.imageField ? (row[cfg.imageField] as string | null) : null;
            const title = cell(cfg.fields, cfg.titleField, row[cfg.titleField], i18n) || "—";
            const subtitle = (cfg.subtitleFields ?? [])
              .map((name) => cell(cfg.fields, name, row[name], i18n))
              .filter(Boolean)
              .join(" · ");
            const inactive = row.is_active === false;
            return (
              <li key={row.id} className={`card ${inactive ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{title}</p>
                    {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
                    {inactive && <p className="text-xs text-amber-700">{t.common.inactive}</p>}
                  </div>
                  {editable && (
                    <ActionButton
                      action={deleteResource.bind(null, resource, row.id)}
                      confirmText={t.common.confirmDelete}
                      className="btn-danger px-3 py-1.5"
                    >
                      {t.common.delete}
                    </ActionButton>
                  )}
                </div>
                {editable && (
                  <details className="mt-3 border-t border-slate-100 pt-3">
                    <summary className="cursor-pointer text-sm text-brand">{t.common.edit}</summary>
                    <div className="mt-4">
                      <FieldsForm action={save} fields={cfg.fields} defaults={row} hidden={{ id: row.id }} submitLabel={t.common.save} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Human-friendly value for the list view. */
function cell(fields: Field[], name: string, value: FieldValues[string], { lang, f }: I18n): string {
  if (value == null || value === "") return "";
  const field = fields.find((x) => x.name === name);
  if (field?.type === "select") {
    const option = field.options.find((o) => o.value === value);
    return option ? tx(option.label, lang) : String(value);
  }
  if (field?.type === "date") return f.date(String(value));
  if (name === "price_iqd") return f.iqd(Number(value));
  if (name === "duration_minutes") return f.minutes(Number(value));
  return String(value);
}
