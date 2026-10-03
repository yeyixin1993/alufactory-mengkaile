/** Portable source-library identity; not a procurement SKU. */
export interface UnifiedPartReference {
  readonly schemaVersion: 1;
  readonly catalogRevision: string;
  readonly catalogItemId: string;
  readonly categoryId: string;
  readonly sourceRecordId: string;
}
