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

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export interface WxPaySettingsValues {
  WxPayEnabled: boolean
  WxPayAppId: string
  WxPayMchId: string
  WxPayMchApiV3Key: string
  WxPaySerialNo: string
  WxPayPrivateKey: string
  WxPayNotifyUrl: string
  WxPayUnitPrice: number
  WxPayMinTopUp: number
  WxPayCurrency: string
  WxPayDescription: string
  WxPayPublicKeyID: string
  WxPayPublicKey: string
}

interface Props {
  values: WxPaySettingsValues
  onValueChange: <K extends keyof WxPaySettingsValues>(
    key: K,
    value: WxPaySettingsValues[K]
  ) => void
}

/**
 * Official WeChat Pay (Native QR) settings. All credential fields are
 * required once the gateway is enabled; the notify URL may stay blank to
 * derive from the server address.
 */
export function WxPaySettingsSection(props: Props) {
  const { t } = useTranslation()
  const { values } = props

  return (
    <div className='space-y-4 pt-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('WeChat Pay (Official)')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'WeChat Pay APIv3 Native QR payments with your own merchant account. Settlement is in CNY.'
          )}
        </p>
      </div>

      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Fill in the merchant credentials from the WeChat Pay merchant platform: AppID, merchant ID, APIv3 key, certificate serial number, and the merchant private key (apiclient_key.pem).'
          )}
        </AlertDescription>
      </Alert>
      <Alert>
        <AlertDescription className='text-xs'>
          {t('Webhook URL:')}{' '}
          <code className='rounded bg-muted px-1 py-0.5 text-xs'>
            {'<ServerAddress>/api/user/wxpay/notify'}
          </code>
        </AlertDescription>
      </Alert>

      <div className='bg-muted/20 flex items-center justify-between gap-4 rounded-xl border px-4 py-3'>
        <div className='min-w-0'>
          <Label className='text-sm font-medium'>
            {t('Enable WeChat Pay')}
          </Label>
          <p className='text-muted-foreground text-xs'>
            {t(
              'All credential fields below are required once enabled; the wallet shows WeChat Pay only when they are complete.'
            )}
          </p>
        </div>
        <Switch
          aria-label={t('Enable WeChat Pay')}
          checked={values.WxPayEnabled}
          onCheckedChange={(v) => props.onValueChange('WxPayEnabled', v)}
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label required>{t('AppID')}</Label>
          <Input
            placeholder='wx1234567890abcdef'
            value={values.WxPayAppId}
            onChange={(event) =>
              props.onValueChange('WxPayAppId', event.target.value)
            }
          />
        </div>
        <div className='grid gap-1.5'>
          <Label required>{t('Merchant ID')}</Label>
          <Input
            placeholder='1900000000'
            value={values.WxPayMchId}
            onChange={(event) =>
              props.onValueChange('WxPayMchId', event.target.value)
            }
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label required>{t('APIv3 Key')}</Label>
          <Input
            type='password'
            placeholder={t('Enter new key to update')}
            autoComplete='new-password'
            value={values.WxPayMchApiV3Key}
            onChange={(event) =>
              props.onValueChange('WxPayMchApiV3Key', event.target.value)
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t(
              'Used to decrypt webhook payloads in both credential modes.'
            )}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label required>{t('Certificate Serial Number')}</Label>
          <Input
            placeholder='5157F09EFDC096DE15EBE81A47057A72...'
            value={values.WxPaySerialNo}
            onChange={(event) =>
              props.onValueChange('WxPaySerialNo', event.target.value)
            }
          />
        </div>
      </div>

      <div className='rounded-lg border border-dashed p-3'>
        <p className='text-muted-foreground mb-2 text-xs'>
          {t(
            'Public key mode (recommended for new merchant accounts): fill in both fields below to verify callbacks with the WeChat Pay public key instead of the legacy platform certificate. Leave them blank to use the platform certificate mode.'
          )}
        </p>
        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('WeChat Pay Public Key ID')}</Label>
            <Input
              placeholder='PUB_KEY_ID_3000000000000000000000000000000'
              value={values.WxPayPublicKeyID}
              onChange={(event) =>
                props.onValueChange('WxPayPublicKeyID', event.target.value)
              }
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('WeChat Pay Public Key')}</Label>
            <Textarea
              rows={3}
              className='font-mono text-xs'
              placeholder={
                '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'
              }
              value={values.WxPayPublicKey}
              onChange={(event) =>
                props.onValueChange('WxPayPublicKey', event.target.value)
              }
            />
          </div>
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label required>{t('Merchant Private Key (apiclient_key.pem)')}</Label>
        <Textarea
          rows={4}
          className='font-mono text-xs'
          placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
          value={values.WxPayPrivateKey}
          onChange={(event) =>
            props.onValueChange('WxPayPrivateKey', event.target.value)
          }
        />
      </div>

      <div className='grid gap-1.5'>
        <Label>{t('Callback notification URL')}</Label>
        <Input
          placeholder='https://example.com/api/user/wxpay/notify'
          value={values.WxPayNotifyUrl}
          onChange={(event) =>
            props.onValueChange('WxPayNotifyUrl', event.target.value)
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'Leave blank to use the server address. Must be a public HTTPS URL reachable by WeChat Pay.'
          )}
        </p>
      </div>

      <Separator />

      <div className='grid grid-cols-3 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Unit price (CNY)')}</Label>
          <Input
            type='number'
            step={0.1}
            min={0}
            value={values.WxPayUnitPrice}
            onChange={(event) =>
              props.onValueChange(
                'WxPayUnitPrice',
                event.target.value === '' ? 0 : event.target.valueAsNumber
              )
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('How much CNY to charge per USD of balance')}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Minimum top-up quantity')}</Label>
          <Input
            type='number'
            min={1}
            value={values.WxPayMinTopUp}
            onChange={(event) =>
              props.onValueChange(
                'WxPayMinTopUp',
                event.target.value === '' ? 1 : event.target.valueAsNumber
              )
            }
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Order description')}</Label>
          <Input
            placeholder='Balance top-up'
            value={values.WxPayDescription}
            onChange={(event) =>
              props.onValueChange('WxPayDescription', event.target.value)
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('Shown to the payer inside WeChat')}
          </p>
        </div>
      </div>
    </div>
  )
}
