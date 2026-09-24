/**
 * What a song is, in one line, read from its source: the first comment line that is not a flag (`// @hidden`,
 * `// @blog reason`), with the comment marks and a leading `name:` dropped. The video's title card and the song
 * list's note both use it, so a song reads the same on both.
 */
export function titleOf(name, source = '') {
  const base = name.replace(/\.strudel$/, '');
  let line = source.split('\n').map((l) => l.trim()).find((l) => l.startsWith('//') && !/^\/\/\s*@\w+\b/.test(l)) ?? '';
  line = line.replace(/^\/\/\s*/, '');
  if (line.startsWith(`${base}:`)) line = line.slice(base.length + 1).trim();
  return { name: base, line };
}
