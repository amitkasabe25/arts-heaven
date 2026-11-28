export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Generates a server-owned S3 key. Client-supplied names are never used verbatim. */
export function objectKey(prefix: string, originalName: string): string {
  const safeName = slugify(originalName.replace(/\.[^.]+$/, '')).slice(0, 48) || 'upload';
  const extension = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : 'bin';
  const random = crypto.randomUUID().replace(/-/g, '');
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${random}-${safeName}.${extension}`;
}
