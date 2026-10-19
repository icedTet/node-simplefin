// intent: intent/modules/access-url.md
// Access URL parsing: credentials live in the Authorization header, never in request URLs
// (Node's fetch rejects userinfo; see intent/maps/external.md).

export interface AccessUrl {
  /** API root as a URL without credentials, e.g. https://host/simplefin/ */
  readonly root: URL;
  readonly username: string;
  readonly password: string;
  /** Redacted form safe to log/display. */
  readonly href: string;
}

/** Parses `https://id:key@host[/path]` into an {@link AccessUrl}. */
export function parseAccessUrl(value: string): AccessUrl {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new TypeError('Invalid access URL: not an absolute URL');
  }
  if (url.protocol !== 'https:') {
    throw new TypeError('Insecure access URL: only https: endpoints are allowed');
  }
  if (!url.username || !url.password) {
    throw new TypeError('Invalid access URL: credentials (id:key) must be embedded');
  }
  const root = new URL(url.href);
  root.username = '';
  root.password = '';
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  return {
    root,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    href: `${root.protocol}//${root.host}${root.pathname}`,
  };
}
