/**
 * Route definitions for Ephemeral.
 *
 * URL patterns:
 * - / → OnboardingFlow (create/select config)
 * - /console → ProductPlacement (advertiser console)
 * - /consumer → Consumer demo (EphemeralCanvas with product features)
 * - /consumer/debug → Consumer demo with debug mode
 * - /prototype → Paris Drafting Table (product placement testing)
 * - /prototype/v2 → DraftingTableV2
  * - /:configSlug → NewSessionRoute (prompts for name, creates session)
 * - /:configSlug/:sessionSlug → CanvasRoute (loads and renders canvas)
 * - * → NotFound
 */

import { createBrowserRouter } from 'react-router-dom'
import OnboardingFlow from '@/components/OnboardingFlow'
import { ConsumerRoute } from './ConsumerRoute'
import { GenerativeGalleryRoute } from './GenerativeGalleryRoute'
import { NewSessionRoute } from './NewSessionRoute'
import { CanvasRoute } from './CanvasRoute'
import { NotFound } from './NotFound'
import DraftingTable from '@/prototypes/paris-drafting-table/DraftingTable'
import DraftingTableV2 from '@/prototypes/paris-drafting-table/DraftingTableV2'
import { ProductPlacement, Console, AdvertiserConsole } from '@/console'
import PasswordGate from '@/components/PasswordGate'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <OnboardingFlow />,
  },
  {
    path: '/console',
    element: (
      <PasswordGate
        theme="warm"
        title="Advertiser Console"
        subtitle="Enter password to access the campaign tools"
      >
        <Console />
      </PasswordGate>
    ),
  },
  {
    path: '/console/matrix',
    element: <ProductPlacement />,
  },
  {
    path: '/advertiser',
    element: <AdvertiserConsole />,
  },
  {
    path: '/consumer',
    element: <ConsumerRoute />,
  },
  {
    path: '/consumer/debug',
    element: <ConsumerRoute debugMode />,
  },
  {
    path: '/gallery',
    element: <GenerativeGalleryRoute />,
  },
  {
    path: '/gallery/debug',
    element: <GenerativeGalleryRoute debugMode />,
  },
  {
    path: '/prototype',
    element: <DraftingTable />,
  },
  {
    path: '/prototype/v2',
    element: <DraftingTableV2 />,
  },
  {
    path: '/:configSlug',
    element: <NewSessionRoute />,
  },
  {
    path: '/:configSlug/:sessionSlug',
    element: <CanvasRoute />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
