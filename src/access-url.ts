// intent: intent/modules/access-url.md
// Access URL parsing: credentials live in the Authorization header, never in request URLs
// (Node's fetch rejects userinfo; see intent/maps/external.md).

import { InvalidAccessUrlError } from './errors';

export interface AccessUrl {
  /** API root as a URL without credentials, e.g. https://host/simplefin/ */
  readonly root: URL;
  readonly username: string;
  readonly password: string;
  /** Redacted form safe to log/display. */
  readonly href: string;
}

function decodeComponent(component: string, label: string): string {
  try {
    return decodeURIComponent(component);
  } catch {
    throw new InvalidAccessUrlError(`Invalid access URL: ${label} has bad percent-encoding`);
  }
}

/** Parses `https://id:key@host[/path]` into an {@link AccessUrl}.
 * @throws {InvalidAccessUrlError} for relative, non-https, credential-less, or
 * malformed-percent inputs. */
export function parseAccessUrl(value: string): AccessUrl {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new InvalidAccessUrlError('Invalid access URL: not an absolute URL');
  }
  if (url.protocol !== 'https:') {
    throw new InvalidAccessUrlError('Insecure access URL: only https: endpoints are allowed');
  }
  if (!url.username || !url.password) {
    throw new InvalidAccessUrlError('Invalid access URL: credentials (id:key) must be embedded');
  }
  const root = new URL(url.href);
  root.username = '';
  root.password = '';
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  return {
    root,
    username: decodeComponent(url.username, 'username'),
    password: decodeComponent(url.password, 'password'),
    href: `${root.protocol}//${root.host}${root.pathname}`,
  };
}
