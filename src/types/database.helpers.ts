import type { Database } from './database.types';

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];

export type TablesInsert<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert'];

export type TablesUpdate<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update'];

export type Card = Tables<'cards'>;
export type CardInsert = TablesInsert<'cards'>;
export type CardUpdate = TablesUpdate<'cards'>;
export type CardImage = Tables<'card_images'>;
export type ProcessingJob = Tables<'processing_jobs'>;
