// Instant placeholder while the pins stream in: a grey map-sized block (the tab bar floats over it).
export default function MapLoading() {
  return <div data-map-page className="h-[calc(100dvh-4.2rem)] animate-pulse bg-neutral-100 md:mx-auto md:my-6 md:h-[calc(100dvh-8.5rem)] md:max-w-5xl md:rounded-3xl" aria-busy="true" />;
}
