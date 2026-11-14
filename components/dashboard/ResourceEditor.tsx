import { Pencil, Trash2 } from "lucide-react";
import { canManage, requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RESOURCES, type ResourceConfig, type ResourceKey } from "@/lib/resources";
import { withShopOptions } from "@/lib/resources.server";
import type { Field, FieldValues } from "@/lib/fields";
import { tx } from "@/lib/i18n/config";
import { getI18n, type I18n } from "@/lib/i18n/server";
import { deleteResource, saveResource } from "@/app/[lang]/dashboard/actions";
import { FieldsForm } from "@/components/forms/FieldsForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { AddTile, FormDialog } from "@/components/ui/FormDialog";

/** Grid of cards for one entry of lib/resources.ts: an "add" tile first, then each row with edit (dialog) and delete. */
export async function ResourceEditor({ resource }: { resource: ResourceKey }) {
  const cfg = RESOURCES[resource];
  const [{ shop, role }, i18n] = await Promise.all([requireShop(), getI18n()]);
  const { lang, t } = i18n;
  const supabase = await createClient();
  let query = supabase
    .from(cfg.table)
    .select("*")
    .eq("shop_id", shop.id)
    .order(cfg.orderBy.column, { ascending: cfg.orderBy.ascending });
  if (cfg.thenBy) query = query.order(cfg.thenBy, { ascending: cfg.orderBy.ascending, nullsFirst: true });
  const [{ data, error }, fields] = await Promise.all([query, withShopOptions(cfg.fields, supabase, shop.id)]);
  if (error) throw error;
  const rows = (data ?? []) as (FieldValues & { id: string })[];
  const editable = canManage(role);
  const save = saveResource.bind(null, resource);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {editable && (
        <li>
          <AddTile label={cfg.addLabel[lang]} hint={rows.length === 0 ? cfg.emptyText[lang] : undefined}>
            <FieldsForm action={save} fields={fields} submitLabel={t.common.add} />
          </AddTile>
        </li>
      )}

      {!editable && rows.length === 0 && (
        <li className="card text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">{cfg.emptyText[lang]}</li>
      )}

      {rows.map((row) => {
        const image = cfg.imageField ? (row[cfg.imageField] as string | null) : null;
        const title = cell(fields, cfg.titleField, row[cfg.titleField], i18n) || "—";
        const subtitle = [
          range(cfg, row, i18n),
          ...(cfg.subtitleFields ?? []).map((name) => cell(fields, name, row[name], i18n)),
        ]
          .filter(Boolean)
          .join(" · ");
        const inactive = row.is_active === false;
        return (
          <li key={row.id} className={`card flex flex-col gap-3 ${inactive ? "opacity-60" : ""}`}>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="aspect-video w-full rounded-2xl object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{title}</p>
              {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
              {inactive && <p className="text-xs text-amber-700">{t.common.inactive}</p>}
            </div>
            {editable && (
              <div className="mt-auto flex items-start gap-2 border-t border-slate-100 pt-3">
                <FormDialog
                  title={`${t.common.edit} · ${title}`}
                  triggerClassName="btn-tonal min-h-10 flex-1 py-2"
                  trigger={<><Pencil className="size-4" /> {t.common.edit}</>}
                >
                  <FieldsForm action={save} fields={fields} defaults={row} hidden={{ id: row.id }} submitLabel={t.common.save} />
                </FormDialog>
                <ActionButton
                  action={deleteResource.bind(null, resource, row.id)}
                  confirmText={t.common.confirmDelete}
                  className="btn-danger min-h-10 px-3 py-2"
                >
                  <Trash2 className="size-4" /><span className="sr-only">{t.common.delete}</span>
                </ActionButton>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "٣:٠٠ – ٤:٠٠ دوا نیوەڕۆ" for rangeFields, or "whole day" when both are empty. */
function range(cfg: ResourceConfig, row: FieldValues, { t, f }: I18n): string {
  if (!cfg.rangeFields) return "";
  const [from, to] = cfg.rangeFields.map((name) => row[name]);
  return from && to ? `${f.time(String(from))} – ${f.time(String(to))}` : t.common.wholeDay;
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
  if (field?.type === "time") return f.time(String(value));
  if (name === "price_iqd") return f.iqd(Number(value));
  if (name === "duration_minutes") return f.minutes(Number(value));
  return String(value);
}
