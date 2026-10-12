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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { FAQ_ITEMS } from '../constants'

export function FaqList() {
  const { t } = useTranslation()

  return (
    <Accordion className='ring-foreground/10 rounded-xl px-4 ring-1 sm:px-5'>
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className='text-start hover:no-underline'>
            {t(item.questionKey)}
          </AccordionTrigger>
          <AccordionContent className='text-muted-foreground'>
            {t(item.answerKey)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
