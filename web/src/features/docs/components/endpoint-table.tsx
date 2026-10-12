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
    <div className='ring-foreground/10 overflow-hidden rounded-xl ring-1'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Endpoint')}</TableHead>
            <TableHead>{t('Protocol')}</TableHead>
            <TableHead>{t('Authorization')}</TableHead>
            <TableHead>{t('Purpose')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={`${row.method} ${row.path}`}>
              <TableCell className='font-mono text-xs'>
                <span className='text-muted-foreground'>{row.method}</span>{' '}
                {row.path}
              </TableCell>
              <TableCell>{row.protocol}</TableCell>
              <TableCell className='text-muted-foreground font-mono text-xs'>
                {row.auth}
              </TableCell>
              <TableCell
                className='whitespace-normal'
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
