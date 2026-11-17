import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'be-the-baseball-legend',
  brand: { primaryColor: '#1D4ED8' },
  permissions: [],
  navigationBar: { withTitle: false, withBackButton: false, transparentBackground: true, theme: 'dark' },
  webView: { bounces: false, pullToRefreshEnabled: false },
  webBundleDir: 'dist-toss',
});
