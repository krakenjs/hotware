const express = require('express');
const path = require('path');

const { start } = require('./hot'); 
let cachedModules = {};

const getFinalPath = (modulePath) => {
  return modulePath.startsWith('.') ?
    path.join(process.cwd(), modulePath)
    : modulePath;
}

module.exports = (config) => {
  const { name: module, route, directory, method, beforeHotReload, afterHotReload } = config;

  const finalModulePath = getFinalPath(module);

  const app = express();

  let settings;
  let kraken;

  app.on('mount', parent => {
    // $FlowFixMe
    app.settings = Object.create(parent.settings);
    // $FlowFixMe
    app.kraken = parent.kraken;

    settings = Object.assign({}, parent.settings);
    kraken = parent.kraken;
  });

  app.use((req, res, next) => {
    const newAppFactory = method ? require(finalModulePath)[method] : require(finalModulePath);
    const newAppArgument = config.arguments.length > 0 ? config.arguments[0] : {}
    const newApp = newAppFactory(newAppArgument);
    newApp.settings = settings;
    newApp.kraken = kraken;
    newApp(req, res, next);
  });

  start(directory, () => {
    const cachedModule = require.cache[require.resolve(finalModulePath)];
    cachedModules[require.resolve(finalModulePath)] = cachedModule;
    clearCachedChildrenModulesOfModule(cachedModule);

    let beforeHotReloadFn, afterHotReloadFn;
    if (beforeHotReload) {
      beforeHotReloadFn = require(getFinalPath(beforeHotReload));
    }
    if (afterHotReload) {
      afterHotReloadFn = require(getFinalPath(afterHotReload));
    }

    beforeHotReloadFn && beforeHotReloadFn();

    Object.keys(cachedModules).forEach(moduleName => {

      // this will be buggy
      if (moduleName.indexOf(`/${ module }/`)) {
        delete require.cache[require.resolve(moduleName)];
      }

      // don't reload stuff in node_modules folder
      if (moduleName.indexOf('node_modules') >= 0) {
        return;
      }

      delete require.cache[require.resolve(moduleName)];
    });
    cachedModules = {};

    // reload the module
    require(finalModulePath);

    afterHotReloadFn && afterHotReloadFn();
  }); 

  return app;
};

const clearCachedChildrenModulesOfModule = (module) => {
  if (module && module.children) {
    module.children.forEach((mol) => {
      if (cachedModules[mol.id]) return;
      cachedModules[require.resolve(mol.id)] = mol;
      clearCachedChildrenModulesOfModule(mol);
    });
  }
};