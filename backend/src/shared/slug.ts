export function slugify(input: string, maxLength = 60): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}

/** The suffix keeps equal titles from colliding; the caller supplies a short random string. */
export function productSlug(title: string, suffix: string): string {
  return `${slugify(title, 180) || 'product'}-${suffix}`;
}
