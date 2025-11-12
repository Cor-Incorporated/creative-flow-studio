# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Creative Flow Studio is a multimodal AI application that integrates multiple Google Gemini AI capabilities into a single chat interface. It supports text generation (chat, pro mode with thinking, search-grounded), image generation/editing (Imagen 4.0), video generation (Veo 3.1), and multimodal interactions. The app features a DJ Shacho Mode that applies a unique persona (high-energy, Kyushu dialect speaking entrepreneur) to text responses.

### Current Status and Roadmap

**Alpha Version (main branch):**
- React + TypeScript + Vite frontend-only application
- Deployed on Vercel
- Currently maintained for alpha users
- **This is the version documented in this file**

**Next-Generation Full-Stack SaaS (develop branch):**
- Migration to Next.js 14 (App Router) with backend API
- Target: Full-stack SaaS architecture with authentication, payment, conversation history, and admin dashboard
- Infrastructure: Google Cloud Platform (GCP) with Terraform IaC
- See `docs/implementation-plan.md` for detailed migration plan and GCP configuration

## Branch Strategy

- **main**: Alpha version (Vite + React frontend-only app), deployed to Vercel
- **develop**: Next-generation full-stack SaaS (Next.js 14 + backend), under active development

**IMPORTANT:** Always check which branch you're working on. The architecture, commands, and implementation patterns differ significantly between branches.

## Development Commands (main branch - Alpha Version)

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment (main branch)

- **Platform**: Vercel
- **Trigger**: Automatic deployment on push to main branch
- **Environment Variables**: `GEMINI_API_KEY` must be set in Vercel project settings

## Architecture (main branch - Alpha Version)

**Note:** This section describes the current alpha version on the main branch. For the next-generation architecture on develop branch, see `docs/implementation-plan.md`.

### Core Application Flow

**App.tsx** is the main orchestrator that:
- Manages conversation state (`messages` array)
- Handles mode switching between 5 generation modes: `chat`, `pro`, `search`, `image`, `video`
- Manages DJ Shacho Mode toggle (`isDjShachoMode` state) which applies persona styling to text responses
- Integrates with AI Studio's API key management via `window.aistudio` global
- Delegates all Gemini API calls to `services/geminiService.ts` with optional `systemInstruction` and `temperature` parameters
- Handles async video generation polling with progress updates
- Converts error messages to DJ Shacho style when DJ Shacho Mode is enabled

### Key Components

**ChatInput** (`components/ChatInput.tsx`)
- Mode selector buttons for switching between generation modes
- DJ Shacho Mode toggle button for persona switching
- Aspect ratio controls for image/video generation
- File upload handling for multimodal inputs
- Paste support for images

**ChatMessage** (`components/ChatMessage.tsx`)
- Renders different content types: text, images, videos, loading states
- Displays DJ Shacho avatar when DJ Shacho Mode is enabled
- Supports image editing workflow (hover to trigger edit prompt)
- Downloads generated media
- Displays grounding sources for search mode

### Service Layer

**geminiService.ts** (`services/geminiService.ts`)
- All Gemini API interactions go through this service
- Creates fresh `GoogleGenAI` client on each call to ensure latest API key is used
- Key functions:
  - `generateChatResponse()` - Uses gemini-2.5-flash with conversation history; supports `systemInstruction` and `temperature` for DJ Shacho Mode
  - `generateProResponse()` - Uses gemini-2.5-pro with thinking budget; supports `systemInstruction` and `temperature` for DJ Shacho Mode
  - `generateSearchGroundedResponse()` - Uses googleSearch tool for grounded answers; supports DJ Shacho Mode with dual-pass approach (search then reformat)
  - `generateImage()` - Imagen 4.0 with configurable aspect ratios (note: DJ Shacho Mode does not modify prompts to comply with policy)
  - `analyzeImage()` - Vision capabilities for uploaded images; supports `systemInstruction` for DJ Shacho Mode
  - `editImage()` - Uses gemini-2.5-flash-image with IMAGE response modality
  - `generateVideo()` - Veo 3.1 (long-running operation, requires polling; note: DJ Shacho Mode does not modify prompts to comply with policy)
  - `pollVideoOperation()` - Checks video generation status

### Type System

**types.ts** defines the core data structures:
- `Message` - Chat message with `role` ('user' | 'model') and `parts` array
- `ContentPart` - Can contain text, media, grounding sources, loading/error states
- `Media` - Represents image/video with data URL and MIME type
- `GenerationMode` - Five modes: 'chat' | 'pro' | 'search' | 'image' | 'video'
- `AspectRatio` - Supported ratios: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'

**types/gemini.ts** extends @google/genai types:
- Custom type definitions for Gemini API responses (handles both documented and undocumented shortcuts)
- `extractTextFromResponse()` - Safely extracts text from responses (handles both `.text` shorthand and full candidate structure)
- Type guards: `isTextPart()` and `isInlineDataPart()` for discriminating between Gemini part types
- Provides structured types for chat config and generate content config

### Environment Configuration

- API key is set in `.env.local` as `GEMINI_API_KEY`
- Vite config maps this to both `process.env.API_KEY` and `process.env.GEMINI_API_KEY` at build time
- The app also integrates with AI Studio's key selection dialog via `window.aistudio` API
- Path aliasing: `@/` is configured to resolve to project root (e.g., `import { foo } from '@/utils/bar'`)

### Video Generation Pattern

Video generation is asynchronous and requires polling:
1. Call `generateVideo()` to start operation
2. Poll with `pollVideoOperation()` every 5 seconds
3. Check `operation.done` and `operation.metadata.progressPercentage`
4. When done, retrieve video from `operation.response.generatedVideos[0].video.uri`
5. Append API key to download URL and convert to blob/data URL for display

### Image Editing Workflow

1. User hovers over generated image in `ChatMessage`
2. Edit button appears with text input
3. Original image is passed as context with edit prompt
4. `editImage()` uses the flash-image model with IMAGE response modality
5. New edited image replaces loading state in conversation

## Important Implementation Notes

- **API Client Pattern**: `getAiClient()` is called on every request to ensure fresh API key after user selection
- **Message Updates**: Use `updateLastMessage()` or map over messages array to update loading/progress states
- **Error Handling**: `handleApiError()` detects specific error patterns (e.g., invalid API key) and updates UI state
- **Conversation History**: For chat mode, entire message history is flattened and passed to maintain context
- **Media Handling**: Images/videos use data URLs (base64) for display; `dataUrlToBase64()` utility extracts raw base64 for API calls
- **Memory Management**: Blob URLs are tracked in `blobUrlsRef` and cleaned up on component unmount to prevent memory leaks
- **DJ Shacho Mode Ref Pattern**: `isDjShachoModeRef` is used alongside state to avoid race conditions in async operations (updated immediately during render, not in useEffect)

## Input Validation and Constants

The application includes comprehensive input validation and centralized constants for better maintainability and security.

**Constants (`constants.ts`):**

- `MAX_PROMPT_LENGTH`: 30,000 characters (Gemini API limit)
- `MAX_FILE_SIZE`: 10MB limit for uploaded files
- `ALLOWED_IMAGE_TYPES`: Permitted image MIME types (JPEG, PNG, WebP, GIF)
- `ALLOWED_VIDEO_TYPES`: Permitted video MIME types (MP4, WebM, QuickTime, AVI, MPEG)
- `DJ_SHACHO_TEMPERATURE`: 0.9 (creative temperature for DJ Shacho responses)
- `THINKING_BUDGET`: 32,768 tokens for Pro mode thinking
- `VIDEO_POLL_INTERVAL_MS`: 5,000ms polling interval
- `MAX_VIDEO_POLL_ATTEMPTS`: 120 attempts (10 minutes max)
- `ERROR_MESSAGES`: Centralized error message strings

**Validation in ChatInput:**

- File size checked against MAX_FILE_SIZE before upload
- MIME type validated against allowed types
- Prompt length validated before submission
- Visual error messages displayed to user
- Paste functionality includes same validation

**Video Polling Improvements:**

- Timeout protection with MAX_VIDEO_POLL_ATTEMPTS
- Progress percentage clamped to 0-100 range
- Clear timeout error messages
- Prevents infinite polling loops

## DJ Shacho Mode

DJ Shacho Mode is a special persona mode that transforms text responses to match the speaking style of DJ Shacho (Shunsuke Kimoto), leader of Repezen Foxx and charismatic entrepreneur.

**Characteristics:**

- High-energy, enthusiastic tone
- Kyushu dialect (Japanese regional dialect)
- Positive, motivational messaging
- Distinctive verbal patterns and expressions

**Implementation:**

- Toggle enabled via ChatInput component
- System instruction (`DJ_SHACHO_SYSTEM_PROMPT`) passed to text generation APIs
- Temperature set to 0.9 for more creative/varied responses
- Error messages also converted to DJ Shacho style for consistency
- Image/video prompts NOT modified (to comply with API policies on real person names)
- Search mode uses dual-pass: search execution then style reformatting

**Files:**

- `services/prompts/djShachoPrompt.ts` - System prompts and templates
- `DJ_Shacho_400x400.jpg` - Avatar image displayed in chat messages

## Styling

The app uses Tailwind CSS for styling:

- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS configuration for Tailwind
- `index.css` - Tailwind directives and global styles

## Project Structure

```text
/
├── App.tsx                    # Main application component & orchestration
├── index.tsx                  # React entry point
├── index.html                 # HTML template
├── index.css                  # Tailwind directives & global styles
├── types.ts                   # TypeScript interfaces for messages, media, modes
├── types/
│   └── gemini.ts             # Extended Gemini API types & helper functions
├── constants.ts               # Centralized constants & validation limits
├── vite-env.d.ts             # Vite type definitions
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
├── DJ_Shacho_400x400.jpg     # DJ Shacho avatar image
├── components/               # React components
│   ├── ChatInput.tsx         # Input area with mode/aspect ratio/DJ Shacho controls
│   ├── ChatMessage.tsx       # Message rendering (text/image/video/sources/avatar)
│   ├── ApiKeyModal.tsx       # API key selection prompt
│   └── icons.tsx             # SVG icon components
├── services/
│   ├── geminiService.ts      # All Gemini API interactions
│   └── prompts/
│       └── djShachoPrompt.ts # DJ Shacho system prompts & templates
└── utils/
    └── fileUtils.ts          # File/base64 conversion utilities
```

## Future Architecture (develop branch)

The next-generation version is being developed on the `develop` branch with a completely different architecture:

### Planned Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Runtime**: Node.js on Cloud Run
- **Database**: Prisma ORM + Cloud SQL for PostgreSQL
- **Authentication**: NextAuth.js + Supabase Auth / OAuth
- **Payment**: Stripe Billing + Checkout + Webhook
- **Storage**: Cloud Storage (or Supabase Storage)
- **IaC**: Terraform
- **CI/CD**: Cloud Build + Artifact Registry + Cloud Run
- **Monitoring**: Cloud Logging / Cloud Monitoring / OpenTelemetry

### Implementation Phases

1. **Phase 0**: Requirements analysis
2. **Phase 1**: Foundation design (data models, RBAC, multi-tenancy)
3. **Phase 2**: Environment setup (Next.js + Prisma + dev tools)
4. **Phase 3**: Authentication & user management (NextAuth.js)
5. **Phase 4**: Conversation history persistence (API Routes + DB)
6. **Phase 5**: Plan management & Stripe integration
7. **Phase 6**: Admin dashboard & monitoring
8. **Phase 7**: QA & operations

### Google Cloud Configuration

- **Project ID**: `dataanalyticsclinic`
- **Primary Region**: `asia-northeast1`
- **Artifact Registry**: `creative-flow-studio` (Docker images)
- **Terraform State**: `gs://dataanalyticsclinic-terraform-state`
- **Service Accounts**: Configured for Cloud Run, Cloud Build, and Terraform

For detailed GCP setup, service account roles, and API configurations, see `docs/implementation-plan.md`.
