import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type PluginOption } from 'vite';
import fs from 'fs';

export default defineConfig({
	server: {
		host: '127.0.0.1',
		allowedHosts: ['app.local.test', 'local.test'],
		port: 5173,
		strictPort: true,
		https: {
			key: fs.readFileSync('./key.pem'),
			cert: fs.readFileSync('./cert.pem')
		}
	},
	plugins: [tailwindcss() as PluginOption[], sveltekit()],
	define: { __VERSION__: JSON.stringify(process.env.npm_package_version) }
});
