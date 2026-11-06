import React from 'react';

/**
 * One Material Symbols glyph.
 *
 * The mockups are built on an icon font rather than an icon component library:
 * a glyph is chosen by typing its ligature name, so adding an icon is a string,
 * not an import. `src/app/globals.css` carries the ligature rules; this only
 * sets the size and the variable axes the screens rely on.
 */
interface SymbolProps {
  /** Ligature name as it appears in the Material Symbols catalogue, e.g. `fact_check`. */
  icon: string;
  /** Filled variant. Unfilled is the default reading; fill carries "selected". */
  fill?: boolean;
  /** Font size in pixels - the mockups size glyphs directly rather than by class. */
  size?: number;
  /** Optical weight axis (100-700). Defaults to the catalogue's regular 400. */
  weight?: number;
  className?: string;
  /**
   * Reads out to assistive tech. Omit it when the glyph sits beside its own
   * label, which is most of the time in these screens - a labelled button does
   * not need to announce its icon twice.
   */
  label?: string;
}

export function Icon({ icon, fill = false, size, weight = 400, className, label }: SymbolProps) {
  const style: React.CSSProperties & Record<'fontVariationSettings', string> = {
    fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size && size >= 48 ? 48 : 24}`,
  };
  if (size) style.fontSize = `${size}px`;

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      style={style}
      className={`material-symbols-outlined leading-none select-none${className ? ` ${className}` : ''}`}
    >
      {icon}
    </span>
  );
}
