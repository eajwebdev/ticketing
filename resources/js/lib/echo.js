import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getToken } from './api';

let echoInstance = null;

export function getEcho() {
  if (echoInstance) return echoInstance;

  window.Pusher = Pusher;

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    },
  });

  // Expose the socket id so API requests can set X-Socket-ID (enables broadcast toOthers()).
  try {
    echoInstance.connector.pusher.connection.bind('connected', () => {
      window.__eajSocketId = echoInstance.socketId();
    });
  } catch {
    /* ignore */
  }

  return echoInstance;
}

export function resetEcho() {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
}
