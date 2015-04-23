/*jshint browser:true, maxlen:false, esnext:true*/
"use strict";

var Symbol = require('./Info.jsx');
var Header = require('./Header.jsx');
var SymbolIndex = require('./SymbolIndex.jsx');
var React = require('react/addons');
var Router = require('react-router');
var Redirect = Router.Redirect;
var Route = Router.Route;
var NotFoundRoute = Router.NotFoundRoute;
var DefaultRoute = Router.DefaultRoute;
var Link = Router.Link;
var RouteHandler = Router.RouteHandler;

require('whatwg-fetch');
var doccache = require('./doccache');
var semver = require('semver');
var _ = require('lodash');

var versionsCache = {};

function getVersion(version) {
  if (version in versionsCache) {
    return Promise.resolve(versionsCache[version]);
  }
  else {
    return global.fetch('versions/' + version + '.json')
      .then(response => response.json())
      .then(json => versionsCache[version] = json);
  }
}

var App = React.createClass({
  render: function() {
    return (
      <div >
        <Header versions={this.props.versions}/>
        <div className="container">
          <RouteHandler {...this.props} />
        </div>
      </div>
    );
  }
});

var Version = React.createClass({
  getInitialState: function() {
    return {
      docs: null,
      error: false,
    };
  },

  _fetchVersion: function(version) {
    getVersion(version).then(
      docs => {
        doccache.set(version, docs);
        this.setState({docs: docs, error:false});
      },
      _ => this.setState({error: true})
    );
  },

  componentDidMount: function() {
    this._fetchVersion(this.props.params.version);
  },

  shouldComponentUpdate: function(nextProps, nextState) {
    var version = nextProps.params.version;
    if (version !== this.props.params.version) {
      this._fetchVersion(version);
      return false;
    }
    return true;
  },

  render: function() {
    if (this.state.docs && !this.state.error) {
      return <RouteHandler {...this.props} />;
    }
    else if (this.state.error) {
      return (
        <div className="alert alert-danger" role="alert">
          <strong>:(</strong> "{this.props.params.version}"
          doesn't seem to exist.
        </div>
      );
    }
    return null;
  }
});


global.fetch('versions.json')
  .then(response => response.json())
  .then(versions => {
    versions.sort(function(a, b) {
      if (a === 'master') {
        return -1;
      }
      else if (b === 'master') {
        return 1;
      }
      if (!semver.valid(a)) {
        return semver.valid(b) ? -1 : a.localeCompare(b);
      }
      else {
        return semver.valid(b) ? semver.rcompare(a, b) : 1;
      }
    });

    var version = versions.reduce(
      ((p, c) => semver.valid(c) && c.indexOf('-') === -1 ?  (semver.gt(c, p) ? c : p) : p),
      '0.0.0'
    );

    if (version === '0.0.0') {
      version = versions[0];
    }

    var routes = (
      <Route name="app" path="/" handler={App}>
        <Redirect from="/" to="version" params={{version}} />
        <Redirect from="/v" to="version" params={{version}} />
        <Route name="version" path="v/:version" handler={Version}>
          <Route name="symbol" path=":symbol" handler={Symbol}>
            <Route name="subsymbol" path=":subsymbol" handler={Symbol} />
          </Route>
          <DefaultRoute handler={SymbolIndex} />
        </Route>
      </Route>
    );

    Router.run(routes, function(Handler, state) {
      React.render(
        <Handler versions={versions} params={state.params} />,
        document.body
      );
    });
});
