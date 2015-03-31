/*jshint browser:true, maxlen:false, esnext:true*/
"use strict";

var Info = require('./Info.jsx');
var Header = require('./Header.jsx');
var React = require('react');
var Router = require('react-router');
var Redirect = Router.Redirect;
var Route = Router.Route;
var Redirect = Router.Redirect;
var Routes = Router.Routes;
var DefaultRoute = Router.DefaultRoute;
var Link = Router.Link;

require('whatwg-fetch');
var semver = require('semver');
var _ = require('lodash');

var versionsCache = {};

function getVersion(version) {
  if (version in versionsCache) {
    return Promise.resolve(versionsCache[version]);
  }
  else {
    return global.fetch('/versions/' + version + '.json')
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
          <this.props.activeRouteHandler/>
        </div>
      </div>
    );
  }
});

var VersionIndex = React.createClass({

  _renderSection(name) {
    var methods = Object.keys(this.props.docs[name]).sort().map(
      m =>
        <li>
          <Link
            to="symbol"
            params={_.assign({symbol: m, category: name}, this.props.params)}>
            {m}
          </Link>
        </li>
    );

    return (
      <div>
        <h4>{name}</h4>
        <ul>{methods}</ul>
      </div>
    );
  },

  render: function() {
    console.log(this.props.docs);
    var categories = ['Classes', 'Algorithms', 'Generators', 'Misc'];
    if (this.props.docs) {
      return (
        <div className="row">
          {categories.map(
            c => <div className="col-md-3">{this._renderSection(c)}</div>
          )}
        </div>
      );
    }
    console.log('test');
    return null;
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
      docs => this.setState({docs, error:false}),
      _ => this.setState({error: true})
    );
  },

  componentDidMount: function() {
    this._fetchVersion(this.props.params.version);
  },

  componentWillReceiveProps: function(nextProps) {
    var version = nextProps.params.version;
    if (version !== this.props.version) {
      this._fetchVersion(version);
    }
  },

  render: function() {
    if (this.state.docs && !this.state.error) {
      return <this.props.activeRouteHandler docs={this.state.docs} />;
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


global.fetch('/versions.json')
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

    React.render(
      <Routes>
        <Redirect from="/" to={"/v/"+version} />
        <Redirect from="/v" to={"/v/"+version} />
        <Route name="app" path="/" handler={App} versions={versions}>
          <Route name="version" path="v/:version" handler={Version}>
            <Route name="symbol" path=":category/:symbol" handler={Info} />
            <DefaultRoute handler={VersionIndex} />
          </Route>
        </Route>
      </Routes>,
      document.body
    );
});
