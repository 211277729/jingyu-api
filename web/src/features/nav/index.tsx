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
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PublicLayout } from "@/components/layout";
import { PageTransition } from "@/components/page-transition";
import { cn } from "@/lib/utils";

import {
  BackToTopButton,
  CategoryNav,
  NavSearch,
  SiteCard,
} from "./components";
import { NAV_CATEGORIES, NAV_SITE_COUNT } from "./constants";
import {
  categoryElementId,
  scrollToAnchor,
  siteElementId,
} from "./lib/anchors";
import { hitAnchorId, type NavSearchHit } from "./lib/search";

const HIGHLIGHT_MS = 2400;

export function NavDirectory() {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(NAV_CATEGORIES[0].id);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);

  // Scroll to a match and flash it so the jump is visible, not just a landing.
  const focusAnchor = useCallback((anchorId: string) => {
    scrollToAnchor(anchorId);
    setHighlightId(anchorId);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => {
      setHighlightId(null);
      highlightTimer.current = null;
    }, HIGHLIGHT_MS);
  }, []);

  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    },
    [],
  );

  const handlePreview = useCallback(
    (hit: NavSearchHit | null) => {
      if (hit) focusAnchor(hitAnchorId(hit));
    },
    [focusAnchor],
  );

  const handleSelect = useCallback(
    (hit: NavSearchHit) => focusAnchor(hitAnchorId(hit)),
    [focusAnchor],
  );

  // Highlight the category whose section currently owns the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id.replace("nav-category-", ""));
        }
      },
      // Top boundary = fixed header (60px) + the pinned mobile chip strip
      // (~68px), so a section's tail scrolling out never wins the highlight.
      { rootMargin: "-136px 0px -55% 0px" },
    );

    NAV_CATEGORIES.forEach((category) => {
      const section = document.querySelector(
        `#${CSS.escape(categoryElementId(category.id))}`,
      );
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <PublicLayout showMainContainer={false}>
      <div className="relative overflow-x-clip">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        >
          {/* Fine tech grid, fading out before the fold. */}
          <div
            className="absolute inset-0 opacity-[0.12] dark:opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, oklch(0.65 0.12 245 / 70%) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.65 0.12 245 / 70%) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 75% 65% at 50% 0%, black 25%, transparent 78%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 75% 65% at 50% 0%, black 25%, transparent 78%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-20 dark:opacity-[0.10]"
            style={{
              background: [
                "radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)",
                "radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)",
              ].join(", "),
              maskImage:
                "linear-gradient(to bottom, black 40%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 40%, transparent 100%)",
            }}
          />
        </div>

        <PageTransition className="relative mx-auto w-[92%] max-w-[1440px] pt-16 pb-16 sm:pt-20 lg:w-[80%]">
          <header className="space-y-4">
            <p className="text-primary/80 flex items-center gap-2 font-mono text-[11px] tracking-[0.32em] uppercase">
              <span
                aria-hidden
                className="bg-primary/70 motion-safe:animate-pulse size-1.5 rounded-full"
              />
              AI Directory
            </p>
            <h1 className="bg-gradient-to-r from-foreground via-foreground to-primary/70 bg-clip-text text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.12] font-bold tracking-tight text-transparent">
              {t("AI Navigation")}
            </h1>
            <p className="text-muted-foreground/80 max-w-2xl text-sm">
              {t(
                "A curated directory of AI tools, models and communities, grouped by what you want to get done.",
              )}
            </p>
            <div className="text-muted-foreground/70 flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="border-border/60 bg-muted/30 rounded-md border px-2 py-0.5 tabular-nums">
                {t("{{categories}} categories", {
                  categories: NAV_CATEGORIES.length,
                })}
              </span>
              <span className="border-border/60 bg-muted/30 rounded-md border px-2 py-0.5 tabular-nums">
                {t("{{sites}} sites", { sites: NAV_SITE_COUNT })}
              </span>
            </div>
          </header>

          {/* Mobile: hero search only — the category strip below stays pinned
              while scrolling, so switching never needs a trip back up. */}
          <div className="mt-8 flex justify-center lg:hidden">
            <NavSearch
              categories={NAV_CATEGORIES}
              onPreview={handlePreview}
              onSelect={handleSelect}
              className="w-full max-w-2xl"
            />
          </div>

          <div className="mt-6 flex flex-col gap-8 lg:mt-12 lg:flex-row lg:gap-10">
            {/* Desktop: search + categories share one sticky rail, the classic
                directory/docs layout. */}
            <aside className="hidden w-60 shrink-0 lg:block">
              <div className="lg:sticky lg:top-24 space-y-5">
                <NavSearch
                  categories={NAV_CATEGORIES}
                  onPreview={handlePreview}
                  onSelect={handleSelect}
                  className="w-full"
                />
                <CategoryNav
                  categories={NAV_CATEGORIES}
                  activeId={activeId}
                  variant="rail"
                />
              </div>
            </aside>

            {/* Mobile: pinned chip strip under the floating header pill.
                Full-bleed solid band so cards sliding underneath are fully
                covered instead of peeking around a floating pill. */}
            <div className="min-w-0 flex-1">
              <div className="border-border/40 bg-background sticky top-15 z-30 -mx-[calc(50vw-50%)] border-y px-[calc(50vw-50%)] py-2 shadow-[0_10px_20px_-16px_rgba(0,0,0,0.35)] lg:hidden">
                <CategoryNav
                  categories={NAV_CATEGORIES}
                  activeId={activeId}
                  variant="chips"
                />
              </div>

              <div className="space-y-10 pt-4 lg:pt-0">
                {NAV_CATEGORIES.map((category, categoryIndex) => {
                  const sectionId = categoryElementId(category.id);
                  const categoryHighlighted = highlightId === sectionId;

                  return (
                    <section
                      key={category.id}
                      id={sectionId}
                      className={cn(
                        "scroll-mt-40 rounded-2xl transition-colors duration-300",
                        categoryHighlighted &&
                          "bg-primary/5 ring-primary/20 -m-2 p-2 ring-1",
                      )}
                    >
                      <div className="border-border/50 mb-4 flex items-center gap-2.5 border-b pb-2.5">
                        <span
                          aria-hidden
                          className="text-primary/60 font-mono text-[11px] tabular-nums"
                        >
                          {String(categoryIndex + 1).padStart(2, "0")}
                        </span>
                        <h2 className="text-base font-semibold tracking-tight">
                          {t(category.labelKey)}
                        </h2>
                        <span
                          aria-hidden
                          className="from-primary/30 h-px flex-1 bg-gradient-to-r to-transparent"
                        />
                        <span className="text-muted-foreground/70 font-mono text-xs tabular-nums">
                          {category.sites.length}
                        </span>
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {category.sites.map((site) => (
                          <SiteCard
                            key={`${category.id}:${site.url}`}
                            site={site}
                            highlighted={
                              highlightId === siteElementId(site.url)
                            }
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </PageTransition>
        <BackToTopButton />
      </div>
    </PublicLayout>
  );
}
