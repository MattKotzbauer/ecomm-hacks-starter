# Deploy Campaign Feature Plan

## What Gets Saved

**Campaign Configuration:**
- Campaign name (auto-generated or user-provided)
- Created timestamp
- Brand/Collection info

**Audience Targeting:**
- Demographics (age range)
- Selected interests
- Scene preferences
- Semantic description

**Generated Assets:**
- All placements (scene images, composed images, masks)
- Product selections and rationale
- Placement hints

## Storage Options

### Option A: IndexedDB (Client-side)
- **Pros:** Already using for placements, no backend changes, works offline
- **Cons:** Lost if browser data cleared, not shareable across devices
- **Implementation:** Add `campaigns` store to existing IndexedDB

### Option B: Backend API + Database
- **Pros:** Persistent, shareable, can integrate with other services
- **Cons:** Requires backend changes, storage costs
- **Implementation:**
  - `POST /api/campaigns` - create campaign
  - `GET /api/campaigns` - list campaigns
  - `GET /api/campaigns/:id` - get specific campaign

### Option C: JSON Export (Download)
- **Pros:** Simple, portable, user controls their data
- **Cons:** Manual management, large file sizes (images are base64)
- **Implementation:** Generate and download JSON blob

### Option D: Hybrid (IndexedDB + Export)
- **Pros:** Best of both - local persistence + exportability
- **Implementation:** Save to IndexedDB, offer "Export" button

## Recommended Approach: Option D (Hybrid)

1. **On "Deploy Campaign":**
   - Prompt for campaign name (optional, auto-generate default)
   - Save to IndexedDB `campaigns` store
   - Show success toast with campaign name
   - Offer to start fresh or continue editing

2. **Campaign Management UI:**
   - Add "Campaigns" dropdown/panel
   - List saved campaigns with timestamps
   - Load previous campaign
   - Export campaign as JSON
   - Delete campaign

3. **Data Structure:**
```typescript
interface Campaign {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  brand: string
  audience: {
    ageRange: string
    interests: string[]
    scenePreferences: string[]
    semanticDescription: string
  }
  placements: ScenePlacement[]
}
```

## Implementation Steps

1. Add `campaigns` IndexedDB store
2. Create save/load/list/delete functions
3. Update Deploy button to save campaign
4. Add campaign name input modal
5. Add "Load Campaign" UI
6. Add "Export as JSON" button
7. Add "Clear & Start Fresh" option

## Questions

- Should deploying clear current placements for fresh start?
- Should there be a "Campaigns" management panel in the UI?
- Export format: JSON only, or also include image files?
