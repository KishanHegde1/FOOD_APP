export function trimStringTransform({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimLowercaseStringTransform({
  value,
}: {
  value: unknown;
}): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
