import { useState } from 'react';
import { speak, ttsSupported } from '@/lib/tts';
import { useSettings } from '@/store/settings';
import { cx } from '@/lib/util';
import { SpeakerIcon } from './ui';

export function SpeakButton({ text, className, size = 'md' }: { text: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const rate = useSettings((s) => s.ttsRate);
  const [busy, setBusy] = useState(false);
  if (!ttsSupported()) return null;
  const dim = { sm: 'h-7 w-7 [&_svg]:h-4 [&_svg]:w-4', md: 'h-9 w-9 [&_svg]:h-5 [&_svg]:w-5', lg: 'h-12 w-12 [&_svg]:h-6 [&_svg]:w-6' }[size];
  return (
    <button
      type="button"
      aria-label="朗读"
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        await speak(text, rate);
        setBusy(false);
      }}
      className={cx(
        'inline-flex items-center justify-center rounded-full text-brand-600 transition hover:bg-brand-50 active:bg-brand-100',
        busy && 'animate-pulse',
        dim,
        className,
      )}
    >
      <SpeakerIcon />
    </button>
  );
}
