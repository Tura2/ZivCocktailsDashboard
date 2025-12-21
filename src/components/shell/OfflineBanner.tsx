export function OfflineBanner() {
  return (
    <div className="w-full border-b bg-white/80 px-4 py-2 text-sm backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="font-medium">You're offline</div>
        <div className="text-gray-600">Some pages are unavailable until you reconnect.</div>
      </div>
    </div>
  );
}
