// Configuration
// IMPORTANT: This is your Google OAuth Client ID for PUBLIC client-side use
// No client secret needed for PKCE flow - everything is done client-side
export const GOOGLE_CLIENT_ID = "799512397800-hg7aiomhtmqfge0ge77528qeh68nuhmo.apps.googleusercontent.com";

// En développement local, on utilise le proxy Vite (voir vite.config.js)
// En production, le Makefile remplacera __PLACEHOLDER__ par le vrai domaine API
export const API_ENDPOINT = import.meta.env.DEV ? "" : "__PLACEHOLDER__";

// Inactivity timeout (Google tokens have their own expiration)
export const INACTIVITY_TIMEOUT_MINUTES = 30;
