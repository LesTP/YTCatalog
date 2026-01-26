const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env) => {
  // Determine target browser from env (default: chrome)
  const targetBrowser = env?.browser || 'chrome';
  const isFirefox = targetBrowser === 'firefox';

  return {
    mode: 'development',
    devtool: 'inline-source-map',
    entry: {
      'content/youtube': './src/content/youtube.ts',
      'background/service-worker': './src/background/service-worker.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/manifest.json',
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());

              if (isFirefox) {
                // Firefox: use scripts array, remove service_worker
                manifest.background = {
                  scripts: ['background/service-worker.js']
                };
              } else {
                // Chrome: use service_worker only, remove scripts
                manifest.background = {
                  service_worker: 'background/service-worker.js'
                };
                // Remove Firefox-specific settings for Chrome
                delete manifest.browser_specific_settings;
              }

              return JSON.stringify(manifest, null, 2);
            }
          },
          { from: 'src/styles', to: 'styles' }
        ]
      })
    ]
  };
};
