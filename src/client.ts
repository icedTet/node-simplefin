// intent: intent/modules/client.md
// Public client: an Access URL in, normalized AccountSet data out.

import { parseAccessUrl, type AccessUrl } from './access-url';
import { requestJson, type RequestOptions } from './http';
import { normalizeV1 } from './normalize';
import type { AccountSet } from './types';

export interface GetAccountsOptions {
  /** Inclusive lower bound (transactions `posted` on/after). */
  startDate?: Date | number;
  /** Exclusive upper bound. */
  endDate?: Date | number;
  /** Include pending transactions. False/undefined omits the param entirely —
   *  the live bridge treats presence, not value (intent/maps/external.md). */
  pending?: boolean;
  /** Filter to account id(s); may repeat. */
  account?: string | readonly string[];
}

export type ClientOptions = RequestOptions;

export class SimplefinClient {
  readonly access: AccessUrl;
  private readonly options: ClientOptions;

  /** @param accessUrl an Access URL with embedded credentials (from `claim()`). */
  constructor(accessUrl: string | AccessUrl, options: ClientOptions = {}) {
    this.access = typeof accessUrl === 'string' ? parseAccessUrl(accessUrl) : accessUrl;
    this.options = options;
  }

  async getAccounts(getOptions: GetAccountsOptions = {}): Promise<AccountSet> {
    const query = new URLSearchParams();
    if (getOptions.startDate !== undefined) {
      query.set('start-date', String(toUnixSeconds(getOptions.startDate)));
    }
    if (getOptions.endDate !== undefined) {
      query.set('end-date', String(toUnixSeconds(getOptions.endDate)));
    }
    if (getOptions.pending === true) query.set('pending', '1');
    for (const id of typeof getOptions.account === 'string'
      ? [getOptions.account]
      : (getOptions.account ?? [])) {
      query.append('account', id);
    }
    const body = await requestJson<unknown>(this.access, 'accounts', query, this.options);
    return normalizeV1(body);
  }
}

function toUnixSeconds(value: Date | number): number {
  return typeof value === 'number' ? Math.floor(value) : Math.floor(value.getTime() / 1000);
}
