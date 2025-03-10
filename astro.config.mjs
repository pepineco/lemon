import { defineConfig } from 'astro/config';
import { CUSTOM_DOMAIN, BASE_PATH } from './src/server-constants';
import CoverImageDownloader from './src/integrations/cover-image-downloader';
import CustomIconDownloader from './src/integrations/custom-icon-downloader';
import FeaturedImageDownloader from './src/integrations/featured-image-downloader';
import PublicNotionCopier from './src/integrations/public-notion-copier';
import vercel from '@astrojs/vercel/serverless';
//import awsAmplify from 'astro-aws-amplify';

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
		CoverImageDownloader(),
		CustomIconDownloader(),
		FeaturedImageDownloader(),
		PublicNotionCopier(),
	],
	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: `@import "src/styles/_mixin.scss";`
				}
			}
		},
	},
	output: 'server',
	adapter: vercel(),
	//adapter: awsAmplify()

});
