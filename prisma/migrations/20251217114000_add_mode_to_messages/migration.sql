-- AddColumn: Add mode column to messages table
-- This migration adds the mode field to track which generation mode (CHAT, PRO, SEARCH, IMAGE, VIDEO)
-- was used for each message, enabling multi-mode conversation support.

ALTER TABLE "messages" ADD COLUMN "mode" "GenerationMode" NOT NULL DEFAULT 'CHAT'::"GenerationMode";
