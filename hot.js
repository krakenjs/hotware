const path = require('path');
const chokidar = require('chokidar');
const debounce = require('lodash.debounce');

const start = (dir, fn) => {
  const watcher = chokidar.watch(dir);
  const hotReloadFn = () => {
    console.log(`Hot-Reload ${ dir }`);
    fn();
  }
  watcher.on('ready', () => {
    watcher.on('all', debounce(hotReloadFn, 1000));
  });
}

module.exports = {
  start
};
