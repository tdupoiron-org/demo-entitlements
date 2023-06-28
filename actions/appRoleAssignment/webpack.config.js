const path = require('path');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = {

  target: 'node',

  mode: "production",
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'action.js',
  },

  optimization: {
    minimize: true
  },
  
};