// ===== Configuration =====
const GOOGLE_CLIENT_ID = "__GOOGLE_CLIENT_ID__"; // Will be replaced during deployment

// Set TEST_MODE to true to use short timers for testing
const TEST_MODE = false;

const TOKEN_EXPIRY_HOURS = TEST_MODE ? 0.1 : 12; // TEST: 6 minutes, PROD: 12 hours
const INACTIVITY_TIMEOUT_MINUTES = TEST_MODE ? 2 : 30; // TEST: 2 minutes, PROD: 30 minutes
const WARNING_BEFORE_EXPIRY_MINUTES = TEST_MODE ? 1 : 5; // TEST: 1 minute, PROD: 5 minutes
const WARNING_BEFORE_INACTIVITY_SECONDS = TEST_MODE ? 30 : 30; // TEST: 30 seconds, PROD: 30 seconds

// ===== DOM Elements =====
const urlInput = document.getElementById("url");
const shortenButton = document.getElementById("shorten-button");
const optionsToggle = document.getElementById("options-toggle");
const optionsContent = document.getElementById("options-content");
const humanReadableCheckbox = document.getElementById("human-readable");
const expiryInput = document.getElementById("option-expiry");
const shortenedUrlContainer = document.getElementById("shortened-url");
const authStatusContainer = document.getElementById("auth-status");
const googleSigninButton = document.getElementById("google-signin-button");
const mainCard = document.getElementById("main-card");

// ===== Auth State =====
let currentUser = null;
let authToken = null;
let sessionExpiryTimer = null;
let sessionWarningTimer = null;
let inactivityTimer = null;
let inactivityWarningTimer = null;
let lastActivityTime = Date.now();
let countdownInterval = null;

// ===== Google Sign-In Initialization =====
function initializeGoogleSignIn() {
  // Create custom sign-in button - no Google SDK iframe
  googleSigninButton.innerHTML = `
    <button class="custom-google-signin" onclick="triggerGoogleSignIn()">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <span>Sign in with Google</span>
    </button>
  `;

  // Setup message listener for OAuth callback
  window.addEventListener('message', handleOAuthMessage);

  // Check if user was previously signed in
  checkExistingSession();
}

// ===== Trigger Google Sign-In =====
function triggerGoogleSignIn() {
  // Check if we're returning from OAuth with a token in URL
  const urlParams = new URLSearchParams(window.location.hash.substring(1));
  const idToken = urlParams.get('id_token');

  if (idToken) {
    // We have a token from redirect, process it
    handleGoogleCallback({ credential: idToken });
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  // No token, initiate OAuth flow
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: window.location.origin,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: Math.random().toString(36).substring(2),
    prompt: 'select_account'
  });

  // Redirect to Google
  window.location.href = authUrl;
}

// ===== Handle OAuth Message =====
function handleOAuthMessage(event) {
  // Not needed anymore with redirect flow
}

// ===== Verify User Authorization =====
function verifyAuthorization(callback) {
  const endpoint = "https://__PLACEHOLDER__/create";
  const request = new XMLHttpRequest();

  // Make a test request with valid data to check authorization
  request.open("POST", endpoint, true);
  request.setRequestHeader("Content-Type", "application/json");
  request.setRequestHeader("Authorization", `Bearer ${authToken}`);

  request.onload = function () {
    if (request.status === 401 || request.status === 403) {
      // User is not authorized (Lambda authorizer blocked the request)
      callback(false);
    } else {
      // Any other response (200, 500, 400, etc.) means auth passed
      // The Lambda authorizer allowed the request, so user is authorized
      callback(true);
    }
  };

  request.onerror = function () {
    // Network error - could be CORS issue, assume not authorized
    callback(false);
  };

  // Send test request with valid test URL
  // This will create a real short URL but that's OK for verification
  request.send(JSON.stringify({
    long_url: "https://example.com/auth-test",
    ttl_in_days: 1  // Auto-expire after 1 day
  }));
}

// ===== Handle Google OAuth Callback =====
function handleGoogleCallback(response) {
  if (!response.credential) {
    showAuthError("Sign-in failed");
    return;
  }

  authToken = response.credential;

  // Decode JWT to get user info (header.payload.signature)
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    currentUser = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      exp: payload.exp
    };

    // Verify user is authorized before showing UI
    verifyAuthorization(function(isAuthorized) {
      if (isAuthorized) {
        // Store token with expiry
        const tokenData = {
          token: authToken,
          expiry: Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
        };
        localStorage.setItem('auth_token', JSON.stringify(tokenData));

        showAuthSuccess();
        showMainCard();
        startSessionMonitoring();
      } else {
        // User authenticated with Google but not authorized in our system
        currentUser = null;
        authToken = null;
        showAuthError(`Access denied for ${payload.email}. Please contact administrator.`);

        // Add a "Try Another Account" button
        setTimeout(() => {
          authStatusContainer.innerHTML += `
            <button class="btn-signout" onclick="signOut()" style="margin-left: 0.75rem;">Try Another Account</button>
          `;
        }, 100);
      }
    });
  } catch (e) {
    console.error("Failed to decode token:", e);
    showAuthError("Authentication failed");
  }
}

// ===== Check Existing Session =====
function checkExistingSession() {
  const storedData = localStorage.getItem('auth_token');

  if (!storedData) {
    return;
  }

  try {
    const tokenData = JSON.parse(storedData);

    // Check if token is expired
    if (Date.now() > tokenData.expiry) {
      localStorage.removeItem('auth_token');
      return;
    }

    authToken = tokenData.token;

    // Decode token to get user info
    const payload = JSON.parse(atob(authToken.split('.')[1]));

    // Check Google token expiry
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('auth_token');
      return;
    }

    currentUser = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      exp: payload.exp
    };

    // Verify user is still authorized before restoring session
    verifyAuthorization(function(isAuthorized) {
      if (isAuthorized) {
        showAuthSuccess();
        showMainCard();
        startSessionMonitoring();
      } else {
        // User no longer authorized - clear session
        localStorage.removeItem('auth_token');
        currentUser = null;
        authToken = null;
        showAuthError(`Access denied for ${payload.email}. Please contact administrator.`);
      }
    });
  } catch (e) {
    console.error("Failed to restore session:", e);
    localStorage.removeItem('auth_token');
  }
}

// ===== Sign Out =====
function signOut() {
  // Clear all timers
  clearSessionTimers();

  currentUser = null;
  authToken = null;
  localStorage.removeItem('auth_token');

  authStatusContainer.innerHTML = '';
  mainCard.style.display = 'none';
  googleSigninButton.style.display = 'block';
}

// ===== Clear Session Timers =====
function clearSessionTimers() {
  if (sessionExpiryTimer) {
    clearTimeout(sessionExpiryTimer);
    sessionExpiryTimer = null;
  }
  if (sessionWarningTimer) {
    clearTimeout(sessionWarningTimer);
    sessionWarningTimer = null;
  }
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (inactivityWarningTimer) {
    clearTimeout(inactivityWarningTimer);
    inactivityWarningTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ===== Start Session Monitoring =====
function startSessionMonitoring() {
  clearSessionTimers();

  const tokenData = JSON.parse(localStorage.getItem('auth_token'));
  if (!tokenData) return;

  const sessionStartTime = Date.now();
  const timeUntilExpiry = tokenData.expiry - sessionStartTime;
  const warningTime = timeUntilExpiry - (WARNING_BEFORE_EXPIRY_MINUTES * 60 * 1000);

  if (TEST_MODE) {
    console.log('🧪 TEST MODE ACTIVE');
    console.log(`⏰ Session expires in: ${Math.round(timeUntilExpiry / 1000)}s`);
    console.log(`⚠️  Warning will appear in: ${Math.round(warningTime / 1000)}s`);
    console.log(`💤 Inactivity timeout: ${INACTIVITY_TIMEOUT_MINUTES * 60}s`);
    console.log('📊 Countdown every 10 seconds...\n');

    // Start countdown interval (every 10 seconds)
    countdownInterval = setInterval(() => {
      const now = Date.now();
      const remainingUntilExpiry = tokenData.expiry - now;
      const remainingUntilWarning = remainingUntilExpiry - (WARNING_BEFORE_EXPIRY_MINUTES * 60 * 1000);
      const remainingUntilInactivity = lastActivityTime + (INACTIVITY_TIMEOUT_MINUTES * 60 * 1000) - now;

      console.log('⏱️  TIME REMAINING:');

      if (remainingUntilWarning > 0) {
        console.log(`   ⚠️  Warning in: ${Math.round(remainingUntilWarning / 1000)}s`);
      }

      if (remainingUntilExpiry > 0) {
        console.log(`   ⏰ Expiration in: ${Math.round(remainingUntilExpiry / 1000)}s`);
      }

      if (remainingUntilInactivity > 0) {
        console.log(`   💤 Inactivity timeout in: ${Math.round(remainingUntilInactivity / 1000)}s`);
      }

      console.log(''); // Empty line for readability
    }, 10000); // Every 10 seconds
  }

  // Set warning timer
  if (warningTime > 0) {
    sessionWarningTimer = setTimeout(() => {
      showSessionWarning(WARNING_BEFORE_EXPIRY_MINUTES);
    }, warningTime);
  }

  // Set expiry timer
  if (timeUntilExpiry > 0) {
    sessionExpiryTimer = setTimeout(() => {
      handleSessionExpired();
    }, timeUntilExpiry);
  }

  // Set inactivity timer
  resetInactivityTimer();
}

// ===== Reset Inactivity Timer =====
function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  if (inactivityWarningTimer) {
    clearTimeout(inactivityWarningTimer);
  }

  // Clear any existing inactivity warning message
  const existingWarning = document.querySelector('.inactivity-warning');
  if (existingWarning) {
    existingWarning.remove();
  }

  lastActivityTime = Date.now();

  if (TEST_MODE) {
    console.log(`🔄 Inactivity timer reset - will timeout in ${INACTIVITY_TIMEOUT_MINUTES * 60}s`);
  }

  // Set warning timer (before actual timeout)
  const warningTime = (INACTIVITY_TIMEOUT_MINUTES * 60 * 1000) - (WARNING_BEFORE_INACTIVITY_SECONDS * 1000);
  if (warningTime > 0) {
    inactivityWarningTimer = setTimeout(() => {
      showInactivityWarning(WARNING_BEFORE_INACTIVITY_SECONDS);
    }, warningTime);
  }

  // Set actual inactivity timeout
  inactivityTimer = setTimeout(() => {
    handleInactivityTimeout();
  }, INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
}

// ===== Show Session Warning =====
function showSessionWarning(minutesRemaining) {
  authStatusContainer.innerHTML = `
    <div class="user-info">
      <img src="${currentUser.picture}" alt="${currentUser.name}" class="user-avatar" />
      <span>${currentUser.name}</span>
    </div>
    <span style="color: var(--text-secondary); font-size: 0.85rem; margin-left: 0.5rem;">
      Session expires in ${minutesRemaining} min
    </span>
    <button class="btn-signout" onclick="signOut()">Sign out</button>
  `;
}

// ===== Show Inactivity Warning =====
function showInactivityWarning(secondsRemaining) {
  // Create warning banner
  const warningBanner = document.createElement('div');
  warningBanner.className = 'inactivity-warning';
  warningBanner.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px; margin-right: 0.5rem;">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <span>You will be disconnected in ${secondsRemaining} seconds due to inactivity. Move your mouse to stay connected.</span>
  `;

  // Insert at the top of the container
  const container = document.querySelector('.container');
  container.insertBefore(warningBanner, container.firstChild);

  if (TEST_MODE) {
    console.log(`⚠️  INACTIVITY WARNING: ${secondsRemaining}s until disconnect`);
  }
}

// ===== Handle Session Expired =====
function handleSessionExpired() {
  signOut();
  displayError("Your session has expired. Please sign in again.", true);
}

// ===== Handle Inactivity Timeout =====
function handleInactivityTimeout() {
  signOut();
  displayError("You have been signed out due to inactivity.", true);
}

// ===== Track User Activity =====
function trackActivity() {
  resetInactivityTimer();
}

// ===== Show Auth Success =====
function showAuthSuccess() {
  googleSigninButton.style.display = 'none';

  authStatusContainer.innerHTML = `
    <div class="user-info">
      <img src="${currentUser.picture}" alt="${currentUser.name}" class="user-avatar" />
      <span>${currentUser.name}</span>
    </div>
    <button class="btn-signout" onclick="signOut()">Sign out</button>
  `;
}

// ===== Show Auth Error =====
function showAuthError(message) {
  authStatusContainer.classList.add('error');
  authStatusContainer.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
    <span>${message}</span>
  `;
}

// ===== Show Main Card =====
function showMainCard() {
  mainCard.style.display = 'block';
}

// ===== Event Listeners =====
if (shortenButton) {
  shortenButton.addEventListener("click", shortenURL);
}

if (optionsToggle) {
  optionsToggle.addEventListener("click", toggleOptions);
}

if (urlInput) {
  urlInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      shortenButton.click();
    }
  });
}

// ===== Options Toggle =====
function toggleOptions() {
  const isActive = optionsContent.classList.contains("active");

  if (isActive) {
    optionsContent.classList.remove("active");
    optionsToggle.classList.remove("active");
  } else {
    optionsContent.classList.add("active");
    optionsToggle.classList.add("active");
  }
}

// ===== URL Validation =====
function isValidURL(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// ===== Copy to Clipboard =====
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = "Copied!";
    button.classList.add("copied");

    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("copied");
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy:", err);
  });
}

// ===== Display Results =====
function displaySuccess(shortenedURL) {
  shortenedUrlContainer.innerHTML = `
    <div class="result-success">
      <div class="result-title">Your shortened URL is ready</div>
      <div class="result-url-container">
        <a href="${shortenedURL}" target="_blank" class="result-url">${shortenedURL}</a>
        <button class="btn-copy" onclick="copyToClipboard('${shortenedURL}', this)">Copy</button>
      </div>
    </div>
  `;
  shortenedUrlContainer.classList.add("show");
}

function displayError(message, autoHide = false) {
  shortenedUrlContainer.innerHTML = `
    <div class="result-error">
      ${message}
    </div>
  `;
  shortenedUrlContainer.classList.add("show");

  // Auto-hide after 20 seconds if requested
  if (autoHide) {
    setTimeout(() => {
      shortenedUrlContainer.classList.remove("show");
      shortenedUrlContainer.innerHTML = '';
    }, 20000);
  }
}

// ===== Shorten URL =====
function shortenURL() {
  // Check if user is authenticated
  if (!authToken) {
    displayError("Please sign in to create short URLs");
    return;
  }

  const url = urlInput.value.trim();

  // Validate URL
  if (!url) {
    displayError("Please enter a URL");
    return;
  }

  if (!isValidURL(url)) {
    displayError("Please enter a valid URL (e.g., https://example.com)");
    return;
  }

  // Prepare request body
  const body = {
    long_url: url,
    human_readable: humanReadableCheckbox.checked
  };

  const expiry = parseInt(expiryInput.value);
  if (expiry) {
    body.ttl_in_days = expiry;
  }

  // Show loading state
  shortenButton.disabled = true;
  const originalButtonHTML = shortenButton.innerHTML;
  shortenButton.innerHTML = '<span>Shortening...</span>';

  // Make API request with Authorization header
  const endpoint = "https://__PLACEHOLDER__/create";
  const request = new XMLHttpRequest();
  request.open("POST", endpoint, true);
  request.setRequestHeader("Content-Type", "application/json");
  request.setRequestHeader("Authorization", `Bearer ${authToken}`);

  request.onload = function () {
    // Reset button state
    shortenButton.disabled = false;
    shortenButton.innerHTML = originalButtonHTML;

    try {
      const data = JSON.parse(request.responseText);

      if (request.status >= 200 && request.status < 400) {
        displaySuccess(data.short_url);
        urlInput.value = "";
      } else if (request.status === 401 || request.status === 403) {
        // Auth failed - clear session and ask to sign in again
        signOut();
        displayError("Authentication failed. Please sign in again.");
      } else {
        displayError(data.message || "An error occurred while shortening the URL");
      }
    } catch (e) {
      displayError("Failed to process the response");
    }
  };

  request.onerror = function () {
    shortenButton.disabled = false;
    shortenButton.innerHTML = originalButtonHTML;
    displayError("Network error. Please try again.");
  };

  request.send(JSON.stringify(body));
}

// ===== Initialize on Page Load =====
window.onload = function() {
  // Check if returning from Google OAuth with token in URL
  const urlParams = new URLSearchParams(window.location.hash.substring(1));
  const idToken = urlParams.get('id_token');

  if (idToken) {
    // Process the token
    handleGoogleCallback({ credential: idToken });
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  initializeGoogleSignIn();

  // Track user activity for inactivity timeout
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  activityEvents.forEach(event => {
    document.addEventListener(event, trackActivity, { passive: true });
  });
};
