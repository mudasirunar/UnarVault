/**
 * UnarVault Data Layer
 * Handles fetching, parsing, and query helpers for the albums database.
 */

import albumsData from '../data/albums.json';

// Google Apps Script Web App Deployment URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzue4gbVwspqTWelN7qiwclr3RwpMtj85FhKYLEFvAbo0K5wxZlJqsOo_1E3t86Fky1/exec';

let cachedAlbums = albumsData;

/**
 * Loads albums and media metadata from the centralized albums.json.
 * @returns {Promise<Array>} List of albums
 */
export async function loadAlbums() {
  return cachedAlbums;
}

/**
 * Returns a specific album metadata by its ID.
 * @param {string} albumId - ID of the album
 * @returns {Promise<object|null>} Album details or null
 */
export async function getAlbumById(albumId) {
  const albums = await loadAlbums();
  return albums.find(album => album.id === albumId) || null;
}

/**
 * Returns all media items for a given album.
 * Fetches dynamically from Google Drive if folder ID source is set.
 * @param {object} album - Album object
 * @returns {Promise<Array>} List of media items
 */
export async function getMediaForAlbum(album) {
  if (!album) return [];
  
  // If source is a Google Drive folder ID (i.e. not empty and not local)
  if (album.source && album.source !== "local" && !album.source.startsWith("http")) {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?folderId=${album.source}`);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      const mediaList = await response.json();
      if (mediaList.error) {
        throw new Error(mediaList.error);
      }
      return mediaList;
    } catch (error) {
      console.error("Google Drive Fetch Error:", error);
      throw error; // Propagate for UI handling
    }
  }
  
  return album.media || [];
}
