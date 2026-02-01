import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const urls = {
	ipv4: 'https://www.cloudflare.com/ips-v4',
	ipv6: 'https://www.cloudflare.com/ips-v6',
};

async function fetchList(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	return (await response.text())
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

async function main() {
	const [ipv4, ipv6] = await Promise.all([fetchList(urls.ipv4), fetchList(urls.ipv6)]);

	const payload = { ipv4, ipv6 };

	const outPath = fileURLToPath(new URL('../terraform/cloudflare-ips.json', import.meta.url));
	await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);

	console.log(
		'Updated Cloudflare IP list with',
		ipv4.length,
		'IPv4 and',
		ipv6.length,
		'IPv6 ranges'
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
