const PROJECT_SLUG_MAX_LENGTH = 80;
const DEFAULT_PROJECT_SLUG = "project";

export function projectSlugFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PROJECT_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");

  return slug || DEFAULT_PROJECT_SLUG;
}

export function isProjectSlug(value: string) {
  return (
    value.length > 0 &&
    value.length <= PROJECT_SLUG_MAX_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

export async function createUniqueProjectSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
) {
  const base = projectSlugFromName(name);

  for (let attempt = 0; attempt < 1000; attempt++) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const prefixLength = PROJECT_SLUG_MAX_LENGTH - suffix.length;
    const prefix = base.slice(0, prefixLength).replace(/-+$/g, "") || DEFAULT_PROJECT_SLUG;
    const candidate = `${prefix}${suffix}`;

    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(`could not create a unique project slug for ${base}`);
}
