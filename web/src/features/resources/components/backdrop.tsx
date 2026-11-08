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
 * 广场 / 详情页共用的静态背景：细网格 + 三团极光晕。
 * 全部为一次性绘制，不参与动画，遵守"静态背景性能红线"。
 */
export function ResourceBackdrop() {
  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden'
    >
      <div
        className='absolute inset-0 opacity-[0.5] dark:opacity-100'
        style={{
          backgroundImage: [
            'linear-gradient(to right, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px)',
            'linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      <div
        className='absolute inset-0 opacity-25 dark:opacity-40'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 18% 8%, color-mix(in oklch, var(--chart-1) 70%, transparent) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 38% at 82% 4%, color-mix(in oklch, var(--chart-4) 55%, transparent) 0%, transparent 70%)',
            'radial-gradient(ellipse 60% 40% at 50% 30%, color-mix(in oklch, var(--chart-3) 40%, transparent) 0%, transparent 75%)',
          ].join(', '),
          maskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 45%, transparent 100%)',
        }}
      />
    </div>
  )
}
