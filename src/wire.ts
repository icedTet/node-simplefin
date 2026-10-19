// intent: intent/modules/wire.md
// Error/passthrough helpers shared by the transport layer and the normalizers.
// Display extraction is lenient; structured projection is strict on required fields
// and sanitizing on optional ones. Traces: intent/maps/external.md.

import type { ProtocolError } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWireErrorEntry(value: unknown): value is Record<string, unknown> & {
  code: string;
  msg: string;
} {
  return isRecord(value) && typeof value.code === 'string' && typeof value.msg === 'string';
}

/** Structured protocol errors from an `errlist` array; malformed optional link fields
 *  (conn_id/account_id) are sanitized to absent rather than dropping the entry. */
export function projectErrlist(list: unknown): ProtocolError[] {
  if (!Array.isArray(list)) return [];
  const out: ProtocolError[] = [];
  for (const entry of list) {
    if (!isWireErrorEntry(entry)) continue;
    out.push({
      code: entry.code,
      msg: entry.msg,
      ...(typeof entry.conn_id === 'string' ? { connId: entry.conn_id } : {}),
      ...(typeof entry.account_id === 'string' ? { accountId: entry.account_id } : {}),
    });
  }
  return out;
}

/** User-facing strings from a protocol error body: legacy `errors` entries plus every
 *  errlist msg, order-preserved and deduplicated. */
export function collectErrorMessages(body: Record<string, unknown>): string[] {
  const strings: string[] = [];
  if (Array.isArray(body.errors))
    strings.push(...body.errors.filter((e): e is string => typeof e === 'string'));
  strings.push(...projectErrlist(body.errlist).map((entry) => entry.msg));
  return [...new Set(strings)];
}

/** `x-api-message`: undocumented info strings; keep the string entries we can show. */
export function projectXApiMessage(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((v): v is string => typeof v === 'string');
  return strings.length > 0 ? strings : undefined;
}
