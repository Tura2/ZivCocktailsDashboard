import type { ReactNode } from "react";

const DEFAULT_IMAGE = "/pic-for-login.svg";

type AuthLayoutProps = {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
};

export function AuthLayout({
  children,
  imageUrl = DEFAULT_IMAGE,
  imageAlt = "Mixologist pouring a cocktail in warm light",
}: AuthLayoutProps) {
  const imageSrc = imageUrl.startsWith("http")
    ? imageUrl.includes("?")
      ? `${imageUrl}&auto=format&fit=crop&w=1400&q=80`
      : `${imageUrl}?auto=format&fit=crop&w=1400&q=80`
    : imageUrl;

  return (
    <section className="min-h-screen w-full bg-[var(--auth-bg)] px-4 py-10 sm:px-6 lg:px-10 lg:py-12 flex items-center justify-center">
      <div className="relative mx-auto w-full max-w-6xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 mx-auto max-w-[90%] rounded-[60px] bg-gradient-to-r from-[#dfe9d6] via-[#fbfaf5] to-[#f3e4cf] opacity-80 blur-[80px]"
        />
        <div className="grid min-h-[640px] grid-cols-1 overflow-hidden rounded-[48px] border border-black/5 bg-[var(--auth-surface)] shadow-[0_35px_120px_rgba(28,37,18,0.25)] lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
          <div className="relative flex items-center justify-center bg-[var(--auth-surface)]">
            <div className="w-full max-w-[420px] px-4 py-10 sm:px-8 lg:px-10">
              {children}
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -left-8 bottom-10 hidden h-24 w-24 rounded-full bg-[#f3e4cf] opacity-80 blur-2xl lg:block"
            />
          </div>
          <div className="relative hidden overflow-hidden bg-neutral-900 lg:block lg:rounded-tl-[45px] lg:rounded-bl-[45px]">
            <div className="absolute inset-0" aria-hidden>
              <img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/45" />
            </div>
            <div className="absolute inset-0 border-l border-white/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-transparent" />
            <div className="absolute bottom-10 left-10 max-w-xs rounded-2xl bg-white/15 p-5 text-white backdrop-blur-md">
              <p className="text-sm tracking-wide">
                &ldquo;We design convivial spaces for bold hosts and their favorite people.&rdquo;
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">
                Ziv Collective · Since 2019
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
