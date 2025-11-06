# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Creative Flow Studio is a React + TypeScript application that integrates multiple Google Gemini AI capabilities into a single chat interface. It supports text generation (chat, pro mode with thinking, search-grounded), image generation/editing (Imagen 4.0), video generation (Veo 3.1), and multimodal interactions. The app features a DJ Shacho Mode that applies a unique persona (high-energy, Kyushu dialect speaking entrepreneur) to text responses.

## Development Commands

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

## Architecture

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

### Environment Configuration

- API key is set in `.env.local` as `GEMINI_API_KEY`
- Vite config maps this to `process.env.API_KEY` at build time
- The app also integrates with AI Studio's key selection dialog via `window.aistudio` API

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
