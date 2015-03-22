var semver = require('semver');

function getReleasesAndBranches(versions) {
  return versions.reduce(function(t, v)  {
    t[/^v\d/.test(v) ? 'releases' : 'branches'].push(v);
    return t;
  }, {releases: [], branches: []});
}

function getLatestReleases(releases) {
  if (releases.length <= 1) {
    return releases;
  }

  releases = releases.slice().sort(function(a, b) {
    return semver.compare(a, b);
  });

  var result = [];

  do {
    var v = releases.pop();
    if (result.length === 0 ||
        !semver.satisfies(result[result.length - 1], '~' + v)) {
      result.push(v);
    }
  } while(releases.length);

  return result;
}

exports.getReleasesAndBranches = getReleasesAndBranches;
exports.getLatestReleases = getLatestReleases;
