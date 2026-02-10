export function formatHours(hours: number): string {
	return hours.toFixed(1);
}

export function validateGithubUrl(url: string | null | undefined): { valid: boolean; error?: string } {
	if (!url || !url.trim()) return { valid: true };
	const trimmed = url.trim();

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { valid: false, error: 'Not a valid URL' };
	}

	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		return { valid: false, error: 'Must use http or https' };
	}
	return { valid: true };
}

export function validatePlayableUrl(url: string | null | undefined): { valid: boolean; error?: string } {
	if (!url || !url.trim()) return { valid: true };
	const trimmed = url.trim();

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { valid: false, error: 'Not a valid URL' };
	}

	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		return { valid: false, error: 'Must use http or https' };
	}

	if (!parsed.hostname.includes('.')) {
		return { valid: false, error: 'Must be a valid public URL' };
	}

	return { valid: true };
}