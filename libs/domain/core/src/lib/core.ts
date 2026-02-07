export interface DocumentIdentity {
  path: string;
  size: number;
  modifiedAt: number;
}

export const createDocumentIdentity = (
  path: string,
  size: number,
  modifiedAt: number,
): DocumentIdentity => ({
  path,
  size,
  modifiedAt,
});
