/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * Directory search field.
 *
 * Owns the query, the ranking and the keyboard model; the page decides what a
 * preview (auto scroll while typing) and a selection (jump and flash) mean.
 */
import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { searchDirectory, type NavSearchHit } from "../lib/search";
import type { NavCategory } from "../types";

const VISIBLE_RESULTS = 8;
const PREVIEW_DELAY_MS = 260;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function NavSearch(props: {
  categories: NavCategory[];
  onPreview: (hit: NavSearchHit | null) => void;
  onSelect: (hit: NavSearchHit) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The page mounts one search per breakpoint; only the visible one may take
  // the "/" shortcut, and aria ids must not collide between instances.
  const instanceId = useId();
  const listboxId = `nav-search-results-${instanceId}`;
  const optionId = (index: number) =>
    `nav-search-option-${instanceId}-${index}`;

  // "/" anywhere on the page jumps into the search field, command-palette style.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (isTypingTarget(event.target)) return;
      // Skip hidden twin instances (the page keeps one per breakpoint).
      if (!inputRef.current || inputRef.current.offsetParent === null) return;
      event.preventDefault();
      inputRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const hits = useMemo(
    () => searchDirectory(props.categories, query, t),
    [props.categories, query, t],
  );
  const visibleHits = hits.slice(0, VISIBLE_RESULTS);

  // Debounced preview: typing slides the page to the best match without
  // waiting for Enter, but a fast typist never triggers a scroll storm.
  const { onPreview } = props;
  useEffect(() => {
    if (!query.trim()) {
      onPreview(null);
      return;
    }

    const timer = window.setTimeout(() => {
      onPreview(hits[0] ?? null);
    }, PREVIEW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [query, hits, onPreview]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function select(hit: NavSearchHit) {
    props.onSelect(hit);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (query) {
        setQuery("");
        props.onPreview(null);
      }
      setOpen(false);
      return;
    }

    if (!visibleHits.length) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => {
        const delta = event.key === "ArrowDown" ? 1 : -1;
        return (index + delta + visibleHits.length) % visibleHits.length;
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      select(visibleHits[activeIndex] ?? visibleHits[0]);
    }
  }

  const activeHit = visibleHits[activeIndex];

  return (
    <div className={cn("group relative", props.className)} ref={rootRef}>
      <SearchIcon
        aria-hidden="true"
        size={16}
        className="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute start-4 top-1/2 z-10 -translate-y-1/2 transition-colors"
      />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        role="combobox"
        aria-expanded={open && query.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeHit ? optionId(activeIndex) : undefined
        }
        aria-label={t("Search the directory")}
        placeholder={t("Search tools, categories or sites")}
        className="bg-background/60 focus-visible:border-primary/40 focus-visible:ring-primary/30 focus-visible:shadow-primary/20 dark:bg-background/40 h-12 rounded-xl border-border/60 pr-12 pl-11 text-sm backdrop-blur-sm transition-[color,box-shadow,border-color] shadow-sm focus-visible:shadow-lg [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {query ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Clear search")}
          className="text-muted-foreground hover:text-foreground absolute end-1.5 top-1/2 size-8 -translate-y-1/2"
          onClick={() => {
            setQuery("");
            setActiveIndex(0);
            props.onPreview(null);
          }}
        >
          <XIcon aria-hidden="true" size={14} />
        </Button>
      ) : (
        <kbd
          aria-hidden="true"
          className={cn(
            "border-border/70 bg-muted/50 text-muted-foreground/70 pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none transition-opacity",
            focused ? "opacity-0" : "opacity-100",
          )}
        >
          /
        </kbd>
      )}

      {open && query.trim() ? (
        <div className="bg-popover/95 ring-border/70 absolute inset-x-0 top-[calc(100%+0.625rem)] z-40 overflow-hidden rounded-xl shadow-xl shadow-black/10 ring-1 backdrop-blur-md dark:shadow-black/40">
          {visibleHits.length ? (
            <>
              <ul
                id={listboxId}
                role="listbox"
                aria-label={t("Search results")}
                className="max-h-80 overflow-y-auto py-1"
              >
                {visibleHits.map((hit, index) => (
                  <li key={hit.key}>
                    <button
                      type="button"
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(hit)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors",
                        index === activeIndex
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <span className="text-muted-foreground/70 w-10 shrink-0 text-[11px]">
                        {hit.kind === "category" ? t("Category") : t("Site")}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {hit.kind === "category"
                          ? t(hit.labelKey)
                          : hit.site.name}
                      </span>
                      {hit.kind === "site" ? (
                        <span className="text-muted-foreground/60 max-w-36 truncate text-xs">
                          {t(hit.categoryLabelKey)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground/60 border-border/50 border-t px-3 py-1.5 text-[11px]">
                {t("{{count}} matches", { count: hits.length })}
                {hits.length > visibleHits.length ? (
                  <span aria-hidden> · </span>
                ) : null}
                {hits.length > visibleHits.length
                  ? t("Press Enter to jump to the best match")
                  : null}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground px-3 py-3 text-sm">
              {t("No matching tools")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
