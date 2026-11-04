import { BadRequestException } from '@nestjs/common';

/** Supabase returns phone identifiers as country code + digits; store the same form without '+'. */
export function normalizePhoneForStorage(value: string): string {
  const input = value.trim();
  const digits = input.replace(/\D/g, '');
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^57\d{10}$/.test(digits)) return digits;
  if (/^\+[1-9]\d{7,14}$/.test(input)) return digits;
  throw new BadRequestException('Escribe un celular colombiano de 10 dígitos o un número internacional con código de país');
}

/** Phone values accepted by older profiles and by Supabase responses. */
export function phoneLookupValues(value: string): string[] {
  const normalized = normalizePhoneForStorage(value);
  return [normalized, `+${normalized}`];
}

/** Supabase Auth's admin API expects phone identifiers in E.164 form. */
export function toSupabasePhone(value: string): string {
  const normalized = normalizePhoneForStorage(value);
  return `+${normalized}`;
}
