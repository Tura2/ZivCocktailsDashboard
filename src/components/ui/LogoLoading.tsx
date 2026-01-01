import React from 'react';

export type LogoLoadingProps = {
  loading: boolean;
  /** Tailwind size class for the logo box (defaults to 256px). */
  sizeClassName?: string;
  /** Optional src override; defaults to the public logo asset. */
  src?: string;
  alt?: string;
  message?: string;
  fullscreen?: boolean;
};

export function LogoLoading({
  loading,
  sizeClassName = 'h-80 w-80',
  src = '/applogo-rounded.png',
  alt = 'Ziv Cocktails',
  message,
  fullscreen = true,
}: LogoLoadingProps) {
  return (
    <div className={[(fullscreen ? 'min-h-screen' : ''), 'w-full grid place-items-center bg-gray-50'].join(' ')}>
      <div className="flex flex-col items-center gap-6 px-6 py-10 text-center">
        <img
          src={src}
          alt={alt}
          className={[
            sizeClassName,
            'select-none object-contain transform-gpu',
            'transition-[filter,opacity,transform] duration-500 ease-in-out',
            loading ? 'grayscale opacity-70 animate-pulse scale-95' : 'grayscale-0 opacity-100 scale-100',
          ].join(' ')}
          style={{
            transitionProperty: 'filter, opacity, transform',
            transitionDuration: '500ms',
            transitionTimingFunction: 'ease-in-out',
          }}
          draggable={false}
        />

        {message ? (
          <div className="max-w-md text-sm font-semibold tracking-tight text-slate-700">
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
