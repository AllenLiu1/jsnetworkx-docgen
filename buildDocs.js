"use strict";
var Promise = require('promise');

var pkg = require('./package.json');
var config = pkg.jsnx;
var extractDocs = require('./extractDocs');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var semver = require('semver');
var spawn = require('child_process').spawn;

var fullRepo = path.resolve(config.repo);
var spawnArgs = {cwd: config.repo};

var categories = {
  'Algorithms': function(docs) {
    return docs.aliases.some(function(a) {
      return /^algorithms\.(\w+)/.test(a);
    });
  },
  'Generators': function(docs) {
    return docs.aliases.some(function(a) {
      return /^generators\.(\w+)/.test(a);
    });
  },
  'Classes': function(docs) {
    return docs.isClass;
  },
  'Misc': function() { return true; }
};

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

function buildPage() {
  console.log('buildPage');
  return promisify(spawn('npm', ['run', 'build'], {cwd: __dirname}));
}

function updateVersion(version) {
  /*
  if (config.versions.indexOf(version) === -1) {
    if (semver.valid(version)) {
      config.versions = config.versions.filter(function(oldVersion) {
        if ((oldVersion = semver.valid(oldVersion))) {
          return !semver.satisfies(version, '~'+oldVersion);
        }
        return true;
      });
    }
    config.versions.push(version);
  }
  */
  console.log('Update version');
  fs.writeFileSync(config.versionsFile, JSON.stringify(config.versions, null, 2));
}

function clearCache() {
  Object.keys(require.cache).forEach(function(key) {
    if (key.substring(0, fullRepo.length) === fullRepo) {
      delete require.cache[key];
    }
  });
}

function categorize(docs) {
  var keys = Object.keys(categories);
  var c = keys.reduce(function(c, n) { return c[n] = {}, c; }, {});
  for (var name in docs) {
    keys.some(function(key) {
      if (categories[key](docs[name])) {
        c[key][name] = docs[name];
        return true;
      }
    });
  }
  return c;
}

function buildDocs(versions) {
  if (!Array.isArray(versions)) {
    versions = [versions];
  } else {
    versions = versions.slice(0);
  }

  function build() {
    if (versions.length === 0) {
      return Promise.resolve(true);
    }
    var version = versions.pop();
    return checkout(version)
      //.then(npmUpdate)
      //.then(buildPage)
      .then(function() {
        clearCache();
        var jsnx = require(config.repo);
        return new Promise(function(resolve, reject) {
          extractDocs(config.files, jsnx).then(function(docs) {
            docs = categorize(docs);
            console.log('built docs', version);
            fs.writeFile(
              path.join(config.versionsDir, version + '.json'),
              JSON.stringify(docs),
              function(err) {
                if (err) {
                  console.log(err);
                }
                else {
                  updateVersion(version);
                }
                return build().then(resolve, reject);
              }
            );
          });
        });
      });
  }

  return updateRepo().then(build);
}

module.exports = buildDocs;

if (require.main === module) {
  buildDocs(config.versions).catch(function(error) {
    console.error(error);
  });
}
