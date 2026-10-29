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
import { BACKUP_CODE_REGEX, OTP_REGEX } from '../constants'

/**
 * Validation utilities for authentication forms
 */

// ============================================================================
// OTP Validation
// ============================================================================

/**
 * Validate OTP code (6 digits)
 */
export function isValidOTP(code: string): boolean {
  return OTP_REGEX.test(code)
}

/**
 * Validate backup code (XXXX-XXXX format)
 */
export function isValidBackupCode(code: string): boolean {
  return BACKUP_CODE_REGEX.test(code)
}

/**
 * Format backup code with hyphen (XXXX-XXXX)
 */
export function formatBackupCode(value: string): string {
  // Remove all non-alphanumeric characters and convert to uppercase
  let cleaned = value.toUpperCase().replaceAll(/[^A-Z0-9]/g, '')

  // Limit to 8 characters
  if (cleaned.length > 8) {
    cleaned = cleaned.slice(0, 8)
  }

  // Add hyphen after 4th character
  if (cleaned.length > 4) {
    return `${cleaned.slice(0, 4)  }-${  cleaned.slice(4)}`
  }

  return cleaned
}

/**
 * Remove hyphens from backup code before sending to server
 */
export function cleanBackupCode(code: string): string {
  return code.replaceAll(/-/g, '')
}

// ============================================================================
// Phone Number Validation
// ============================================================================

const PHONE_PATTERN = /^1[3-9]\d{9}$/
const PHONE_COUNTRY_PREFIX = /^(\+?86)/

/**
 * Strip the +86/86 country prefix and whitespace from a phone input
 */
export function normalizePhoneInput(value: string): string {
  return value.replace(PHONE_COUNTRY_PREFIX, '').replaceAll(/\s/g, '')
}

/**
 * Validate a mainland China phone number (accepts +86/86 prefix)
 */
export function isValidPhoneInput(value: string): boolean {
  return PHONE_PATTERN.test(normalizePhoneInput(value))
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Basic email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
