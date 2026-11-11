"use client";

import { useActionState } from "react";
import { initialActionState, type ActionState, type Field, type FieldValues } from "@/lib/fields";
import { tx, type Lang } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Switch } from "@/components/ui/Switch";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Renders a list of Field definitions as a form bound to a Server Action.
 * After each submit the form remounts (key = nonce): on success with the
 * saved values (or empty for "add" forms), on error with what was typed.
 */
export function FieldsForm({
  action,
  fields,
  defaults,
  hidden,
  submitLabel,
  columns = 2,
}: {
  action: FormAction;
  fields: Field[];
  defaults?: FieldValues;
  hidden?: Record<string, string>;
  submitLabel: string;
  columns?: 1 | 2;
}) {
  const { lang } = useI18n();
  const [state, formAction] = useActionState(action, initialActionState);
  const echo = !state.ok && state.values ? state.values : null;

  return (
    <form action={formAction} key={state.nonce ?? 0} className="space-y-4">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className={columns === 2 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
        {fields.map((f) => (
          <FieldInput key={f.name} field={f} lang={lang} value={echo ? echo[f.name] : defaults?.[f.name]} echoed={!!echo} />
        ))}
      </div>

      {state.message && (
        <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>
          {state.message}
        </p>
      )}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

function FieldInput({ field: f, lang, value, echoed }: { field: Field; lang: Lang; value: FieldValues[string]; echoed: boolean }) {
  const { t } = useI18n();
  const id = `f-${f.name}`;
  const str = value == null ? "" : String(value);
  const wide = f.type === "textarea" || f.type === "image";
  const label = tx(f.label, lang);
  const help = f.help ? tx(f.help, lang) : null;
  const placeholder = "placeholder" in f && f.placeholder ? tx(f.placeholder, lang) : undefined;

  if (f.type === "checkbox") {
    const checked = echoed ? str === "on" : value == null ? !!f.defaultChecked : value === true || str === "true";
    return (
      <label className="flex items-center justify-between gap-3 self-end rounded-2xl bg-slate-100/60 px-4 py-3">
        <span className="text-sm font-bold text-slate-700">
          {label}
          {help && <span className="help block font-normal">{help}</span>}
        </span>
        <Switch name={f.name} defaultChecked={checked} />
      </label>
    );
  }

  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="label">
        {label}
        {"required" in f && f.required && <span className="text-rose-600"> *</span>}
      </label>

      {f.type === "textarea" ? (
        <textarea id={id} name={f.name} defaultValue={str} rows={3} maxLength={f.maxLength} placeholder={placeholder} className="input" />
      ) : f.type === "select" ? (
        <select id={id} name={f.name} defaultValue={str} className="input">
          {!f.required && <option value="">—</option>}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{tx(o.label, lang)}</option>
          ))}
        </select>
      ) : f.type === "image" ? (
        <div className="flex items-center gap-3">
          {!echoed && str && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={str} alt="" className="size-16 rounded-2xl object-cover ring-1 ring-slate-100" />
          )}
          <div className="flex-1 space-y-1">
            <input id={id} name={f.name} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input" />
            {!echoed && str && !f.required && (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name={`${f.name}__remove`} /> {t.common.removeImage}
              </label>
            )}
          </div>
        </div>
      ) : f.type === "color" ? (
        <input id={id} name={f.name} type="color" defaultValue={str || "#2563eb"} className="h-12 w-24 cursor-pointer rounded-2xl border-0 bg-slate-100/60 p-1.5" />
      ) : (
        <input
          id={id}
          name={f.name}
          type={f.type === "time" ? "time" : f.type === "date" ? "date" : f.type === "number" ? "number" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}
          dir={["url", "tel", "email", "number"].includes(f.type) ? "ltr" : undefined}
          defaultValue={f.type === "time" ? str.slice(0, 5) : str}
          placeholder={placeholder}
          min={f.type === "number" ? f.min : undefined}
          max={f.type === "number" ? f.max : undefined}
          step={f.type === "number" ? f.step ?? 1 : undefined}
          maxLength={"maxLength" in f ? f.maxLength : undefined}
          className="input"
        />
      )}
      {help && <p className="help">{help}</p>}
    </div>
  );
}
