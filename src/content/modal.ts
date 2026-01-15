/**
 * YTCatalog Organization Modal
 * Full-screen modal for managing playlists and folders
 */

// ============================================================================
// Modal State
// ============================================================================

let modalElement: HTMLElement | null = null;
let isModalOpen = false;

// ============================================================================
// Modal Creation
// ============================================================================

/**
 * Create the modal DOM structure
 */
function createModalElement(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'ytcatalog-modal-overlay';
  overlay.id = 'ytcatalog-modal';

  const container = document.createElement('div');
  container.className = 'ytcatalog-modal-container';

  // Header
  const header = document.createElement('div');
  header.className = 'ytcatalog-modal-header';
  header.innerHTML = `
    <h2 class="ytcatalog-modal-title">Organize Playlists</h2>
    <button class="ytcatalog-modal-close" aria-label="Close modal">
      <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  `;

  // Body (placeholder for Phase 5b/5c)
  const body = document.createElement('div');
  body.className = 'ytcatalog-modal-body';
  body.innerHTML = `
    <div class="ytcatalog-modal-sidebar">
      <!-- Folder sidebar will go here in Phase 5b -->
      <p style="color: #aaa; padding: 16px;">Folder sidebar (Phase 5b)</p>
    </div>
    <div class="ytcatalog-modal-content">
      <!-- Playlist grid will go here in Phase 5c -->
      <p style="color: #aaa; padding: 16px;">Playlist grid (Phase 5c)</p>
    </div>
  `;

  container.appendChild(header);
  container.appendChild(body);
  overlay.appendChild(container);

  return overlay;
}

// ============================================================================
// Modal Open/Close
// ============================================================================

/**
 * Open the organization modal
 */
export function openModal(): void {
  if (isModalOpen) return;

  // Create modal if it doesn't exist
  if (!modalElement) {
    modalElement = createModalElement();
    document.body.appendChild(modalElement);
    attachModalEventListeners();
  }

  // Show modal
  modalElement.classList.add('open');
  isModalOpen = true;

  // Prevent body scroll while modal is open
  document.body.style.overflow = 'hidden';
}

/**
 * Close the organization modal
 */
export function closeModal(): void {
  if (!isModalOpen || !modalElement) return;

  modalElement.classList.remove('open');
  isModalOpen = false;

  // Restore body scroll
  document.body.style.overflow = '';
}

/**
 * Check if modal is currently open
 */
export function isOpen(): boolean {
  return isModalOpen;
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Attach event listeners to modal elements
 */
function attachModalEventListeners(): void {
  if (!modalElement) return;

  // Close button click
  const closeButton = modalElement.querySelector('.ytcatalog-modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
  }

  // Click outside modal container (on overlay) to close
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
      closeModal();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Handle Escape key press
 */
function handleEscapeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isModalOpen) {
    closeModal();
  }
}
