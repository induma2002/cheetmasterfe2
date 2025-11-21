const HTTP_BASE = 'https://physically-holy-longhorn.ngrok-free.app';
const WS_BASE = 'wss://physically-holy-longhorn.ngrok-free.app/ws/control?role=operator';
const DEFAULT_HEADERS = {
  'ngrok-skip-browser-warning': 'operator-client'
};

const latestImageEl = document.getElementById('latestImage');
const emptyLatestEl = document.getElementById('emptyLatest');
const galleryEl = document.getElementById('galleryList');
const captureBtn = document.getElementById('captureBtn');
const refreshBtn = document.getElementById('refreshBtn');
const reloadGalleryBtn = document.getElementById('reloadGallery');
const statusBadge = document.getElementById('operatorStatus');

let ws;

init();

function init() {
  initWebSocket();
  fetchLatestImage();
  loadGallery();
}

function initWebSocket() {
  if (ws) {
    ws.close();
  }
  ws = new WebSocket(WS_BASE);
  ws.addEventListener('open', () => updateSocketBadge(true));
  ws.addEventListener('close', () => updateSocketBadge(false));
  ws.addEventListener('error', () => updateSocketBadge(false));
  ws.addEventListener('message', handleSocketMessage);
}

function handleSocketMessage(event) {
  try {
    const payload = JSON.parse(event.data);
    if (payload.type === 'new_image') {
      fetchLatestImage();
      loadGallery();
    }
  } catch (err) {
    console.warn('Invalid socket payload', err);
  }
}

async function fetchLatestImage() {
  try {
    const response = await fetch(`${HTTP_BASE}/api/images/latest`, {
      headers: DEFAULT_HEADERS
    });
    if (response.status === 204) {
      showEmptyLatest();
      return;
    }
    if (!response.ok) {
      throw new Error('Failed to load latest image');
    }
    const data = await response.json();
    renderLatest(data);
  } catch (err) {
    console.error(err);
    showEmptyLatest('Unable to load latest capture');
  }
}

function renderLatest(image) {
  if (!image || !image.dataUrl) {
    showEmptyLatest();
    return;
  }
  latestImageEl.src = image.dataUrl;
  latestImageEl.style.display = 'block';
  emptyLatestEl.style.display = 'none';
}

function showEmptyLatest(message = 'No images have been uploaded yet.') {
  latestImageEl.style.display = 'none';
  emptyLatestEl.style.display = 'block';
  emptyLatestEl.textContent = message;
}

async function loadGallery() {
  try {
    const response = await fetch(`${HTTP_BASE}/api/images/list`, {
      headers: DEFAULT_HEADERS
    });
    if (!response.ok) {
      throw new Error('Failed to load gallery');
    }
    const images = await response.json();
    renderGallery(images);
  } catch (err) {
    console.error(err);
    galleryEl.innerHTML = '<p class="error">Unable to load gallery.</p>';
  }
}

function renderGallery(images) {
  if (!images || images.length === 0) {
    galleryEl.innerHTML = '<p class="muted">Gallery is empty.</p>';
    return;
  }
  galleryEl.innerHTML = '';
  images.forEach((image) => {
    const card = document.createElement('article');
    card.className = 'card';

    const img = document.createElement('img');
    img.src = image.dataUrl;
    img.alt = `Capture ${image.id}`;

    const timestamp = document.createElement('time');
    timestamp.textContent = new Date(image.createdAt).toLocaleString();

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.addEventListener('click', async () => {
      try {
        const response = await fetch(`${HTTP_BASE}/api/images/${image.id}/download`, {
          headers: DEFAULT_HEADERS
        });
        if (!response.ok) {
          throw new Error('Download failed');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `capture-${image.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        alert('Unable to download image right now.');
        console.error(err);
      }
    });

    card.append(img, timestamp, downloadBtn);
    galleryEl.appendChild(card);
  });
}

function updateSocketBadge(connected) {
  statusBadge.textContent = connected ? 'Socket online' : 'Socket offline';
  statusBadge.classList.toggle('badge--success', connected);
  statusBadge.classList.toggle('badge--danger', !connected);
}

function triggerCapture() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'capture_request' }));
    captureBtn.textContent = 'Request sent…';
    setTimeout(() => (captureBtn.textContent = 'Trigger Capture'), 1200);
  } else {
    alert('Socket is not connected yet. Please wait a moment.');
    initWebSocket();
  }
}

captureBtn.addEventListener('click', triggerCapture);
refreshBtn.addEventListener('click', fetchLatestImage);
reloadGalleryBtn.addEventListener('click', loadGallery);
