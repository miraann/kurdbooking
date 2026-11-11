/**
 * zhewar's iOS-style switch (components/admin/ui/Switch.tsx), as a real
 * checkbox so it works in plain <form> posts. The knob slides along
 * inset-inline-start, so "on" sits at the inline end in RTL too.
 */
export function Switch({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label?: string }) {
  return (
    <span className="relative inline-flex h-7 w-12 shrink-0">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        aria-label={label}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors duration-300 ease-out peer-checked:bg-indigo-600 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/20" />
      <span className="absolute start-0.5 top-0.5 size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0,0,0,0.18)] transition-[inset-inline-start] duration-300 ease-[cubic-bezier(.34,1.4,.64,1)] peer-checked:start-[22px]" />
    </span>
  );
}
