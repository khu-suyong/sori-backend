import { z } from '@hono/zod-openapi';

import { Entity, ID } from '../../common/common.schema';

export type Note = z.infer<typeof NoteSchema>;
export const NoteSchema = Entity.extend({
  workspaceId: z.string(),

  name: z.string(),
});

export type TranscribeLine = z.infer<typeof TranscribeLineSchema>;
export const TranscribeLineSchema = z.object({
  speaker: z.number(),
  text: z.string(),
  start: z.string(),
  end: z.string(),
  detected_language: z.string().optional(),
});

export type Transcribe = z.infer<typeof TranscribeSchema>;
export const TranscribeSchema = z.object({
  status: z.enum(['error', 'active_transcription', 'no_audio_detected']),
  lines: TranscribeLineSchema.array(),
  buffer_transcription: z.string(),
  buffer_diarization: z.string(),
  remaining_time_transcription: z.number(),
  remaining_time_diarization: z.number(),
});

//

export type CreatableNote = z.infer<typeof CreatableNoteSchema>;
export const CreatableNoteSchema = NoteSchema
  .pick({ name: true })
  .extend({
    folderId: ID.optional().openapi({ description: '노트를 생성할 폴더 ID' }),
  })
  .openapi('CreatableNote');

export type EditableNote = z.infer<typeof EditableNoteSchema>;
export const EditableNoteSchema = CreatableNoteSchema
  .partial()
  .extend({
    folderId: ID.nullable().optional().openapi({ description: '노트가 속할 폴더 ID. 최상위 노트로 변경 시 null' }),
  })
  .openapi('EditableNote');

//

export type PublicNote = z.infer<typeof PublicNoteSchema>;
export const PublicNoteSchema = NoteSchema
  .pick({ id: true, name: true })
  .openapi('Note');

