/**
 * UnarVault Data Layer
 * Handles fetching, parsing, and query helpers for the albums database.
 */

let cachedAlbums = null;

/**
 * Loads albums and media metadata from the centralized albums.json.
 * @returns {Promise<Array>} List of albums
 */
export async function loadAlbums() {
  if (cachedAlbums) {
    return cachedAlbums;
  }
  
  try {
    const response = await fetch('./data/albums.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch albums.json: ${response.statusText}`);
    }
    cachedAlbums = await response.json();
    return cachedAlbums;
  } catch (error) {
    console.error("Error loading albums database:", error);
    return [];
  }
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
 * Returns all media items for a given album ID.
 * Supports future integrations by abstraction.
 * @param {string} albumId - ID of the album
 * @returns {Promise<Array>} List of media items
 */
export async function getMediaForAlbum(albumId) {
  const album = await getAlbumById(albumId);
  if (!album) return [];
  
  // Design architecture supports Google Drive/Cloudinary/YouTube later.
  // In the future, if source points to drive_folder_id or a Cloudinary API,
  // we would trigger an external API call here:
  //
  // if (album.source.startsWith('drive_folder_')) {
  //    return await fetchFromGoogleDriveAPI(album.source);
  // }
  
  return album.media || [];
}
