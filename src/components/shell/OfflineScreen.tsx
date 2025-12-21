type OfflineScreenProps = {
  onRetry: () => void;
};

export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  return (
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6">
        <h1 className="text-lg font-semibold">You're offline</h1>
        <p className="mt-2 text-sm text-gray-600">
          Dashboard, History, and Scripts require a network connection.
        </p>
        <button className="mt-5 rounded-md border px-3 py-2 text-sm" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}
