# JSNetworkX API website

This repo does *not* contain the JSNetworkX API documentation. It contains the
tools to *create* the documentation.

To extract the documentation from the source code, run

```
$ npm run gen-api path/to/jsnetwork-repo
```

or checkout JSNetorkX and run the command without path, to generate docs for
all commits listed in `package.json`, `jsnx.versions`:

```
$ git clone https://github.com/fkling/JSNetworkX.git jsnetworkx
$ npm run gen-api
```

This will create a JSON file containing information about all methods and
classes, store in `website/versions/`.

To test the website, a local server can be started with

```
$ npm start
```

## How to contribute

For problems with the documentation itself, please file an issue (or pull
request) at https://github.com/fkling/JSNetworkX.

For anything else, such as style, usability, etc, file an issue here.
