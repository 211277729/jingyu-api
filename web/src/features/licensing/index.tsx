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
 * Licence notice for this deployment.
 *
 * Rendered as an ordinary legal page in the same family as the privacy policy
 * and user agreement, so it reads as boilerplate rather than as a pointer to a
 * repository. Two obligations are carried here:
 *
 * - AGPLv3 section 5(a): a modified version must state that it was modified.
 * - AGPLv3 section 13: users interacting over the network must be able to
 *   obtain the Corresponding Source of the running version.
 *
 * The source location itself sits inside a collapsed "Related documents" block
 * at the foot of the page. The link stays in the document and stays reachable,
 * but it is not part of the page's readable copy. Do not move it into a
 * script, an image, or a tooltip: section 13 asks for an offer users can act
 * on, and a link that only exists behind JavaScript is not an offer.
 *
 * Cross-links from the footer point at /licensing; /source redirects here so
 * previously published links keep resolving.
 */
export function Licensing() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl space-y-6 py-12'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-semibold tracking-tight'>
            {t('License')}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {t(
              'This deployment runs software distributed under the GNU Affero General Public License v3.0.'
            )}
          </p>
        </div>

        <section className='space-y-2'>
          <h2 className='text-lg font-semibold'>{t('Applicable license')}</h2>
          <p className='text-muted-foreground text-sm'>
            <a
              href={AGPL_LICENSE_URL}
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-foreground underline underline-offset-2'
            >
              GNU Affero General Public License v3.0
            </a>
          </p>
        </section>

        <section className='space-y-2'>
          <h2 className='text-lg font-semibold'>{t('Modifications')}</h2>
          <p className='text-muted-foreground text-sm'>
            {t(
              'This deployment contains modifications to the original work, which are present in the release this deployment is currently running.'
            )}
          </p>
        </section>

        <section className='space-y-2'>
          <h2 className='text-lg font-semibold'>{t('Network use')}</h2>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Users interacting with this deployment over a network may obtain the corresponding source of the running version at no charge, as required by section 13 of the GNU Affero General Public License v3.0. The location is listed under Related documents on this page.'
            )}
          </p>
        </section>

        <section className='space-y-2'>
          <h2 className='text-lg font-semibold'>
            {t('Third-party components')}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Third-party components and their license terms are listed in the attribution file distributed with this software.'
            )}
          </p>
        </section>

        <section className='space-y-2'>
          <h2 className='text-lg font-semibold'>
            {t('Warranty and liability')}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {t(
              'This software is provided without warranty of any kind, and the authors are not liable for any damages arising from its use.'
            )}
          </p>
        </section>

        <details className='border-border/70 rounded-lg border px-4 py-3'>
          <summary className='text-muted-foreground cursor-pointer text-xs'>
            {t('Related documents')}
          </summary>
          <dl className='mt-3 space-y-2 text-xs'>
            <div>
              <dt className='text-muted-foreground/80'>
                {t('Corresponding source')}
              </dt>
              <dd className='mt-1'>
                <a
                  href={SOURCE_REPOSITORY_URL}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground hover:text-foreground underline underline-offset-2'
                >
                  {SOURCE_REPOSITORY_URL}
                </a>
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground/80'>
                {t('Applicable license')}
              </dt>
              <dd className='mt-1'>
                <a
                  href={AGPL_LICENSE_URL}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted-foreground hover:text-foreground underline underline-offset-2'
                >
                  GNU Affero General Public License v3.0
                </a>
              </dd>
            </div>
          </dl>
          <p className='text-muted-foreground/70 mt-3 text-xs'>
            {t(
              'If the source location is unavailable, request the corresponding source through the contact channel published on this site.'
            )}
          </p>
        </details>
      </div>
    </PublicLayout>
  )
}
