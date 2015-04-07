"use strict";

var React = require('react/addons');
var Router = require('react-router');
var ActiveState = Router.ActiveState;
var Link = Router.Link;

var versions = require('../versions');

var VersionEntry = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  render: function() {
    var isActive = this.context.router.isActive(
      this.props.to,
      this.props.params,
      this.props.query
    );
    var className = isActive ? 'active' : '';
    var version = this.props.params.version;
    return (
      <li role="presentation" className={className}>
        <Link {...this.props}>{version}</Link>
      </li>
    );
  }
});

var Header = React.createClass({
  render: function() {
    var {releases, branches} =
      versions.getReleasesAndBranches(this.props.versions);

    var releases_menu;
    var branches_menu;

    if (releases.length > 0) {
      releases_menu =
        <div>
          <p className="navbar-text"><strong>Releases: </strong></p>
          <ul className="nav navbar-nav">
            {releases.map(
              x => <VersionEntry to="version" params={{version: x}} />
            )}
          </ul>
        </div>;
    }
    if (branches.length > 0) {
      branches_menu =
        <div>
          <p className="navbar-text"><strong>Branches: </strong></p>
          <ul className="nav navbar-nav">
            {branches.map(
              x => <VersionEntry
                key={x}
                to="version"
                params={{version: x}}
              />
            )}
          </ul>
        </div>;
    }

    return (
      <nav className="navbar navbar-default navbar-fixed-top" role="navigation">
        <div className="container-fluid">
          <div className="navbar-header">
            <a className="navbar-brand" href="/">JSNetworkX API</a>
          </div>
          {releases_menu}
          {branches_menu}
        </div>
      </nav>
    );
  }
});

module.exports = Header;
