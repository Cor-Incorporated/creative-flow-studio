# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Creative Flow Studio is a React + TypeScript application that integrates multiple Google Gemini AI capabilities into a single chat interface. It supports text generation (chat, pro mode with thinking, search-grounded), image generation/editing (Imagen 4.0), video generation (Veo 3.1), and multimodal interactions.

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
- Integrates with AI Studio's API key management via `window.aistudio` global
- Delegates all Gemini API calls to `services/geminiService.ts`
- Handles async video generation polling with progress updates

### Key Components

**ChatInput** (`components/ChatInput.tsx`)
- Mode selector buttons for switching between generation modes
- Aspect ratio controls for image/video generation
- File upload handling for multimodal inputs
- Paste support for images

**ChatMessage** (`components/ChatMessage.tsx`)
- Renders different content types: text, images, videos, loading states
- Supports image editing workflow (hover to trigger edit prompt)
- Downloads generated media
- Displays grounding sources for search mode

### Service Layer

**geminiService.ts** (`services/geminiService.ts`)
- All Gemini API interactions go through this service
- Creates fresh `GoogleGenAI` client on each call to ensure latest API key is used
- Key functions:
  - `generateChatResponse()` - Uses gemini-2.5-flash with conversation history
  - `generateProResponse()` - Uses gemini-2.5-pro with thinking budget
  - `generateSearchGroundedResponse()` - Uses googleSearch tool for grounded answers
  - `generateImage()` - Imagen 4.0 with configurable aspect ratios
  - `analyzeImage()` - Vision capabilities for uploaded images
  - `editImage()` - Uses gemini-2.5-flash-image with IMAGE response modality
  - `generateVideo()` - Veo 3.1 (long-running operation, requires polling)
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

## Project Structure

```
/
├── App.tsx              # Main application component & orchestration
├── types.ts             # TypeScript interfaces for messages, media, modes
├── components/          # React components
│   ├── ChatInput.tsx    # Input area with mode/aspect ratio controls
│   ├── ChatMessage.tsx  # Message rendering (text/image/video/sources)
│   ├── ApiKeyModal.tsx  # API key selection prompt
│   └── icons.tsx        # SVG icon components
├── services/
│   └── geminiService.ts # All Gemini API interactions
└── utils/
    └── fileUtils.ts     # File/base64 conversion utilities
```
