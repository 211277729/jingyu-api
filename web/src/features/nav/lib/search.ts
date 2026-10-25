import type { NavCategory, NavSite } from '../types'
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
 * Fuzzy matching for the directory search box.
 *
 * Matching is deliberately forgiving: a direct hit on a name or host ranks
 * first, an infix hit ranks next, and an in-order character match ("gpt4o"
 * matching "GPT-4o", or 绘图 matching 智能绘图工具) still counts so a partial
 * keyword finds the category or card it belongs to.
 */
import { categoryElementId, siteElementId } from './anchors'

export type NavSiteHit = {
  kind: 'site'
  key: string
  categoryId: string
  categoryLabelKey: string
  site: NavSite
}

export type NavCategoryHit = {
  kind: 'category'
  key: string
  categoryId: string
  labelKey: string
}

export type NavSearchHit = NavSiteHit | NavCategoryHit

type Translate = (key: string) => string

const SCORE_EXACT = 100
const SCORE_PREFIX = 80
const SCORE_INFIX = 60
const SCORE_SUBSEQUENCE = 30

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** True when every character of `needle` appears in `haystack`, in order. */
function isSubsequence(haystack: string, needle: string): boolean {
  let cursor = 0
  for (const char of haystack) {
    if (char === needle[cursor]) cursor++
    if (cursor === needle.length) return true
  }
  return needle.length === 0
}

function scoreText(haystack: string, needle: string): number {
  if (haystack === needle) return SCORE_EXACT
  if (haystack.startsWith(needle)) return SCORE_PREFIX
  if (haystack.includes(needle)) return SCORE_INFIX
  if (needle.length > 1 && isSubsequence(haystack, needle)) {
    return SCORE_SUBSEQUENCE
  }
  return 0
}

/**
 * Anchor a hit scrolls to: the section for a category, the card for a site.
 */
export function hitAnchorId(hit: NavSearchHit): string {
  return hit.kind === 'category'
    ? categoryElementId(hit.categoryId)
    : siteElementId(hit.site.url)
}

/**
 * Ranked matches for a query. Category hits come first so typing a workflow
 * word slides to the section before it slides to a single card.
 */
export function searchDirectory(
  categories: NavCategory[],
  rawQuery: string,
  translate: Translate
): NavSearchHit[] {
  const query = normalize(rawQuery)
  if (!query) return []

  const categoryHits: { hit: NavCategoryHit; score: number }[] = []
  const siteHits: { hit: NavSiteHit; score: number }[] = []

  for (const category of categories) {
    const label = normalize(translate(category.labelKey))
    const labelKey = normalize(category.labelKey)
    const categoryScore = Math.max(
      scoreText(label, query),
      scoreText(labelKey, query)
    )
    if (categoryScore > 0) {
      categoryHits.push({
        hit: {
          kind: 'category',
          key: `category:${category.id}`,
          categoryId: category.id,
          labelKey: category.labelKey,
        },
        score: categoryScore,
      })
    }

    for (const site of category.sites) {
      const nameScore = scoreText(normalize(site.name), query)
      const hostScore = scoreText(hostOf(site.url), query)
      // a name hit outranks the same hit found only in the hostname
      const score = Math.max(nameScore, hostScore > 0 ? hostScore - 5 : 0)
      if (score > 0) {
        siteHits.push({
          hit: {
            kind: 'site',
            key: `site:${hostOf(site.url)}`,
            categoryId: category.id,
            categoryLabelKey: category.labelKey,
            site,
          },
          score,
        })
      }
    }
  }

  categoryHits.sort((a, b) => b.score - a.score)
  siteHits.sort(
    (a, b) =>
      b.score - a.score || a.hit.site.name.localeCompare(b.hit.site.name)
  )

  return [...categoryHits, ...siteHits].map((entry) => entry.hit)
}
