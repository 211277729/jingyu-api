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
export type NavSite = {
  name: string
  url: string
  /**
   * `@lobehub/icons` name. Without one, the card renders an initial badge, so
   * a site never needs a remotely hosted logo.
   */
  iconName?: string
}

export type NavCategory = {
  /** Stable anchor used by the category list and the section scroll target. */
  id: string
  /** i18n key of the category label. */
  labelKey: string
  sites: NavSite[]
}
