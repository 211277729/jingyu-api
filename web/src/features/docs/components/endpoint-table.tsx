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
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type EndpointRow = {
  method: string
  path: string
  protocol: string
  auth: string
  purpose: string
}

export function EndpointTable(props: { rows: EndpointRow[] }) {
  const { t } = useTranslation()

  return (
    <div className='overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/10'>
      <Table>
        <TableHeader>
          <TableRow className='border-white/10 hover:bg-transparent'>
            <TableHead className='text-zinc-400'>{t('Endpoint')}</TableHead>
            <TableHead className='text-zinc-400'>{t('Protocol')}</TableHead>
            <TableHead className='text-zinc-400'>
              {t('Authorization')}
            </TableHead>
            <TableHead className='text-zinc-400'>{t('Purpose')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow
              key={`${row.method} ${row.path}`}
              className='border-white/10 hover:bg-white/[0.04]'
            >
              <TableCell className='font-mono text-xs'>
                <span
                  className={
                    row.method === 'GET' ? 'text-cyan-300' : 'text-violet-300'
                  }
                >
                  {row.method}
                </span>{' '}
                <span className='text-zinc-100'>{row.path}</span>
              </TableCell>
              <TableCell className='text-zinc-300'>{row.protocol}</TableCell>
              <TableCell className='font-mono text-xs text-zinc-400'>
                {row.auth}
              </TableCell>
              <TableCell
                className='whitespace-normal text-zinc-400'
                data-table-text='secondary'
              >
                {row.purpose}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
