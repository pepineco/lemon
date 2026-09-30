import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import icon from "astro-icon";
import vercel from '@astrojs/vercel/serverless';
//import awsAmplify from 'astro-aws-amplify';

const fileEnv = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
for (const [key, value] of Object.entries(fileEnv)) {
	if (process.env[key] === undefined) {
		process.env[key] = value;
	}
}

const { CUSTOM_DOMAIN, BASE_PATH } = await import('./src/server-constants.ts');
const { default: CoverImageDownloader } = await import('./src/integrations/cover-image-downloader.ts');
const { default: CustomIconDownloader } = await import('./src/integrations/custom-icon-downloader.ts');
const { default: FeaturedImageDownloader } = await import('./src/integrations/featured-image-downloader.ts');
const { default: PublicNotionCopier } = await import('./src/integrations/public-notion-copier.ts');

const getSite = function () {
	if (CUSTOM_DOMAIN) {
		return new URL(BASE_PATH, `https://${CUSTOM_DOMAIN}`).toString();
	}

	if (process.env.VERCEL && process.env.VERCEL_URL) {
		return new URL(BASE_PATH, `https://${process.env.VERCEL_URL}`).toString();
	}

	if (process.env.CF_PAGES) {
		if (process.env.CF_PAGES_BRANCH !== 'main') {
			return new URL(BASE_PATH, process.env.CF_PAGES_URL).toString();
		}

		return new URL(
			BASE_PATH,
			`https://${new URL(process.env.CF_PAGES_URL).host
				.split('.')
				.slice(1)
				.join('.')}`
		).toString();
	}

	return new URL(BASE_PATH, 'http://localhost:4321').toString();
};

// https://astro.build/config
export default defineConfig({
	site: getSite(),
	base: BASE_PATH,
	integrations: [
		icon(),
		CoverImageDownloader(),
		CustomIconDownloader(),
		FeaturedImageDownloader(),
		PublicNotionCopier(),
	],
	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: `@use "src/styles/mixin" as *;`
				}
			}
		},
	},
	output: 'server',
	adapter: vercel(),
	//adapter: awsAmplify()

});
