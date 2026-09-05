/** Minimal, dependency-free renderer for the analyst's markdown-style answers. */

function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {list.map((item, i) => (
          <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const key = `b${index}`;
    if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
      list.push(line.replace(/^\s*([-*•]|\d+\.)\s+/, ""));
      return;
    }
    flush(`${key}-list`);
    if (line.trim() === "") return;
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <h3 key={key} className="mt-4 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
          {heading[2]}
        </h3>,
      );
      return;
    }
    blocks.push(
      <p key={key} className="my-2 text-sm leading-relaxed first:mt-0">
        {inline(line, key)}
      </p>,
    );
  });
  flush("tail-list");

  return <div className="text-foreground">{blocks}</div>;
}
