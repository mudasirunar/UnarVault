/**
 * UnarVault Main Application Bootstrapper & Router
 * Connects the data services and UI views.
 */

import { loadAlbums, getAlbumById } from './data.js';
import { HeroSlider, GalleryController } from './gallery.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize UI components
  const gallery = new GalleryController();
  
  // Initialize and start the hero slider
  const slider = new HeroSlider('.hero-slider', 4000);
  slider.start();
  
  // 2. Fetch all albums data from JSON
  const albums = await loadAlbums();
  
  // Render album list onto homepage
  gallery.renderAlbums(albums, (albumId) => {
    // Navigate via hash router
    window.location.hash = `album/${albumId}`;
  });
  
  // 3. Simple Client-Side Hash Router
  async function handleRouting() {
    const hash = window.location.hash;
    
    if (hash.startsWith('#album/')) {
      const albumId = hash.replace('#album/', '');
      const album = await getAlbumById(albumId);
      
      if (album) {
        slider.stop(); // Stop hero rotation when viewing a detailed gallery
        gallery.openAlbum(album);
      } else {
        // Fallback to home if album doesn't exist
        window.location.hash = '';
      }
    } else {
      // Home state
      gallery.showHomeView();
      slider.start(); // Resume slideshow on return to home
    }
  }
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleRouting);
  
  // Execute routing on initial page load
  handleRouting();
});
