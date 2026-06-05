/**
 * UnarVault Gallery & UI Controller
 * Manages the grid layouts, transitions, loaders, error handlers, and the lightbox viewer.
 */

import { getMediaForAlbum } from './data.js';

/**
 * Helper to dynamically resize/scale Google Drive images for optimal resolution.
 * Maps raw lh3 or uc links to the high-performance drive.google.com/thumbnail API.
 */
function getHighResUrl(url, size = 600) {
  if (url) {
    let fileId = '';
    if (url.includes('lh3.googleusercontent.com/d/')) {
      fileId = url.split('lh3.googleusercontent.com/d/')[1].split(/[?&]/)[0];
    } else if (url.includes('id=')) {
      fileId = url.split('id=')[1].split('&')[0];
    }
    
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
    }
  }
  return url;
}

/**
 * Helper to fetch album media with retry logic and exponential backoff.
 */
async function fetchMediaWithRetry(album, retries = 4, delay = 1200) {
  for (let i = 0; i < retries; i++) {
    try {
      const mediaList = await getMediaForAlbum(album);
      if (mediaList && Array.isArray(mediaList)) {
        return mediaList;
      }
    } catch (e) {
      console.warn(`Fetch retry ${i + 1}/${retries} failed for album: ${album.name}`, e);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw new Error(`Failed to retrieve media for album ${album.name} after ${retries} attempts.`);
}

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
  constructor(sliderSelector, intervalMs = 5000) {
    this.slider = document.querySelector(sliderSelector);
    if (!this.slider) return;
    this.wrapper = this.slider.querySelector('.hero-slider');
    this.intervalMs = intervalMs;
    this.currentIndex = 0;
    this.timer = null;
    
    this.prevBtn = this.slider.querySelector('.hero-prev-btn');
    this.nextBtn = this.slider.querySelector('.hero-next-btn');
    
    this.initEvents();
  }

  // Re-query slides fresh each time so dynamically loaded slides are included
  getSlides() {
    return this.wrapper ? this.wrapper.querySelectorAll('.slide') : [];
  }

  initEvents() {
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prevSlideManual());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.nextSlideManual());
    }
  }

  start() {
    this.stop();
    if (this.getSlides().length <= 1) return;
    this.timer = setInterval(() => this.nextSlide(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  nextSlide() {
    const slides = this.getSlides();
    if (slides.length <= 1) return;
    // Clamp currentIndex in case slides changed
    if (this.currentIndex >= slides.length) this.currentIndex = 0;
    slides[this.currentIndex].classList.remove('active');
    this.currentIndex = (this.currentIndex + 1) % slides.length;
    slides[this.currentIndex].classList.add('active');
  }

  prevSlide() {
    const slides = this.getSlides();
    if (slides.length <= 1) return;
    if (this.currentIndex >= slides.length) this.currentIndex = 0;
    slides[this.currentIndex].classList.remove('active');
    this.currentIndex = (this.currentIndex - 1 + slides.length) % slides.length;
    slides[this.currentIndex].classList.add('active');
  }

  nextSlideManual() {
    this.nextSlide();
    this.start(); // reset auto interval on user click
  }

  prevSlideManual() {
    this.prevSlide();
    this.start(); // reset auto interval on user click
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
    this.backBtn = document.querySelector('.back-btn');
    this.logoLink = document.querySelector('.logo');
    
    // Gallery Filters
    this.galleryFiltersContainer = document.getElementById('gallery-filters-container');
    this.filterChips = {
      all: this.galleryFiltersContainer ? this.galleryFiltersContainer.querySelector('[data-filter="all"]') : null,
      images: this.galleryFiltersContainer ? this.galleryFiltersContainer.querySelector('[data-filter="images"]') : null,
      videos: this.galleryFiltersContainer ? this.galleryFiltersContainer.querySelector('[data-filter="videos"]') : null
    };
    this.activeFilter = 'all';
    this.filteredMediaList = [];
    
    // Modal Lightbox Elements
    this.modal = document.getElementById('modal-viewer');
    this.modalMediaContainer = document.querySelector('.modal-media-container');
    this.modalCaption = document.querySelector('.modal-caption');
    this.closeBtn = document.querySelector('.close-btn');
    this.prevBtn = document.querySelector('.prev-btn');
    this.nextBtn = document.querySelector('.next-btn');
    this.downloadBtn = this.modal.querySelector('.download-btn');
    this.downloadAllBtn = document.getElementById('download-all-btn');
    this.viewDriveBtn = document.getElementById('view-drive-btn');
    this.lightboxLoader = document.getElementById('lightbox-loader');
    
    // Custom Video Control Elements
    this.videoControls = document.getElementById('custom-video-controls');
    this.playPauseBtn = this.videoControls.querySelector('.play-pause-btn');
    this.playIcon = this.playPauseBtn.querySelector('.play-icon');
    this.pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
    this.replayIcon = this.playPauseBtn.querySelector('.replay-icon');
    this.skipBackBtn = this.videoControls.querySelector('.skip-back-btn');
    this.skipFwdBtn = this.videoControls.querySelector('.skip-fwd-btn');
    this.progressBar = this.videoControls.querySelector('.progress-bar-container');
    this.progressFill = this.videoControls.querySelector('.progress-bar-fill');
    
    this.volumeBtn = this.videoControls.querySelector('.volume-btn');
    this.volumeUpIcon = this.volumeBtn.querySelector('.volume-up-icon');
    this.volumeMuteIcon = this.volumeBtn.querySelector('.volume-mute-icon');
    this.volumeSlider = this.videoControls.querySelector('.volume-slider');
    this.fullscreenBtn = this.videoControls.querySelector('.fullscreen-btn');
    
    // Active State variables
    this.activeAlbumId = null;
    this.activeMediaList = [];
    this.currentMediaIndex = 0;
    this.activeVideoElement = null;
    this.isVideoMuted = false;
    this.preMuteVolume = 1;
    this.currentVolume = 1; // session volume persistence
    this.heroSlider = null;
    
    this.initEvents();
  }

  initEvents() {
    // Back to Home
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => this.showHomeView());
    }

    // Logo Click (scroll to top on home screen)
    if (this.logoLink) {
      this.logoLink.addEventListener('click', (e) => {
        if (!this.activeAlbumId) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
    
    // Filter chip triggers
    if (this.galleryFiltersContainer) {
      const chips = this.galleryFiltersContainer.querySelectorAll('.filter-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          const filterType = chip.dataset.filter;
          this.applyFilter(filterType);
        });
      });
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
    
    // Download current item click listener
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.downloadActiveMedia());
    }

    // Download all album media click listener
    if (this.downloadAllBtn) {
      this.downloadAllBtn.addEventListener('click', () => this.downloadAllMedia());
    }

    // Custom Video Players Click Listeners
    if (this.playPauseBtn) {
      this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    }

    if (this.skipBackBtn) {
      this.skipBackBtn.addEventListener('click', () => this.skipVideo(-5));
    }

    if (this.skipFwdBtn) {
      this.skipFwdBtn.addEventListener('click', () => this.skipVideo(5));
    }

    if (this.progressBar) {
      this.progressBar.addEventListener('click', (e) => this.seekVideo(e));
    }

    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => this.changeVolume(parseFloat(e.target.value)));
    }

    if (this.volumeBtn) {
      this.volumeBtn.addEventListener('click', () => this.toggleMute());
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
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
        if (this.activeVideoElement) {
          e.preventDefault();
          this.skipVideo(-5);
        } else {
          this.navigateLightbox(-1);
        }
      } else if (e.key === 'ArrowRight') {
        if (this.activeVideoElement) {
          e.preventDefault();
          this.skipVideo(5);
        } else {
          this.navigateLightbox(1);
        }
      } else if (e.key === ' ' && this.activeVideoElement) {
        e.preventDefault();
        this.togglePlayPause();
      }
    });
  }

  /**
   * Renders the grid of album cards on the Home View.
   * Resolves thumbnails dynamically from Drive folders if album.thumbnail is empty.
   * @param {Array} albums 
   * @param {Function} onAlbumSelect 
   */
  renderAlbums(albums, onAlbumSelect) {
    if (!this.albumsGrid) return;
    this.albumsGrid.innerHTML = '';
    
    albums.forEach(album => {
      const card = document.createElement('a');
      card.className = 'album-card';
      card.href = `#album/${album.id}`;
      card.dataset.id = album.id;
      
      card.innerHTML = `
        <div class="album-thumbnail-wrapper">
          <div class="spinner-mini"></div>
          <img 
            src="" 
            alt="${album.name}" 
            class="album-thumbnail" 
            style="opacity: 0; transition: opacity 0.4s ease;"
            loading="lazy"
          />
        </div>
        <div class="album-info">
          <h3 class="album-name">${album.name}</h3>
          <p class="album-desc">${album.description}</p>
          <div class="album-meta">
            <span class="album-action">View Album</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>
        </div>
      `;
      
      card.addEventListener('click', (e) => {
        e.preventDefault();
        if (onAlbumSelect) {
          onAlbumSelect(album.id);
        }
      });
      
      this.albumsGrid.appendChild(card);

      // Async fetch media to resolve thumbnail if empty
      const img = card.querySelector('.album-thumbnail');
      const spinner = card.querySelector('.spinner-mini');
      
      (async () => {
        let media = [];
        try {
          media = await fetchMediaWithRetry(album, 4, 1200);
        } catch (e) {
          console.error("Failed to dynamically fetch album media:", e);
        }
        
        let thumbnail = album.thumbnail;
        if (!thumbnail && media.length > 0) {
          thumbnail = media[0].thumbnail || media[0].url;
        }
        
        if (thumbnail) {
          // Optimize resolution for grid card preview
          thumbnail = getHighResUrl(thumbnail, 600);
          img.src = thumbnail;
          img.onload = () => {
            img.style.opacity = '1';
            if (spinner) spinner.remove();
          };
          img.onerror = () => {
            console.error("Cover image failed to load:", thumbnail);
          };
        }
      })();
    });
  }

  /**
   * Initializes the dynamic Hero Slider by fetching all images from all albums,
   * selecting a random 20% from each, interleaving them, and starting the loop.
   * @param {Array} albums 
   */
  async initHeroSlider(albums) {
    const sliderSection = document.getElementById('hero-slider-section');
    const sliderWrapper = document.getElementById('hero-slider-wrapper');
    const sliderLoader = document.getElementById('hero-slider-loader');
    if (!sliderSection || !sliderWrapper) return;
    
    // Reset loader state and show slider section
    if (sliderLoader) {
      sliderLoader.style.display = 'flex';
      sliderLoader.style.opacity = '1';
    }
    sliderSection.style.display = 'block';
    
    // Stop any existing slider
    if (this.heroSlider) {
      this.heroSlider.stop();
      this.heroSlider = null;
    }
    
    // Fetch media lists for all albums in parallel
    const allMediaPromises = albums.map(async (album) => {
      try {
        const mediaList = await getMediaForAlbum(album);
        // Only pick images for the hero slider
        return mediaList.filter(item => item.type === 'image');
      } catch (e) {
        console.error("Failed to load album images for slider:", album.name, e);
        return [];
      }
    });
    
    const albumsImages = await Promise.all(allMediaPromises);
    
    // Pick a random 45% subset of images from each folder (minimum 1 if folder has images)
    const selectedImagesPerAlbum = albumsImages.map(images => {
      if (images.length === 0) return [];
      const countToPick = Math.max(1, Math.min(20, Math.round(images.length * 0.45)));
      
      // Proper Fisher-Yates shuffle for true randomness
      const shuffled = [...images];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      return shuffled.slice(0, countToPick);
    });
    
    // Interleave the selected images (one first from first folder, then second folder, etc.)
    const slidesList = [];
    const maxLen = Math.max(...selectedImagesPerAlbum.map(arr => arr.length), 0);
    
    for (let i = 0; i < maxLen; i++) {
      for (let j = 0; j < selectedImagesPerAlbum.length; j++) {
        if (i < selectedImagesPerAlbum[j].length) {
          slidesList.push(selectedImagesPerAlbum[j][i]);
        }
      }
    }
    
    // If no images resolved across all folders, hide slider and show nothing (no error)
    if (slidesList.length === 0) {
      sliderSection.style.display = 'none';
      return;
    }
    
    // Preserve true random array order by creating DOM elements synchronously
    sliderWrapper.innerHTML = '';
    let sliderStarted = false;
    
    const dismissLoader = () => {
      if (sliderLoader) {
        sliderLoader.style.opacity = '0';
        setTimeout(() => { sliderLoader.style.display = 'none'; }, 300);
      }
    };
    
    const startSlider = () => {
      if (sliderStarted) return;
      sliderStarted = true;
      
      const firstSlide = sliderWrapper.querySelector('.slide');
      if (firstSlide) {
        firstSlide.classList.add('active');
      } else {
        // Nothing loaded at all — hide section
        sliderSection.style.display = 'none';
      }
      
      dismissLoader();
      
      // Initialize slider and start
      this.heroSlider = new HeroSlider('#hero-slider-section', 5000);
      this.heroSlider.start();
    };
    
    // Safety timeout — force-start after 5 seconds regardless of loading state
    const safetyTimer = setTimeout(() => {
      if (!sliderStarted) {
        startSlider();
      }
    }, 5000);
    
    slidesList.forEach((media, index) => {
      const slideUrl = getHighResUrl(media.url, 1200);
      
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.style.backgroundImage = `url('${slideUrl}')`;
      sliderWrapper.appendChild(slide);
      
      // We only wait for the absolute FIRST slide in the array to load before dismissing the loader
      if (index === 0) {
        const img = new Image();
        img.src = slideUrl;
        img.onload = startSlider;
        img.onerror = startSlider; // If it fails, start anyway so it rotates to the next one
      }
    });
  }

  /**
   * Switches view to the gallery page of a specific album and renders its media.
   * @param {object} album 
   */
  async openAlbum(album) {
    this.activeAlbumId = album.id;
    
    // Reset active filter
    this.activeFilter = 'all';
    if (this.galleryFiltersContainer) {
      const chips = this.galleryFiltersContainer.querySelectorAll('.filter-chip');
      chips.forEach(chip => {
        if (chip.dataset.filter === 'all') {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
    
    // Disable filters initially while loading
    this.setFiltersDisabled(true);
    if (this.downloadAllBtn) this.downloadAllBtn.style.display = 'none';
    if (this.viewDriveBtn) this.viewDriveBtn.style.display = 'none';
    
    // Pause hero slider if running to save resources
    if (this.heroSlider) {
      this.heroSlider.stop();
    }
    
    // Toggle active view CSS (show layout first so loader fits)
    this.homeView.classList.remove('active');
    this.galleryView.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Show Loader, Hide Media Grid & Error Banner
    const loader = document.getElementById('gallery-loader');
    const errorBanner = document.getElementById('gallery-error');
    if (loader) loader.style.display = 'flex';
    if (errorBanner) errorBanner.style.display = 'none';
    if (this.mediaGrid) this.mediaGrid.style.display = 'none';

    // Set Header/Metadata titles
    this.galleryTitle.textContent = album.name;
    this.galleryDesc.textContent = album.description;

    try {
      this.activeMediaList = await getMediaForAlbum(album);
      
      // Calculate counts and update badges
      const totalCount = this.activeMediaList.length;
      const imageCount = this.activeMediaList.filter(item => item.type === 'image').length;
      const videoCount = this.activeMediaList.filter(item => item.type === 'video').length;
      
      if (this.filterChips.all) {
        const countSpan = this.filterChips.all.querySelector('.filter-count');
        if (countSpan) countSpan.textContent = `(${totalCount})`;
      }
      if (this.filterChips.images) {
        const countSpan = this.filterChips.images.querySelector('.filter-count');
        if (countSpan) countSpan.textContent = `(${imageCount})`;
      }
      if (this.filterChips.videos) {
        const countSpan = this.filterChips.videos.querySelector('.filter-count');
        if (countSpan) countSpan.textContent = `(${videoCount})`;
      }
      
      this.filteredMediaList = [...this.activeMediaList];
      
      // Re-enable filters since media has loaded
      this.setFiltersDisabled(false);
      
      // Render media items
      this.renderMedia();
      
      // Hide loader, show grid
      if (loader) loader.style.display = 'none';
      if (this.mediaGrid) this.mediaGrid.style.display = 'block';
      if (this.downloadAllBtn && this.activeMediaList.length > 0) {
        this.downloadAllBtn.style.display = 'inline-flex';
      }
      if (this.viewDriveBtn) {
        if (album.source && album.source !== "local" && !album.source.startsWith("http")) {
          this.viewDriveBtn.href = `https://drive.google.com/drive/folders/${album.source}`;
          this.viewDriveBtn.style.display = 'inline-flex';
        } else {
          this.viewDriveBtn.style.display = 'none';
        }
      }
    } catch (error) {
      console.error("Failed to load gallery files:", error);
      
      // Keep filters disabled if load failed
      this.setFiltersDisabled(true);
      
      // Hide loader, show error banner
      if (loader) loader.style.display = 'none';
      if (errorBanner) {
        errorBanner.style.display = 'flex';
        const errorText = document.getElementById('error-message-text');
        if (errorText) {
          errorText.textContent = `Error details: ${error.message || 'Check Google Drive shared permissions.'}`;
        }
      }
    }
  }

  showHomeView() {
    this.activeAlbumId = null;
    this.activeMediaList = [];
    this.filteredMediaList = [];
    
    // Resume hero slider if configured
    if (this.heroSlider) {
      this.heroSlider.start();
    }
    
    if (this.downloadAllBtn) {
      this.downloadAllBtn.style.display = 'none';
    }
    if (this.viewDriveBtn) {
      this.viewDriveBtn.style.display = 'none';
    }
    this.galleryView.classList.remove('active');
    this.homeView.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  applyFilter(filterType) {
    // Ignore clicks if filters are currently disabled
    if (this.galleryFiltersContainer && this.galleryFiltersContainer.querySelector('.filter-chip.disabled')) {
      return;
    }

    this.activeFilter = filterType;
    
    // Update UI chips active state
    if (this.galleryFiltersContainer) {
      const chips = this.galleryFiltersContainer.querySelectorAll('.filter-chip');
      chips.forEach(chip => {
        if (chip.dataset.filter === filterType) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
    
    // Filter activeMediaList into filteredMediaList
    if (filterType === 'all') {
      this.filteredMediaList = [...this.activeMediaList];
    } else if (filterType === 'images') {
      this.filteredMediaList = this.activeMediaList.filter(item => item.type === 'image');
    } else if (filterType === 'videos') {
      this.filteredMediaList = this.activeMediaList.filter(item => item.type === 'video');
    }
    
    this.renderMedia();
  }

  setFiltersDisabled(disabled) {
    if (this.galleryFiltersContainer) {
      const chips = this.galleryFiltersContainer.querySelectorAll('.filter-chip');
      chips.forEach(chip => {
        if (disabled) {
          chip.setAttribute('disabled', 'true');
          chip.classList.add('disabled');
        } else {
          chip.removeAttribute('disabled');
          chip.classList.remove('disabled');
        }
      });
    }
  }

  /**
   * Renders album media with a responsive grid/masonry format.
   */
  renderMedia() {
    if (!this.mediaGrid) return;
    this.mediaGrid.innerHTML = '';
    
    if (this.filteredMediaList.length === 0) {
      this.mediaGrid.innerHTML = `
        <div class="empty-gallery-msg" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
          <p>No media files found in this category.</p>
        </div>
      `;
      return;
    }
    
    this.filteredMediaList.forEach((media, index) => {
      const item = document.createElement('div');
      item.className = 'media-item';
      item.dataset.index = index;
      
      const isVideo = media.type === 'video';
      
      let thumbnailElement = '';
      if (isVideo) {
        if (media.thumbnail) {
          const mockThumbnail = getHighResUrl(media.thumbnail, 600);
          thumbnailElement = `
            <div class="spinner-mini"></div>
            <img src="${mockThumbnail}" alt="${media.caption}" class="media-element is-loading" style="opacity: 0; transition: opacity 0.4s ease, filter 0.4s ease;" loading="lazy" />
            <div class="video-indicator">
              ${PLAY_ICON}
            </div>
          `;
        } else {
          thumbnailElement = `
            <div class="media-placeholder-card">
              <div class="video-indicator" style="display: flex; opacity: 1; transform: translate(-50%, -50%);">
                ${PLAY_ICON}
              </div>
            </div>
          `;
        }
      } else {
        const gridImgUrl = getHighResUrl(media.url, 600);
        thumbnailElement = `
          <div class="spinner-mini"></div>
          <img src="${gridImgUrl}" alt="${media.caption}" class="media-element is-loading" style="opacity: 0; transition: opacity 0.4s ease, filter 0.4s ease;" loading="lazy" />
        `;
      }
      
      item.innerHTML = `
        ${thumbnailElement}
        <div class="media-overlay">
          <div class="media-caption">${media.caption}</div>
        </div>
      `;
      
      const img = item.querySelector('.media-element');
      const spinner = item.querySelector('.spinner-mini');
      if (img) {
        img.onload = () => {
          img.classList.remove('is-loading');
          img.style.opacity = '1';
          if (spinner) spinner.remove();
        };
        img.onerror = () => {
          console.error("Failed to load gallery image thumbnail:", img.src);
          img.classList.remove('is-loading');
          img.style.display = 'none'; // Hide broken image element
          if (spinner) spinner.remove();
          
          // Inject a placeholder so the grid item doesn't collapse to 0 height
          if (isVideo) {
            item.innerHTML = `
              <div class="media-placeholder-card">
                <div class="video-indicator" style="display: flex; opacity: 1; transform: translate(-50%, -50%);">
                  ${PLAY_ICON}
                </div>
              </div>
              <div class="media-overlay">
                <div class="media-caption">${media.caption}</div>
              </div>
            `;
          } else {
            item.innerHTML = `
              <div class="media-placeholder-card" style="aspect-ratio: 1/1;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-secondary);">
                  ${PHOTO_ICON}
                </div>
              </div>
              <div class="media-overlay">
                <div class="media-caption">${media.caption}</div>
              </div>
            `;
          }
        };
      }
      
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
    if (this.activeVideoElement) {
      this.activeVideoElement.pause();
      this.activeVideoElement = null;
    }
    this.modalMediaContainer.innerHTML = '';
    this.modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore background scrolling
    if (this.videoControls) this.videoControls.style.display = 'none';
  }

  navigateLightbox(direction) {
    const total = this.filteredMediaList.length;
    if (total === 0) return;
    
    // Cycle indices
    this.currentMediaIndex = (this.currentMediaIndex + direction + total) % total;
    this.updateLightboxContent();
  }

  updateLightboxContent() {
    this.modalMediaContainer.innerHTML = ''; // Reset container
    
    // Hide controls initially
    if (this.videoControls) this.videoControls.style.display = 'none';
    this.activeVideoElement = null;

    const media = this.filteredMediaList[this.currentMediaIndex];
    if (!media) return;
    
    // Show Lightbox Loader
    if (this.lightboxLoader) this.lightboxLoader.style.display = 'flex';

    let element;
    
    if (media.type === 'video') {
      element = document.createElement('iframe');
      let videoUrl = media.url;
      let fileId = '';
      if (videoUrl.includes('lh3.googleusercontent.com/d/')) {
        fileId = videoUrl.split('lh3.googleusercontent.com/d/')[1].split(/[?&]/)[0];
      } else if (videoUrl.includes('id=')) {
        fileId = videoUrl.split('id=')[1].split('&')[0];
      }
      
      if (fileId) {
        element.src = `https://drive.google.com/file/d/${fileId}/preview?autoplay=1`;
      } else {
        element.src = videoUrl.includes('?') ? `${videoUrl}&autoplay=1` : `${videoUrl}?autoplay=1`;
      }
      
      element.className = 'modal-media';
      element.setAttribute('frameborder', '0');
      element.setAttribute('allow', 'autoplay; fullscreen');
      element.setAttribute('allowfullscreen', 'true');
      
      // Google Drive iframe has its own player controls — hide our custom overlay
      if (this.videoControls) this.videoControls.style.display = 'none';
      
      element.onload = () => {
        if (this.lightboxLoader) this.lightboxLoader.style.display = 'none';
      };
      
      this.modalMediaContainer.appendChild(element);
      
    } else {
      element = document.createElement('img');
      element.alt = media.caption || '';
      element.className = 'modal-media is-loading';
      element.setAttribute('referrerpolicy', 'no-referrer');
      
      element.onload = () => {
        element.classList.remove('is-loading');
        if (this.lightboxLoader) this.lightboxLoader.style.display = 'none';
      };
      element.onerror = () => {
        if (this.lightboxLoader) this.lightboxLoader.style.display = 'none';
        
        // Render detailed warning panel and Reload Button
        this.modalMediaContainer.innerHTML = `
          <div class="lightbox-error-container">
            <svg class="error-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div class="lightbox-error-text">Failed to load this image. Check your internet connection or shared settings.</div>
            <button class="lightbox-reload-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              Reload Image
            </button>
          </div>
        `;
        
        const reloadBtn = this.modalMediaContainer.querySelector('.lightbox-reload-btn');
        if (reloadBtn) {
          reloadBtn.addEventListener('click', () => {
            // Append cache buster parameter to bypass local network cache and force reload
            media.url = media.url.split('?')[0] + '?t=' + Date.now();
            this.updateLightboxContent();
          });
        }
      };
      
      this.modalMediaContainer.appendChild(element);
      
      // Request high-resolution version (w1600) for sharp full-screen modal preview
      // Setting src after registering events and appending to DOM prevents sync race issues
      const highResUrl = getHighResUrl(media.url, 1600);
      element.src = highResUrl;
    }
    this.modalCaption.textContent = media.caption || '';
  }

  /* ==========================================
     CUSTOM VIDEO PLAYER CONTROL METHODS
     ========================================== */
  togglePlayPause() {
    if (!this.activeVideoElement) return;
    if (this.activeVideoElement.paused || this.activeVideoElement.ended) {
      if (this.activeVideoElement.ended) {
        this.activeVideoElement.currentTime = 0;
      }
      this.activeVideoElement.play();
    } else {
      this.activeVideoElement.pause();
    }
  }

  updatePlayPauseUI(state) {
    if (!this.playIcon || !this.pauseIcon || !this.replayIcon) return;
    
    if (state === 'play') {
      this.playIcon.style.display = 'none';
      this.pauseIcon.style.display = 'block';
      this.replayIcon.style.display = 'none';
    } else if (state === 'pause') {
      this.playIcon.style.display = 'block';
      this.pauseIcon.style.display = 'none';
      this.replayIcon.style.display = 'none';
    } else if (state === 'ended') {
      this.playIcon.style.display = 'none';
      this.pauseIcon.style.display = 'none';
      this.replayIcon.style.display = 'block';
    }
  }

  skipVideo(seconds) {
    if (!this.activeVideoElement) return;
    this.activeVideoElement.currentTime = Math.max(0, Math.min(this.activeVideoElement.duration || 0, this.activeVideoElement.currentTime + seconds));
    this.updateProgressBar();
  }

  seekVideo(e) {
    if (!this.activeVideoElement) return;
    const rect = this.progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    this.activeVideoElement.currentTime = percentage * (this.activeVideoElement.duration || 0);
    this.updateProgressBar();
  }

  changeVolume(value) {
    this.currentVolume = value;
    if (this.volumeSlider) {
      this.volumeSlider.value = value;
    }
    
    if (value === 0) {
      if (this.volumeUpIcon) this.volumeUpIcon.style.display = 'none';
      if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'block';
      this.isVideoMuted = true;
    } else {
      if (this.volumeUpIcon) this.volumeUpIcon.style.display = 'block';
      if (this.volumeMuteIcon) this.volumeMuteIcon.style.display = 'none';
      this.isVideoMuted = false;
      this.preMuteVolume = value;
    }
    
    if (this.activeVideoElement) {
      this.activeVideoElement.volume = value;
    }
  }

  toggleMute() {
    if (this.isVideoMuted) {
      this.changeVolume(this.preMuteVolume || 1);
    } else {
      if (this.activeVideoElement) {
        this.preMuteVolume = this.activeVideoElement.volume;
      } else {
        this.preMuteVolume = this.currentVolume;
      }
      this.changeVolume(0);
    }
  }

  toggleFullscreen() {
    if (!this.activeVideoElement) return;
    if (this.activeVideoElement.requestFullscreen) {
      this.activeVideoElement.requestFullscreen();
    } else if (this.activeVideoElement.webkitRequestFullscreen) {
      this.activeVideoElement.webkitRequestFullscreen();
    } else if (this.activeVideoElement.msRequestFullscreen) {
      this.activeVideoElement.msRequestFullscreen();
    }
  }

  updateProgressBar() {
    if (!this.activeVideoElement) return;
    const duration = this.activeVideoElement.duration || 0;
    const currentTime = this.activeVideoElement.currentTime || 0;
    if (duration > 0) {
      const percentage = (currentTime / duration) * 100;
      this.progressFill.style.width = `${percentage}%`;
    }
  }

  /* ==========================================
     DIRECT DOWNLOAD HELPER
     ========================================== */
  async downloadActiveMedia() {
    const media = this.filteredMediaList[this.currentMediaIndex];
    if (!media) return;
    
    const url = media.url;
    const extension = media.type === 'video' ? 'mp4' : 'jpg';
    const filename = `${media.caption.replace(/[\s\W]+/g, '_') || 'download'}.${extension}`;
    
    // Animate button scale
    this.downloadBtn.style.transform = 'scale(0.85)';
    setTimeout(() => { this.downloadBtn.style.transform = ''; }, 200);

    try {
      // Direct client-side fetch download
      const response = await fetch(url);
      if (!response.ok) throw new Error("CORS limit or fetch issue");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.warn("Direct fetch blocked (CORS). Falling back to Google Drive forced download trigger:", error);
      
      // Parse fileId from URL link
      let downloadUrl = url;
      if (url.includes('lh3.googleusercontent.com/d/')) {
        const fileId = url.split('lh3.googleusercontent.com/d/')[1].split(/[?&]/)[0];
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
      
      window.open(downloadUrl, '_blank');
    }
  }

  async downloadAllMedia() {
    if (!this.activeMediaList || this.activeMediaList.length === 0) return;
    
    const originalContent = this.downloadAllBtn.innerHTML;
    this.downloadAllBtn.classList.add('loading');
    this.downloadAllBtn.disabled = true;
    
    const albumName = this.galleryTitle.textContent || 'Album';
    const total = this.activeMediaList.length;
    
    // Check if browser supports sharing files natively (common on iOS/Android)
    let canShare = false;
    try {
      const testFile = new File([new Blob([''], { type: 'image/jpeg' })], 'test.jpg', { type: 'image/jpeg' });
      canShare = navigator.canShare && navigator.canShare({ files: [testFile] });
    } catch (e) {
      canShare = false;
    }
    
    const limit = 3;
    let completed = 0;
    const filesArray = [];
    const failedUrls = [];
    const zip = canShare ? null : new JSZip();
    
    const updateProgress = () => {
      this.downloadAllBtn.innerHTML = `
        <div class="download-spinner" style="margin-right: 8px;"></div>
        <span>Downloading (${completed}/${total})...</span>
      `;
    };
    
    updateProgress();
    
    const downloadItem = async (media, index) => {
      const extension = media.type === 'video' ? 'mp4' : 'jpg';
      const mimeType = media.type === 'video' ? 'video/mp4' : 'image/jpeg';
      const safeCaption = media.caption ? media.caption.replace(/[\s\W]+/g, '_') : '';
      const filename = `${safeCaption || `media_${index + 1}`}.${extension}`;
      
      try {
        const response = await fetch(media.url);
        if (!response.ok) throw new Error("CORS or network error");
        const blob = await response.blob();
        
        if (canShare) {
          const file = new File([blob], filename, { type: mimeType });
          filesArray.push(file);
        } else {
          zip.file(filename, blob);
        }
      } catch (err) {
        console.warn(`Could not fetch media client-side: ${media.url}`, err);
        let fallbackUrl = media.url;
        if (media.url.includes('lh3.googleusercontent.com/d/')) {
          const fileId = media.url.split('lh3.googleusercontent.com/d/')[1].split(/[?&]/)[0];
          fallbackUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
        failedUrls.push({ name: filename, url: fallbackUrl });
      }
      
      completed++;
      updateProgress();
    };
    
    // Process in parallel chunks of 3
    const chunks = [];
    for (let i = 0; i < total; i += limit) {
      chunks.push(this.activeMediaList.slice(i, i + limit));
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await Promise.all(chunk.map((media, chunkIdx) => {
        const originalIdx = i * limit + chunkIdx;
        return downloadItem(media, originalIdx);
      }));
    }
    
    if (canShare && filesArray.length > 0) {
      this.downloadAllBtn.innerHTML = `
        <div class="download-spinner" style="margin-right: 8px;"></div>
        <span>Opening Share Sheet...</span>
      `;
      try {
        await navigator.share({
          files: filesArray,
          title: albumName,
          text: `Download files from ${albumName}`
        });
      } catch (shareErr) {
        // If they didn't abort/cancel manually, fallback to ZIP download
        if (shareErr.name !== 'AbortError') {
          console.error("Web Share failed, falling back to ZIP download:", shareErr);
          // Load files into a new ZIP and download
          const fallbackZip = new JSZip();
          for (let i = 0; i < filesArray.length; i++) {
            fallbackZip.file(filesArray[i].name, filesArray[i]);
          }
          await this.generateAndDownloadZip(fallbackZip, albumName, failedUrls, originalContent);
          return;
        }
      }
    } else if (!canShare) {
      await this.generateAndDownloadZip(zip, albumName, failedUrls, originalContent);
      return;
    }
    
    // Restore button state
    this.downloadAllBtn.innerHTML = originalContent;
    this.downloadAllBtn.classList.remove('loading');
    this.downloadAllBtn.disabled = false;
    
    const succeededCount = filesArray.length;
    if (failedUrls.length > 0) {
      alert(`Download complete! ${succeededCount} items ready. ${failedUrls.length} items couldn't be retrieved due to browser security restrictions.`);
    }
  }

  async generateAndDownloadZip(zip, albumName, failedUrls, originalContent) {
    if (!zip) zip = new JSZip();
    
    if (failedUrls.length > 0) {
      let fileContent = "The following files could not be packaged directly into the zip archive because of browser security (CORS) or Google Drive access rules.\n";
      fileContent += "You can copy and paste the links below into your web browser to download them individually:\n\n";
      failedUrls.forEach(item => {
        fileContent += `${item.name}: ${item.url}\n\n`;
      });
      zip.file("FAILED_DOWNLOADS_LINKS.txt", fileContent);
    }
    
    this.downloadAllBtn.innerHTML = `
      <div class="download-spinner" style="margin-right: 8px;"></div>
      <span>Generating ZIP...</span>
    `;
    
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const zipFilename = `${albumName.replace(/[\s\W]+/g, '_') || 'Album_Media'}.zip`;
      
      const blobUrl = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (zipErr) {
      console.error("Zipping failed:", zipErr);
      alert("An error occurred while zipping files.");
    }
    
    this.downloadAllBtn.innerHTML = originalContent;
    this.downloadAllBtn.classList.remove('loading');
    this.downloadAllBtn.disabled = false;
  }
}
