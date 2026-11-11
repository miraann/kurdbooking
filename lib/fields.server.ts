import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Field } from "@/lib/fields";
import { digits, fill, normalizePhone } from "@/lib/format";
import { tx, type Lang } from "@/lib/i18n/config";
import { DICTS } from "@/lib/i18n/dictionaries";

export const MEDIA_BUCKET = "shop-media";
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class FieldError extends Error {}

/** Raw text values of a submitted form, to refill it after an error. */
export function echoValues(fields: Field[], formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "image") continue;
    if (f.type === "checkbox") out[f.name] = formData.has(f.name) ? "on" : "";
    else out[f.name] = String(formData.get(f.name) ?? "");
  }
  return out;
}

/**
 * Validates a submitted form against its field list and returns a row to
 * insert/update. Image fields are uploaded to storage under
 * "<shopId>/<folder>/…" (RLS checks the user may write there).
 * `isNew` makes required images mandatory; on edit an empty file input
 * keeps the current image.
 */
export async function parseFields(
  fields: Field[],
  formData: FormData,
  opts: { lang: Lang; supabase?: SupabaseClient; shopId?: string; isNew: boolean },
): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {};
  const e = DICTS[opts.lang].errors;

  for (const f of fields) {
    const raw = formData.get(f.name);
    const text = typeof raw === "string" ? raw.trim() : "";
    const label = tx(f.label, opts.lang);
    /** A FieldError with this field's label filled into a dictionary message. */
    const bad = (msg: string, vars: Record<string, string | number> = {}) => new FieldError(fill(msg, { label, ...vars }));

    switch (f.type) {
      case "checkbox":
        row[f.name] = formData.has(f.name);
        break;

      case "number": {
        if (text === "") {
          if (f.required) throw bad(e.required);
          row[f.name] = f.emptyValue ?? null;
          break;
        }
        const n = Number(text.replace(/,/g, ""));
        if (!Number.isFinite(n)) throw bad(e.notNumber);
        if (f.step !== "any" && !Number.isInteger(n)) throw bad(e.notInteger);
        if (f.min != null && n < f.min) throw bad(e.min, { min: digits(f.min, opts.lang) });
        if (f.max != null && n > f.max) throw bad(e.max, { max: digits(f.max, opts.lang) });
        row[f.name] = n;
        break;
      }

      case "select":
        if (!text) {
          if (f.required) throw bad(e.choose);
          row[f.name] = null;
        } else if (!f.options.some((o) => o.value === text)) {
          throw bad(e.invalid);
        } else row[f.name] = text;
        break;

      case "date":
        if (!text) {
          if (f.required) throw bad(e.required);
          row[f.name] = null;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw bad(e.invalid);
        else row[f.name] = text;
        break;

      case "time":
        if (!text) {
          if (f.required) throw bad(e.required);
          row[f.name] = null;
        } else if (!/^\d{2}:\d{2}$/.test(text)) throw bad(e.invalid);
        else row[f.name] = text;
        break;

      case "color":
        if (!/^#[0-9a-fA-F]{6}$/.test(text)) throw bad(e.invalid);
        row[f.name] = text;
        break;

      case "image": {
        const file = raw instanceof File && raw.size > 0 ? raw : null;
        if (file) {
          if (!opts.supabase || !opts.shopId) throw new Error("Image upload needs supabase + shopId");
          row[f.name] = await uploadImage(opts.supabase, opts.shopId, f.folder, file, opts.lang);
        } else if (formData.has(`${f.name}__remove`)) {
          if (f.required) throw bad(e.required);
          row[f.name] = null;
        } else if (opts.isNew && f.required) {
          throw bad(e.required);
        }
        // else: leave the column untouched (keeps the current image)
        break;
      }

      default: {
        // text, textarea, url, tel, email
        if (!text) {
          if (f.required) throw bad(e.required);
          row[f.name] = null;
          break;
        }
        if ("maxLength" in f && f.maxLength && text.length > f.maxLength) {
          throw bad(e.tooLong);
        }
        if (f.type === "url") {
          const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
          try {
            const u = new URL(withProtocol);
            if (!["http:", "https:"].includes(u.protocol)) throw new Error();
            row[f.name] = u.toString();
          } catch {
            throw bad(e.badUrl);
          }
        } else if (f.type === "tel") {
          const p = normalizePhone(text);
          if (!p) throw bad(e.badPhone);
          row[f.name] = p;
        } else if (f.type === "email") {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw bad(e.invalid);
          row[f.name] = text.toLowerCase();
        } else {
          row[f.name] = text;
        }
      }
    }
  }
  return row;
}

async function uploadImage(supabase: SupabaseClient, shopId: string, folder: string, file: File, lang: Lang): Promise<string> {
  const e = DICTS[lang].errors;
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new FieldError(e.imageType);
  if (file.size > MAX_IMAGE_BYTES) throw new FieldError(e.imageSize);

  const path = `${shopId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new FieldError(e.uploadFailed);
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes files of ours that a row no longer uses. Ignores outside URLs. */
export async function removeImages(supabase: SupabaseClient, urls: (string | null | undefined)[]) {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const paths = urls
    .filter((u): u is string => !!u && u.includes(marker))
    .map((u) => decodeURIComponent(u.split(marker)[1]));
  if (paths.length) await supabase.storage.from(MEDIA_BUCKET).remove(paths);
}
