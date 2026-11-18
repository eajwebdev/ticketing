import { useEffect, useRef, useState } from 'react';

// Client ID comes from the server (<meta name="google-client-id">, set from
// GOOGLE_CLIENT_ID) so it can change without rebuilding the front end.
export const googleClientId = () =>
  document.querySelector('meta[name="google-client-id"]')?.content?.trim() || '';

let scriptPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Could not load Google sign-in.'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Google "G" mark (official colours). */
export function GoogleMark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Renders Google's official "Continue with Google" button and calls
 * onCredential(idToken) when the user picks an account.
 * Until GOOGLE_CLIENT_ID is configured it shows a look-alike button that
 * explains Google sign-in isn't switched on yet.
 */
export function GoogleSignInButton({ onCredential, text = 'continue_with', disabled = false, onUnavailable }) {
  const ref = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);
  const clientId = googleClientId();

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    let observer;
    let lastWidth = 0;

    // Google caps its button at 400px; match the form width up to that.
    const render = () => {
      const el = ref.current;
      if (cancelled || !el) return;
      const width = Math.round(Math.min(400, Math.max(200, el.getBoundingClientRect().width || 320)));
      if (width === lastWidth) return;
      lastWidth = width;
      el.innerHTML = '';
      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        logo_alignment: 'center',
        text,
        width,
      });
    };

    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => res?.credential && cb.current?.(res.credential),
          ux_mode: 'popup',
        });
        // Wait a frame so entrance animations/layout have settled, then
        // re-fit whenever the form changes width (resize, rotate).
        requestAnimationFrame(render);
        if ('ResizeObserver' in window) {
          observer = new ResizeObserver(() => requestAnimationFrame(render));
          observer.observe(ref.current);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [clientId, text]);

  if (!clientId || failed) {
    return (
      <button type="button" disabled={disabled}
        onClick={() => onUnavailable?.(failed
          ? 'Google sign-in could not load. Check your connection, or sign in with email.'
          : 'Google sign-in isn’t switched on yet — please sign in with your email for now.')}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-navy-600 bg-white text-sm font-medium text-[#1f1f1f] shadow-sm transition hover:bg-gray-100 disabled:opacity-60">
        <GoogleMark />
        {text === 'signup_with' ? 'Sign up with Google' : 'Continue with Google'}
      </button>
    );
  }

  // `color-scheme: light` stops browsers painting a white box behind Google's
  // iframe when the page itself is dark (the iframe only stays transparent
  // when its color scheme matches the embedding element's).
  return (
    <div className={`w-full ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div
        ref={ref}
        style={{ colorScheme: 'light' }}
        className="flex min-h-11 w-full items-center justify-center [&_iframe]:!m-0"
      />
    </div>
  );
}

/** "or" divider shown between the Google button and the email form. */
export function OrDivider({ label = 'or' }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
      <span className="h-px flex-1 bg-white/10" />
      {label}
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
