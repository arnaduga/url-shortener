// ===== DOM Elements =====
const urlInput = document.getElementById("url");
const shortenButton = document.getElementById("shorten-button");
const optionsToggle = document.getElementById("options-toggle");
const optionsContent = document.getElementById("options-content");
const humanReadableCheckbox = document.getElementById("human-readable");
const expiryInput = document.getElementById("option-expiry");
const shortenedUrlContainer = document.getElementById("shortened-url");

// ===== Event Listeners =====
shortenButton.addEventListener("click", shortenURL);
optionsToggle.addEventListener("click", toggleOptions);

urlInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    shortenButton.click();
  }
});

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

  // Make API request
  const endpoint = "https://__PLACEHOLDER__/create";
  const request = new XMLHttpRequest();
  request.open("POST", endpoint, true);
  request.setRequestHeader("Content-Type", "application/json");

  request.onload = function () {
    // Reset button state
    shortenButton.disabled = false;
    shortenButton.innerHTML = originalButtonHTML;

    try {
      const data = JSON.parse(request.responseText);

      if (request.status >= 200 && request.status < 400) {
        displaySuccess(data.short_url);
        urlInput.value = "";
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

// ===== Initialize =====
// Focus on input on page load
urlInput.focus();
