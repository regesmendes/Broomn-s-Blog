import { createRequire as topLevelCreateRequire } from 'module';const require = topLevelCreateRequire(import.meta.url);import bannerUrl from 'url';const __dirname = bannerUrl.fileURLToPath(new URL('.', import.meta.url));

// open-next.config.ts
var config = {
  default: {},
  dangerous: {
    // ISR/SSG cache — unused (all routes are force-dynamic SSR)
    disableIncrementalCache: true,
    // revalidateTag/revalidatePath — unused
    disableTagCache: true
  }
};
var open_next_config_default = config;
export {
  open_next_config_default as default
};
