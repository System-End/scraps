export function formatHours(hours: number): string {
	return hours.toFixed(1);
}

const ALLOWED_GITHUB_HOSTS = ['github.com', 'www.github.com'];

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

	if (!ALLOWED_GITHUB_HOSTS.includes(parsed.hostname)) {
		return { valid: false, error: 'Must be a github.com URL' };
	}

	const pathParts = parsed.pathname.split('/').filter((p) => p.length > 0);
	if (pathParts.length < 2) {
		return { valid: false, error: 'Must include user and repository (e.g. https://github.com/user/repo)' };
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