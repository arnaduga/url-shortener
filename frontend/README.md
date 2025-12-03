# URL Shortener Frontend

Modern React frontend for the URL Shortener application built with Vite and Chakra UI.

## Features

- **Google OAuth Authentication**: Secure login using Google OAuth 2.0 with PKCE flow
- **URL Shortening**: Create short URLs with customizable options:
  - Human-readable URLs option
  - TTL (Time To Live) configuration
- **Statistics Dashboard**: Track link performance with:
  - Total clicks
  - Weekly statistics breakdown
  - Visual progress bars
- **Dark Mode Only**: Sleek dark theme optimized for readability
- **Mobile Responsive**: Fully responsive design for all devices

## Tech Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Chakra UI**: Component library with dark mode
- **React Icons**: Icon library

## Development

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
cd frontend-new
npm install
```

### Local Development

```bash
npm run dev
```

The app will be available at http://localhost:5173

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Configuration

Edit `src/config.js` to configure:

- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `API_ENDPOINT`: Your API endpoint (will be replaced during deployment)
- `TOKEN_EXPIRY_HOURS`: Session token expiry time
- `INACTIVITY_TIMEOUT_MINUTES`: Auto-logout timeout

## Deployment

Use the Makefile command from the project root:

```bash
make setup_front
```

This will:
1. Replace the API endpoint placeholder with your domain
2. Build the React app
3. Upload to S3
4. Invalidate CloudFront cache

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.jsx      # App header with user menu
│   ├── LoginButton.jsx # Google sign-in button
│   ├── UrlShortenerForm.jsx  # URL creation form
│   └── StatsDashboard.jsx    # Statistics viewer
├── hooks/
│   └── useAuth.js      # Authentication hook
├── config.js           # App configuration
├── App.jsx            # Main app component
└── main.jsx           # App entry point
```

## Session Management

- Sessions expire after 12 hours (configurable)
- Auto-logout after 30 minutes of inactivity (configurable)
- Session data stored in sessionStorage
- Activity tracking on mouse, keyboard, and scroll events
