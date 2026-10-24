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

import { PublicLayout } from '@/components/layout'
import { AGPL_LICENSE_URL, SOURCE_REPOSITORY_URL } from '@/lib/constants'

/**
 * Standing source offer required by AGPLv3 section 13.
 *
 * Deliberately plain and reachable only from the footer attribution row: the
 * offer has to stay available and honest, but it does not have to advertise
 * itself to every visitor. Not linked from navigation and kept out of search
 * indexes so the repository is not the first thing a crawler picks up.
 */
export function SourceNotice() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <meta name='robots' content='noindex, nofollow' />
      <div className='mx-auto max-w-2xl py-10 text-sm leading-relaxed'>
        <h1 className='text-base font-semibold'>{t('License & source')}</h1>

        <p className='text-muted-foreground mt-3'>
          {t(
            'This site runs a modified version of New API and provides the corresponding source to its users as required by AGPLv3 section 13.'
          )}
        </p>

        <dl className='mt-6 space-y-3'>
          <div>
            <dt className='text-muted-foreground/80'>
              {t('Source repository')}
            </dt>
            <dd className='mt-1'>
              <a
                href={SOURCE_REPOSITORY_URL}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground underline underline-offset-2 hover:text-foreground'
              >
                {SOURCE_REPOSITORY_URL}
              </a>
            </dd>
          </div>
          <div>
            <dt className='text-muted-foreground/80'>{t('License')}</dt>
            <dd className='mt-1'>
              <a
                href={AGPL_LICENSE_URL}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground underline underline-offset-2 hover:text-foreground'
              >
                GNU Affero General Public License v3.0
              </a>
            </dd>
          </div>
        </dl>

        <p className='text-muted-foreground/70 mt-6 text-xs'>
          {t(
            'The source offered here is the version this site is running. If the repository is unavailable, request the corresponding source through the contact channel published on this site.'
          )}
        </p>
      </div>
    </PublicLayout>
  )
}
