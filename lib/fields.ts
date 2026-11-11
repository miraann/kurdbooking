// Field definitions for the dashboard forms. Plain data (no functions), so
// they can be passed from Server Components to the client <FieldsForm>.
// Labels, help and placeholders are Txt: one string for every language, or
// { ckb, ar, en }. Parsing/validation of submitted forms is in lib/fields.server.ts.

import type { Txt } from "@/lib/i18n/config";

interface Base {
  name: string;
  label: Txt;
  help?: Txt;
}

export type Field =
  | (Base & { type: "text" | "textarea" | "url" | "tel" | "email"; required?: boolean; placeholder?: Txt; maxLength?: number })
  | (Base & { type: "number"; required?: boolean; min?: number; max?: number; step?: number | "any"; placeholder?: Txt; /** saved when left empty (for NOT NULL columns) */ emptyValue?: number })
  | (Base & { type: "checkbox"; defaultChecked?: boolean })
  | (Base & { type: "select"; options: { value: string; label: Txt }[]; required?: boolean })
  | (Base & { type: "date"; required?: boolean })
  | (Base & { type: "time"; required?: boolean })
  | (Base & { type: "color" })
  | (Base & { type: "image"; folder: string; required?: boolean });

export type FieldValues = Record<string, string | number | boolean | null | undefined>;

export interface ActionState {
  ok: boolean;
  message?: string;
  /** What the user typed, so a failed submit doesn't wipe the form. */
  values?: Record<string, string>;
  /** Bumped on every submit so the form remounts with fresh defaults. */
  nonce?: number;
}

export const initialActionState: ActionState = { ok: false };
