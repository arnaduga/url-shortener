// ===== Configuration =====
const GOOGLE_CLIENT_ID = "__GOOGLE_CLIENT_ID__"; // Will be replaced during deployment
const TOKEN_EXPIRY_HOURS = 12;

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

// ===== Google Sign-In Initialization =====
function initializeGoogleSignIn() {
  if (typeof google === 'undefined') {
    console.error("Google Sign-In library not loaded");
    showAuthError("Failed to load Google Sign-In");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCallback
  });

  google.accounts.id.renderButton(
    googleSigninButton,
    {
      theme: "filled_blue",
      size: "large",
      text: "signin_with",
      shape: "rectangular"
    }
  );

  // Check if user was previously signed in
  checkExistingSession();
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

    // Store token with expiry
    const tokenData = {
      token: authToken,
      expiry: Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
    };
    localStorage.setItem('auth_token', JSON.stringify(tokenData));

    showAuthSuccess();
    showMainCard();
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

    showAuthSuccess();
    showMainCard();
  } catch (e) {
    console.error("Failed to restore session:", e);
    localStorage.removeItem('auth_token');
  }
}

// ===== Sign Out =====
function signOut() {
  currentUser = null;
  authToken = null;
  localStorage.removeItem('auth_token');

  authStatusContainer.innerHTML = '';
  mainCard.style.display = 'none';
  googleSigninButton.style.display = 'block';
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

function displayError(message) {
  shortenedUrlContainer.innerHTML = `
    <div class="result-error">
      ${message}
    </div>
  `;
  shortenedUrlContainer.classList.add("show");
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
  initializeGoogleSignIn();
};
