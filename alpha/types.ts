
export type Role = 'user' | 'model';
export type GenerationMode = 'chat' | 'pro' | 'search' | 'image' | 'video';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface Media {
  type: 'image' | 'video';
  url: string; 
  mimeType: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ContentPart {
  text?: string;
  media?: Media;
  sources?: GroundingSource[];
  isLoading?: boolean;
  status?: string; 
  isError?: boolean;
  isEditing?: boolean;
  originalMedia?: Media; // For image editing context
}

export interface Message {
  id: string;
  role: Role;
  parts: ContentPart[];
}
