"use client";

type Props = {
  items: string[];
  onPick: (command: string) => void;
  disabled?: boolean;
};

export function SuggestionChips({ items, onPick, disabled = false }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPick(item)}
          disabled={disabled}
          className="rounded-full border border-ink-600 bg-ink-850/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-brand-500 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
