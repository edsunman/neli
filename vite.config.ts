import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
//import mkcert from 'vite-plugin-mkcert';
import { defineConfig /* , type ViteDevServer  */ } from 'vite';

/* const myPlugin = () => ({
	name: 'allow-worker-file',
	configureServer(server: ViteDevServer) {
		server.middlewares.use((req, res, next) => {
			if (req.originalUrl === '/src/lib/worker/worker.ts?worker_file&type=module') {
				res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
			}
			next();
		});
	}
}); */

export default defineConfig({
	plugins: [tailwindcss(), sveltekit() /*  myPlugin() , mkcert() */],
	define: { __VERSION__: JSON.stringify(process.env.npm_package_version) }
});
