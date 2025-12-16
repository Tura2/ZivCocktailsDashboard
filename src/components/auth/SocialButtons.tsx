'use client';

type SocialButtonsProps = {
  onGoogle?: () => void;
  onApple?: () => void;
  loadingTarget?: "google" | "apple" | null;
  showApple?: boolean;
  googleLabel?: string;
};

export function SocialButtons({
  onGoogle,
  onApple,
  loadingTarget = null,
  showApple = true,
  googleLabel = "Sign in with Google",
}: SocialButtonsProps) {
  const baseClasses =
    "flex w-full items-center justify-center gap-3 rounded-[10px] border border-[var(--auth-stroke)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[var(--auth-text-strong)] transition hover:bg-[#f8f8f8] disabled:cursor-not-allowed disabled:opacity-70";
  const isGoogleBusy = loadingTarget === "google";
  const isAppleBusy = loadingTarget === "apple";
  const containerClass = showApple ? "grid gap-3 sm:grid-cols-2" : "w-full";

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={onGoogle}
        className={baseClasses}
        disabled={isGoogleBusy}
        aria-busy={isGoogleBusy}
      >
        <GoogleMark />
        {isGoogleBusy ? "Connecting" : googleLabel}
      </button>
      {showApple ? (
        <button
          type="button"
          onClick={onApple}
          className={baseClasses}
          disabled={isAppleBusy}
          aria-busy={isAppleBusy}
        >
          <AppleMark />
          {isAppleBusy ? "Connecting" : "Sign in with Apple"}
        </button>
      ) : null}
    </div>
  );
}

const GoogleMark = () => (
  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--auth-stroke)] text-[11px] font-black">
    G
  </span>
);
 
const AppleMark = () => (
  <svg
    aria-hidden
    viewBox="0 0 14 18"
    className="h-5 w-5 text-black"
    fill="currentColor"
  >
    <path d="M10.27 0c.05 1.05-.38 1.84-1 2.47-.63.64-1.4 1.02-2.26.94-.06-.92.32-1.75.94-2.37.67-.63 1.71-1.08 2.32-.98Zm3.33 13.31c-.3.67-.45.96-.85 1.54-.55.81-1.31 1.82-2.26 1.83-.85.02-1.08-.54-2.25-.54-1.16 0-1.43.55-2.26.52-.93-.02-1.64-.92-2.19-1.73-1.49-2.21-1.64-4.79-.72-6.16.65-1 1.67-1.59 2.63-1.59 1 .02 1.63.54 2.46.54.83 0 1.33-.54 2.48-.54.83 0 1.71.45 2.36 1.27-2.07 1.13-1.73 4.09.33 4.86.18.07.38.11.59.16-.07.17-.13.33-.22.54Z" />
  </svg>
);

