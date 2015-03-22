"use strict";
var buildDocs = require('./buildDocs');
var bodyParser = require('body-parser');
var fs = require('fs');
var express = require('express');
var paths = require('./paths.json');

var app = express();

var BRANCH_PATTERN = /^refs\/heads\/(.*)$/;
var TAG_PATTERN = /^refs\/tags\/(.*)$/;

app.use(express.static('docs'));
app.use(bodyParser.json());

var pushesToDo = [];
var building = false;

function processBuildRequests() {
  if (pushesToDo.length > 0) {
    building = true;
    var data = pushesToDo.shift();
    console.log('Building', data.version);
    buildDocs(data.commit, data.version).done(
      function() {
        processBuildRequests();
      },
      function(err) {
        console.log('Error:', err.message);
        processBuildRequests();
      }
    );
  }
  else {
    building = false;
    console.log('done');
  }
}

app.get('/v*', function (req, res) {
  res.sendFile('./index.html', {root: './docs/'});
});

app.post('/_gh_push', function (req, res) {
  var payload = req.body || {ref: ''};
  var match;
  var version;
  if ((match = payload.ref.match(BRANCH_PATTERN))) {
    version = match[1];
  }
  else if ((match = payload.ref.match(TAG_PATTERN))) {
    version = match[1];
  }
  if (version) {
    var commit = payload.head_commit.id;
    pushesToDo.push({version: version, commit: commit});
    if (!building) {
      processBuildRequests();
    }
  }

  res.send('Yey!');
});

var server = app.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

});

fs.mkdir(paths.versionsDir, function(){});
