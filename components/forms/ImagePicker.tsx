"use client";

import { useId, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * Image field of a <FieldsForm>: a dashed circle (or wide box for covers)
 * that opens the file picker and previews the chosen file. The ✕ clears a
 * new pick and, for optional images, sends `<name>__remove` to drop the
 * saved one (see parseFields in lib/fields.server.ts).
 */
export function ImagePicker({
  name,
  label,
  help,
  current,
  required,
  wide,
}: {
  name: string;
  label: string;
  help: string | null;
  /** The saved image URL, if any. */
  current: string | null;
  required?: boolean;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const shown = picked ?? (removed ? null : current);

  function choose(file: File | undefined) {
    if (picked) URL.revokeObjectURL(picked);
    setPicked(file ? URL.createObjectURL(file) : null);
    if (file) setRemoved(false);
  }

  function clear() {
    if (input.current) input.current.value = "";
    choose(undefined);
    if (!required && current) setRemoved(true);
  }

  // A required image can't be removed, only a new pick undone.
  const canClear = picked != null || (!required && shown != null);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative">
        <input
          ref={input}
          id={id}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="peer sr-only"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <label
          htmlFor={id}
          className={`group relative grid cursor-pointer place-items-center overflow-hidden border-2 border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-500 transition-colors duration-200 hover:border-indigo-500 hover:bg-indigo-50 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/30 ${
            wide ? "h-28 w-56 rounded-3xl" : "size-28 rounded-full"
          }`}
        >
          {shown ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shown} alt="" className="size-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-slate-900/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-6" />
              </span>
            </>
          ) : (
            <ImagePlus className="size-8" />
          )}
        </label>
        {canClear && (
          <button
            type="button"
            onClick={clear}
            aria-label={t.common.removeImage}
            className={`absolute grid size-8 place-items-center rounded-full bg-white text-rose-600 shadow-md ring-1 ring-slate-100 transition-colors hover:bg-rose-50 ${
              wide ? "-end-2 -top-2" : "end-0 top-0"
            }`}
          >
            <X className="size-4" />
          </button>
        )}
        {removed && !picked && <input type="hidden" name={`${name}__remove`} value="on" />}
      </div>
      <label htmlFor={id} className="cursor-pointer text-xs font-bold text-slate-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      {help && <p className="help mt-0">{help}</p>}
    </div>
  );
}
