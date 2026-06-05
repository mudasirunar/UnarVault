/**
 * UnarVault Gallery & UI Controller
 * Manages the top slide-show, grid layouts, transitions, and the lightbox viewer.
 */

import { getMediaForAlbum } from './data.js';

// SVG Icons
const PLAY_ICON = `
  <svg viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
  </svg>
`;

const PHOTO_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
`;

const VIDEO_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
`;

/* ==========================================
   1. HERO SLIDER CONTROLLER
   ========================================== */
export class HeroSlider {
  constructor(sliderSelector, intervalMs = 4000) {
    this.slider = document.querySelector(sliderSelector);
    if (!this.slider) return;
    this.slides = this.slider.querySelectorAll('.slide');
    this.intervalMs = intervalMs;
    this.currentIndex = 0;
    this.timer = null;
  }

  start() {
    if (this.slides.length <= 1) return;
    this.stop();
    this.timer = setInterval(() => this.nextSlide(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  nextSlide() {
    this.slides[this.currentIndex].classList.remove('active');
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.slides[this.currentIndex].classList.add('active');
  }
}

/* ==========================================
   2. GALLERY CONTROLLER
   ========================================== */
export class GalleryController {
  constructor() {
    // Page Elements
    this.homeView = document.getElementById('home-view');
    this.galleryView = document.getElementById('gallery-view');
    this.albumsGrid = document.querySelector('.albums-grid');
    this.mediaGrid = document.querySelector('.media-grid');
    
    // Gallery Title Elements
    this.galleryTitle = document.querySelector('.gallery-title');
    this.galleryDesc = document.querySelector('.gallery-desc');
    this.gallerySource = document.querySelector('.gallery-source-badge');
    this.backBtn = document.querySelector('.back-btn');
    
    // Modal Lightbox Elements
    this.modal = document.getElementById('modal-viewer');
    this.modalMediaContainer = document.querySelector('.modal-media-container');
    this.modalCaption = document.querySelector('.modal-caption');
    this.closeBtn = document.querySelector('.close-btn');
    this.prevBtn = document.querySelector('.prev-btn');
    this.nextBtn = document.querySelector('.next-btn');
    
    // Active State variables
    this.activeAlbumId = null;
    this.activeMediaList = [];
    this.currentMediaIndex = 0;
    
    this.initEvents();
  }

  initEvents() {
    // Back to Home
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => this.showHomeView());
    }
    
    // Modal Navigation and Close triggers
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeLightbox());
    }
    
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.navigateLightbox(-1));
    }
    
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.navigateLightbox(1));
    }
    
    // Close modal on background click
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeLightbox();
        }
      });
    }
    
    // Keyboard listener for lightbox
    document.addEventListener('keydown', (e) => {
      if (!this.modal || !this.modal.classList.contains('active')) return;
      
      if (e.key === 'Escape') {
        this.closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        this.navigateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        this.navigateLightbox(1);
      }
    });
  }

  /**
   * Renders the grid of album cards on the Home View.
   * @param {Array} albums 
   * @param {Function} onAlbumSelect 
   */
  renderAlbums(albums, onAlbumSelect) {
    if (!this.albumsGrid) return;
    this.albumsGrid.innerHTML = '';
    
    albums.forEach(album => {
      const card = document.createElement('div');
      card.className = 'album-card';
      card.dataset.id = album.id;
      
      const icon = album.type === 'videos' ? VIDEO_ICON : PHOTO_ICON;
      
      card.innerHTML = `
        <div class="album-thumbnail-wrapper">
          <img 
            src="${album.thumbnail}" 
            alt="${album.name}" 
            class="album-thumbnail" 
            loading="lazy"
          />
          <div class="album-type-badge">
            ${icon}
            <span>${album.type}</span>
          </div>
        </div>
        <div class="album-info">
          <h3 class="album-name">${album.name}</h3>
          <p class="album-desc">${album.description}</p>
          <div class="album-meta">
            <span>View Album</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        if (onAlbumSelect) {
          onAlbumSelect(album.id);
        }
      });
      
      this.albumsGrid.appendChild(card);
    });
  }

  /**
   * Switches view to the gallery page of a specific album and renders its media.
   * @param {object} album 
   */
  async openAlbum(album) {
    this.activeAlbumId = album.id;
    this.activeMediaList = await getMediaForAlbum(album.id);
    
    // Set Header/Metadata titles
    this.galleryTitle.textContent = album.name;
    this.galleryDesc.textContent = album.description;
    this.gallerySource.textContent = `Source: ${album.source}`;
    
    // Render media items
    this.renderMedia();
    
    // Toggle active view CSS
    this.homeView.classList.remove('active');
    this.galleryView.classList.add('active');
    
    // Scroll window smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showHomeView() {
    this.activeAlbumId = null;
    this.activeMediaList = [];
    
    this.galleryView.classList.remove('active');
    this.homeView.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Renders album media with a responsive grid/masonry format.
   */
  renderMedia() {
    if (!this.mediaGrid) return;
    this.mediaGrid.innerHTML = '';
    
    if (this.activeMediaList.length === 0) {
      this.mediaGrid.innerHTML = `
        <div class="empty-gallery-msg">
          <p>No media files found in this album.</p>
        </div>
      `;
      return;
    }
    
    this.activeMediaList.forEach((media, index) => {
      const item = document.createElement('div');
      item.className = 'media-item';
      item.dataset.index = index;
      
      const isVideo = media.type === 'video';
      
      // We render a standard thumbnail. For video, we show a play button overlay.
      let thumbnailElement = '';
      if (isVideo) {
        // Find or generate a video placeholder. For our mock videos, we can use a beautiful Unsplash cover or let it render if possible.
        // To make it look stunning, we fetch a default video thumbnail or use a nice custom image.
        const mockThumbnail = media.thumbnail || "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?q=80&w=600&auto=format&fit=crop";
        thumbnailElement = `
          <img src="${mockThumbnail}" alt="${media.caption}" class="media-element" loading="lazy" />
          <div class="video-indicator">
            ${PLAY_ICON}
          </div>
        `;
      } else {
        thumbnailElement = `
          <img src="${media.url}" alt="${media.caption}" class="media-element" loading="lazy" />
        `;
      }
      
      item.innerHTML = `
        ${thumbnailElement}
        <div class="media-overlay">
          <div class="media-caption">${media.caption}</div>
        </div>
      `;
      
      item.addEventListener('click', () => this.openLightbox(index));
      this.mediaGrid.appendChild(item);
    });
  }

  /* ==========================================
     LIGHTBOX / MODAL VIEWER LOGIC
     ========================================== */
  openLightbox(index) {
    this.currentMediaIndex = index;
    this.updateLightboxContent();
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
  }

  closeLightbox() {
    // Clear video resource if playing to stop sound
    this.modalMediaContainer.innerHTML = '';
    this.modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore background scrolling
  }

  navigateLightbox(direction) {
    const total = this.activeMediaList.length;
    if (total === 0) return;
    
    // Cycle indices
    this.currentMediaIndex = (this.currentMediaIndex + direction + total) % total;
    this.updateLightboxContent();
  }

  updateLightboxContent() {
    this.modalMediaContainer.innerHTML = ''; // Reset container
    
    const media = this.activeMediaList[this.currentMediaIndex];
    if (!media) return;
    
    let element;
    
    if (media.type === 'video') {
      element = document.createElement('video');
      element.src = media.url;
      element.controls = true;
      element.autoplay = true;
      element.className = 'modal-media';
    } else {
      element = document.createElement('img');
      element.src = media.url;
      element.alt = media.caption;
      element.className = 'modal-media';
    }
    
    this.modalMediaContainer.appendChild(element);
    this.modalCaption.textContent = media.caption || '';
  }
}
