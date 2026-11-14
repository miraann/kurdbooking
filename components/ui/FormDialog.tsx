"use client";

import { createContext, use, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

const DialogClose = createContext<(() => void) | null>(null);

/** close() of the <FormDialog> around this component, or null outside one. */
export function useDialogClose() {
  return use(DialogClose);
}

/**
 * A button that opens its children (usually a <FieldsForm>) in a modal
 * dialog. A <FieldsForm> inside closes the dialog after a successful save.
 */
export function FormDialog({
  title,
  trigger,
  triggerClassName,
  children,
}: {
  title: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        // The dialog has no padding, so a click on the dialog itself is a click on the backdrop.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto max-h-[90dvh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-3xl bg-white p-0 text-slate-900 shadow-md-2 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
      >
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={close}
              aria-label={t.common.close}
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-100/80 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>
          </div>
          <DialogClose value={close}>{children}</DialogClose>
        </div>
      </dialog>
    </>
  );
}

/** The dashed "＋ Add" tile that starts a grid list; opens its form in a <FormDialog>. */
export function AddTile({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <FormDialog
      title={label}
      triggerClassName="flex size-full min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-indigo-200 bg-white/60 p-5 text-center text-indigo-700 transition-all duration-200 hover:border-indigo-400 hover:bg-indigo-50/60 active:scale-[0.98]"
      trigger={
        <>
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-[0_10px_24px_-8px_rgb(79,70,229,0.55)]">
            <Plus className="size-6" />
          </span>
          <span className="text-sm font-bold">{label}</span>
          {hint && <span className="text-xs text-slate-500">{hint}</span>}
        </>
      }
    >
      {children}
    </FormDialog>
  );
}
