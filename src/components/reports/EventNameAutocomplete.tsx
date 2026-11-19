'use client';

import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

type EventOption = { id: string; event_name: string; event_date: string };

type EventNameAutocompleteProps = {
  divisionId: string | null;
  value: string;
  onChange: (value: string) => void;
  onSelect: (event: EventOption) => void;
  inputClassName: string;
  labelClassName?: string;
};

export function EventNameAutocomplete({
  divisionId,
  value,
  onChange,
  onSelect,
  inputClassName,
  labelClassName = 'block text-label-md text-on-surface',
}: EventNameAutocompleteProps) {
  const inputId = useId();
  const listId = useId();
  const [results, setResults] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const search = value.trim();
    if (!divisionId || !search) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
      const { data, error: searchError } = await createClient()
        .from('muster_events')
        .select('id,event_name,event_date')
        .eq('division_id', divisionId)
        .ilike('event_name', `${escapedSearch}%`)
        .order('event_date', { ascending: false })
        .limit(8);

      if (!active) return;
      if (searchError) {
        setResults([]);
        setError('Could not search events. You can still enter the event name.');
      } else {
        setResults((data ?? []) as EventOption[]);
      }
      setLoading(false);
      setActiveIndex(0);
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [divisionId, value]);

  function chooseEvent(event: EventOption) {
    onChange(event.event_name);
    onSelect(event);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && isOpen && results[activeIndex]) {
      event.preventDefault();
      chooseEvent(results[activeIndex]);
    }
  }

  const showResults = isOpen && value.trim().length > 0;

  return (
    <label htmlFor={inputId} className={labelClassName}>
      Event / duty name
      <div className="relative">
        <input
          id={inputId}
          required
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-activedescendant={showResults && results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 100)}
          onKeyDown={handleKeyDown}
          maxLength={140}
          placeholder="Start typing an event name"
          className={inputClassName}
        />
        {showResults && (
          <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-lg">
            {loading ? (
              <li className="px-3 py-2 text-sm text-on-surface-variant" role="status">Searching events…</li>
            ) : results.length ? results.map((event, index) => (
              <li key={event.id} role="presentation">
                <button
                  id={`${listId}-${event.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseEvent(event)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-surface-container' : 'hover:bg-surface-container'}`}
                >
                  <span className="truncate font-medium text-on-surface">{event.event_name}</span>
                  <span className="shrink-0 text-xs text-on-surface-variant">
                    {new Date(`${event.event_date}T00:00:00`).toLocaleDateString('en-IN')}
                  </span>
                </button>
              </li>
            )) : (
              <li className="px-3 py-2 text-sm text-on-surface-variant">
                {error || 'No matching events. You can still enter a new event name.'}
              </li>
            )}
          </ul>
        )}
      </div>
    </label>
  );
}
