"use client";

import { useActionState, useId } from "react";
import { initialActionState, type ActionState, type Field, type FieldValues } from "@/lib/fields";
import { ImagePicker } from "@/components/forms/ImagePicker";
import { tx, type Lang } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useDialogClose } from "@/components/ui/FormDialog";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Switch } from "@/components/ui/Switch";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Renders a list of Field definitions as a form bound to a Server Action.
 * After each submit the form remounts (key = nonce): on success with the
 * saved values (or empty for "add" forms), on error with what was typed.
 * Inside a <FormDialog>, a successful save closes the dialog.
 * Image fields are shown first, as dashed circles (<ImagePicker>).
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
  const closeDialog = useDialogClose();
  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.ok) closeDialog?.();
    return next;
  }, initialActionState);
  const echo = !state.ok && state.values ? state.values : null;
  const images = fields.filter((f): f is ImageField => f.type === "image");
  const rest = fields.filter((f) => f.type !== "image");

  return (
    <form action={formAction} key={state.nonce ?? 0} className="space-y-4">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      {images.length > 0 && (
        <div className="flex flex-wrap items-start justify-center gap-6">
          {images.map((f) => {
            // Echoed values never include files, so show the saved image (the server kept it).
            const saved = defaults?.[f.name];
            return (
              <ImagePicker
                key={f.name}
                name={f.name}
                label={tx(f.label, lang)}
                help={f.help ? tx(f.help, lang) : null}
                current={typeof saved === "string" && saved ? saved : null}
                required={f.required}
                wide={f.wide}
              />
            );
          })}
        </div>
      )}

      <div className={columns === 2 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
        {rest.map((f) => (
          <FieldInput key={f.name} field={f} lang={lang} value={echo ? echo[f.name] : defaults?.[f.name]} echoed={!!echo} />
        ))}
      </div>

      {state.message && !(state.ok && closeDialog) && (
        <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>
          {state.message}
        </p>
      )}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

type ImageField = Extract<Field, { type: "image" }>;

function FieldInput({ field: f, lang, value, echoed }: { field: Field; lang: Lang; value: FieldValues[string]; echoed: boolean }) {
  const id = useId();
  const str = value == null ? "" : String(value);
  const wide = f.type === "textarea";
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
          {!f.required && <option value="">{f.emptyLabel ? tx(f.emptyLabel, lang) : "—"}</option>}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{tx(o.label, lang)}</option>
          ))}
        </select>
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
