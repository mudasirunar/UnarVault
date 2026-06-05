# AI Rules & Guidelines for UnarVault

This document outlines the strict guidelines and engineering principles to be followed for developing the UnarVault family gallery website.

---

## 🧠 Engineering Principles

1. **Modular and Clean Code**:
   - Keep JavaScript code modular by separating different concerns (e.g., UI rendering, data loading, navigation).
   - Use ES Modules (`import`/`export`) to structure frontend components and utilities.

2. **Layer Separation**:
   - **UI Layer**: Handles display, rendering elements, modals, and capturing user interaction.
   - **Data Layer**: Handles fetching, parsing, and caching album and media metadata from `/data/albums.json`.
   - **Logic Layer**: Connects data and UI layers, orchestrates page routing, lazy loading, and slider timers.

3. **No Hardcoded Media**:
   - Absolutely no photos, videos, or image assets should be hardcoded inside components. All media links, titles, descriptions, and formats must be loaded dynamically from the dataset.

4. **Centralized Data Storage**:
   - `/data/albums.json` is the single source of truth for the list of albums.

5. **Future-Proof Storage Integrations**:
   - The UI and data layers must be architected so they can scale to integrate with external providers:
     - **Google Drive**: Storing images and videos inside albums.
     - **Cloudinary**: For high-performance, dynamic image resizing and optimization.
     - **YouTube**: Embodying video clips.

6. **Frontend Only (Static)**:
   - There should be no backend or server-side rendering setup for now. Maintain a purely static, client-side application that can be run on any simple web host.

---

## 🎨 UI / UX Principles (STRICT)

1. **Minimal & Premium Design**:
   - Design clean, high-contrast, modern pages inspired by Apple Photos and Google Photos.
   - Use dynamic, responsive grids and clean whitespace.

2. **STRICT Color Code**:
   - ❌ **NO purple-to-pink gradients** are allowed anywhere in the interface.
   - Use a neutral, luxury-tier color scheme:
     - **Primary/Background**: White (`#ffffff`), premium dark grey/black (`#121212` / `#0a0a0a`), and soft light greys (`#f5f5f7` / `#e5e5ea`).
     - **Text**: Clear black (`#000000`) or charcoal (`#1c1c1e`) on light backgrounds; pure white (`#ffffff`) or light grey (`#aeaeb2`) on dark backgrounds.
     - **Accents**: Subtle light blue accents (`#0071e3`) for active states, links, and selections.

3. **Smooth Animations**:
   - All transitions (e.g., hover states, slide shows, modal opens) must be smooth, subtle, and low-latency. Avoid flashy, complex, or slow animations.

4. **Mobile-First Responsive Layout**:
   - Ensure the layout degrades elegantly:
     - Desktop: 3 to 4 columns.
     - Tablet: 2 columns.
     - Mobile: 1 column.
   - All elements must support touch controls (swiping modal photos, tapping cards).

5. **Performance First**:
   - Implement lazy loading for images and video thumbnails.
   - Avoid heavy client-side packages. Use standard vanilla APIs.

---

## 📁 Data Principles

- **JSON Config Source**: All albums must come from `/data/albums.json`.
- **Album Schema**:
  Each album entry must adhere to the following JSON structure:
  ```json
  {
    "id": "unique_album_id",
    "name": "Album Name",
    "type": "images" | "videos",
    "thumbnail": "https://url-to-placeholder-or-external-image.jpg",
    "description": "Short description of the memory/trip",
    "source": "drive_folder_id_or_url"
  }
  ```
- **External Media Storage**: The local repository must not store large memory assets (photos/videos). It acts exclusively as a viewer.

---

## ⚙️ Future Support Architecture

- Place media retrieval methods inside a dedicated media service (e.g. `js/mediaService.js`).
- For now, resolve references to simple mock URL arrays, but prepare hooks for Google Drive folders, Cloudinary links, and YouTube embeds.
