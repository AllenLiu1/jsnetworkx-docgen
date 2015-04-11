"use strict";
var Promise = require('promise');

var extractDocs = require('./extractDocs');
var fs = require('fs');
var globby = require('globby');
var path = require('path');
var pkg = require('./package.json');
var rimraf = require('rimraf');
var semver = require('semver');
var spawn = require('child_process').spawn;

var config = pkg.jsnx;
var spawnArgs = {cwd: config.repo};

function promisify(spawn) {
  return new Promise(function(resolve, reject) {
    var out;
    var err;
    spawn.stdout.on('data', function(data) {
      out += data;
    });
    spawn.stderr.on('data', function(data) {
      err += data;
    });
    spawn.on('close', function(status) {
      return status === 0 ?
        resolve(out && out.toString()) :
        reject(new Error(err && err.toString()));
    });
  });
}

function updateRepo() {
  console.log('git fetch');
  return promisify(spawn('git', ['fetch'], spawnArgs));
}

function checkout(version) {
  if (!semver.valid(version)) {
    version = 'origin/' + version;
  }
  return promisify(spawn('git', ['checkout', version], spawnArgs));
}

function npmUpdate() {
  console.log('npm install');
  rimraf.sync(path.join(config.repo, 'node_modules'));
  return promisify(spawn('npm', ['install'], spawnArgs));
}

function updateVersion(versions) {
  if (!Array.isArray(versions)) {
    if (config.versions.indexOf(versions) === -1) {
      config.versions.push(versions);
    }
    versions = config.versions;
  }
  console.log('Update version', versions);
  fs.writeFileSync(config.versionsFile, JSON.stringify(versions, null, 2));
}

function clearCache(filePath) {
  filePath = path.resolve(filePath);
  Object.keys(require.cache).forEach(function(key) {
    if (key.substring(0, filePath.length) === filePath) {
      delete require.cache[key];
    }
  });
}

function categorize(docs) {
  Object.keys(docs).forEach(function(name) {
    var doc = docs[name];
    var alias = doc.aliases.reduce(function(prev, name) {
      return prev.length < name.length ? name : prev;
    });
    doc.categories = alias.split('.').slice(0, -1);
  });
  return docs;
}

function requireJSNetworkXFromPath(path) {
  try {
    return require(path);
  } catch(err) {
    throw new Error(
      'Cannot load JSNetworkX. Make sure `npm install` was run in "' + path + '".\n' +
      'Origin message:\n' + err.message
    );
  }
}

function getFilePaths(root) {
  return new Promise(function(resolve, reject) {
    var pattern = path.join(root, 'src/**/*.js');
    globby(pattern, function(err, paths) {
      if (err) {
        reject(err);
      }
      resolve(paths.filter(function(path) { return path.indexOf('__tests__') === -1; }));
    });
  });
}

function writeDocs(docs, version) {
  return new Promise(function(resolve, reject) {
    docs = categorize(docs);
    console.log('wrote docs', version);
    fs.writeFile(
      path.join(config.versionsDir, version + '.json'),
      JSON.stringify(docs),
      function(err) {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
}

function buildDocsFromRepo(repo, versions) {
  if (!Array.isArray(versions)) {
    versions = [versions];
  }

  var processVersions = versions.slice();

  function build() {
    if (processVersions.length === 0) {
      return Promise.resolve(true);
    }
    var version = processVersions.pop();
    return checkout(version)
      .then(npmUpdate)
      .then(function() {
        clearCache(config.repo);
        var jsnx = requireJSNetworkXFromPath(config.repo);
        return getFilePaths(config.repo)
          .then(function(paths) { return extractDocs(paths, jsnx); })
          .then(function(docs) { return writeDocs(docs, version); })
          .then(function() { return build(); });
      });

  }

  return updateRepo().then(build).then(function() { updateVersion(versions); });
}

function buildDocsFromPath(path) {
  // Doesn't to any git magic. It simply takes the content of the directory
  // and creates a custom version
  var version = 'custom';
  var jsnx = requireJSNetworkXFromPath(path);
  return getFilePaths(path)
    .then(function(paths) { return extractDocs(paths, jsnx); })
    .then(function(docs) { return writeDocs(docs, version); })
    .then(function() { updateVersion(version); });
}

if (require.main === module) {
  var jsnxPath = process.argv[2];
  var builder;
  if (jsnxPath) {
    builder = buildDocsFromPath(jsnxPath);
  } else {
    builder = buildDocsFromRepo(config.repo, config.versions);
  }
  builder.catch(function(error) {
    console.error(error);
  });
}
