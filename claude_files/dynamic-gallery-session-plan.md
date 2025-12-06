# Dynamic Gallery Session Persistence Plan

## Goal
Save generated images on-the-fly to backend storage so they can be reused in demos.

## Current State
- **Frontend**: `sessionRegistry.ts` stores canvas state in localStorage (cards, positions, user composition)
- **Backend**: `session_store.py` stores conversation history in-memory (ephemeral, for chat)
- **Images**: Currently generated on-the-fly, not persisted

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend (DynamicGalleryCanvas)                                      │
│                                                                      │
│  1. On image generation → POST /api/gallery/session/{id}/images     │
│  2. On session load → GET /api/gallery/session/{id}/images          │
│  3. Session state → localStorage (existing pattern)                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend (FastAPI)                                                    │
│                                                                      │
│  /api/gallery/sessions                                               │
│    GET  → list all sessions                                          │
│    POST → create new session                                         │
│                                                                      │
│  /api/gallery/session/{session_id}                                   │
│    GET    → get session metadata                                     │
│    DELETE → delete session and all images                            │
│                                                                      │
│  /api/gallery/session/{session_id}/images                            │
│    GET  → list images in session                                     │
│    POST → save new image (base64 or URL)                             │
│                                                                      │
│  /api/gallery/session/{session_id}/images/{image_id}                 │
│    GET    → serve image file                                         │
│    DELETE → delete single image                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Storage (File System)                                                │
│                                                                      │
│  backend/data/gallery/                                               │
│  ├── sessions.json              # Session metadata index             │
│  └── {session_id}/                                                   │
│      ├── metadata.json          # Session config, directives, etc.   │
│      ├── img_001.png            # Generated images                   │
│      ├── img_002.png                                                 │
│      └── ...                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Models

### GallerySession (Backend)
```python
@dataclass
class GallerySession:
    id: str                    # e.g., "gal-1733500000-abc123"
    name: str                  # Display name
    created_at: datetime
    updated_at: datetime

    # Context that influences generation
    user_composition: str      # What user wrote in WritingPane
    saved_products: list[str]  # Product IDs user saved

    # Generation settings
    directives_used: list[str] # Diversity directives generated

    # Image count (for quick listing without loading all)
    image_count: int
```

### GalleryImage (Backend)
```python
@dataclass
class GalleryImage:
    id: str                    # e.g., "img-001"
    session_id: str
    filename: str              # e.g., "img_001.png"
    created_at: datetime

    # Generation context (for reproducibility/demo)
    directive: str             # Which directive was used
    product_id: str            # Which product was featured
    product_name: str
    product_brand: str

    # Position in canvas (for demo replay)
    x: float                   # % position
    y: float                   # Absolute Y
    width: float
    height: float
```

## Implementation Steps

### Phase 1: Backend API
1. Create `backend/app/routers/gallery.py` with session CRUD endpoints
2. Create `backend/app/services/gallery_store.py` for file-based persistence
3. Add to `main.py` router registry

### Phase 2: Frontend Integration
1. Add `src/services/galleryApi.ts` with API client functions
2. Modify `DynamicGalleryCanvas.tsx`:
   - Add session ID management (create on first image, persist in URL/localStorage)
   - Call save API after each image generation
   - Add session picker UI (load existing sessions)
3. Add `/dynamic/:sessionId` route for loading existing sessions

### Phase 3: Demo Mode
1. Add "Replay Session" feature that loads a session and animates cards appearing
2. Add "Export Session" to download all images + metadata as ZIP

## File Locations
```
backend/
├── app/
│   ├── routers/
│   │   └── gallery.py          # NEW: Session API endpoints
│   └── services/
│       └── gallery_store.py    # NEW: File-based session storage
└── data/
    └── gallery/                # NEW: Image storage directory
        └── .gitkeep

src/
├── services/
│   └── galleryApi.ts           # NEW: Gallery API client
└── components/
    └── DynamicGalleryCanvas.tsx # MODIFIED: Add session integration
```

## API Endpoints Detail

### POST /api/gallery/sessions
Create a new session.
```json
// Request
{
  "name": "Morning Demo",
  "user_composition": "Looking for elegant evening wear..."
}

// Response
{
  "id": "gal-1733500000-abc123",
  "name": "Morning Demo",
  "created_at": "2024-12-06T...",
  "image_count": 0
}
```

### POST /api/gallery/session/{id}/images
Save a generated image.
```json
// Request
{
  "image_data": "base64...",  // OR
  "image_url": "https://...", // For Nano Banana URLs
  "directive": "Explore serene atmosphere with urban streets",
  "product_id": "product-0",
  "product_name": "Neverfull MM",
  "product_brand": "Louis Vuitton",
  "x": 44,
  "y": 280,
  "width": 180,
  "height": 220
}

// Response
{
  "id": "img-001",
  "filename": "img_001.png",
  "url": "/api/gallery/session/gal-.../images/img-001"
}
```

### GET /api/gallery/session/{id}/images
List all images in session (for loading demo).
```json
// Response
{
  "session_id": "gal-...",
  "images": [
    {
      "id": "img-001",
      "url": "/api/gallery/session/.../images/img-001",
      "directive": "...",
      "product_name": "Neverfull MM",
      "x": 44,
      "y": 280,
      "width": 180,
      "height": 220
    }
  ]
}
```

## Notes
- Images stored on disk (not in DB) for simplicity
- Session metadata in JSON files for easy inspection/editing
- Backend data directory should be in .gitignore (add sample data separately)
- For production: replace file storage with S3/GCS

## Questions to Decide
1. Should sessions auto-save or require explicit save button?
   - Recommend: Auto-save each image, with option to "discard session"

2. Should we store generated images as files or just URLs?
   - For Nano Banana: store URLs (they're already hosted)
   - For local generation: store files

3. Session naming?
   - Recommend: Auto-generate from date + first directive, allow rename
