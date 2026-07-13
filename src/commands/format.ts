/** Shared plain-text formatting for slash-command notify output. */

export function formatHeading(title: string): string[] {
	return [title, "─".repeat(Math.min(Math.max(title.length, 12), 40))];
}

export function formatSection(title: string, body: string[]): string[] {
	return [
		"",
		title,
		...body.map((line) => (line.startsWith("  ") ? line : `  ${line}`)),
	];
}

export function formatKeyValue(
	label: string,
	value: string | number | undefined,
	width = 18,
): string {
	const padded = label.padEnd(width, " ");
	return `  ${padded} ${value ?? "n/a"}`;
}

export function formatBytes(bytes: number | undefined): string {
	if (bytes === undefined) return "unknown";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMs(value: number | undefined): string {
	if (value === undefined) return "n/a";
	if (value < 1000) return `${Math.round(value)} ms`;
	return `${(value / 1000).toFixed(1)} s`;
}

export function joinCommandLines(lines: string[]): string {
	return lines
		.filter((line, index) => !(line === "" && index === 0))
		.join("\n");
}
