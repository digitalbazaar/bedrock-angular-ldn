/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
define(['angular', 'jsonld'], function(angular, jsonld) {

'use strict';

function register(module) {
  module.service('brLdnService', factory);
}

/* @ngInject */
function factory($http, $q) {
  var CONTEXT_URL_LDP = 'https://www.w3.org/ns/ldp';
  var CONTEXT_URL_AS = 'https://www.w3.org/ns/activitystreams';
  var LDN_INBOX = 'http://www.w3.org/ns/ldp#inbox';
  var TARGET_FRAME = {
    '@context': CONTEXT_URL_LDP,
    inbox: {'@embed': false}
  };
  var INBOX_FRAME = {
    '@context': CONTEXT_URL_LDP,
    type: ['BasicContainer', 'Container', 'DirectContainer']
  };

  var service = {};

  service.CONTEXT_URL_AS = CONTEXT_URL_AS;
  service.CONTEXT_URL_LDP = CONTEXT_URL_LDP;

  service.INBOX_DEFAULT_CONTEXT = [
    CONTEXT_URL_LDP,
    {owner: {'@id': 'https://w3id.org/security#owner', '@type': '@id'}}
  ];

  /**
   * Sends a LDN message.
   *
   * @param message the message to send.
   * @param options the options to use:
   *          [inbox] the inbox to send the message to.
   *          [target] the target to send the message to; LDN inbox discovery
   *            will be performed to discover the target's inbox.
   *
   * @return a Promise that resolves to the response to sending the message.
   */
  service.send = function(message, options) {
    options = options || {};

    if(options.inbox && typeof options.inbox !== 'string') {
      throw new TypeError('"options.inbox" must be a string.');
    }
    if(options.target && typeof options.target !== 'string') {
      throw new TypeError('"options.target" must be a string.');
    }

    if(!(typeof options.inbox === 'string' ||
      typeof options.target === 'string' ||
      typeof message.target === 'string')) {
      throw new TypeError(
        'Either "options.inbox", "options.target", or "message.target" must ' +
        'be specified.');
    }

    // get inbox URL preference order: `options.inbox`, `options.target`,
    // `message.target`
    var getInbox;
    if(options.inbox) {
      getInbox = $q.when(options.inbox);
    } else {
      getInbox = service.discoverInbox(options.target || message.target);
    }

    return getInbox.then(function(inbox) {
      return $http.post(inbox, message, {
        headers: {'Content-Type': 'application/ld+json'}
      });
    });
  };

  /**
   * Creates an LDN inbox.
   *
   * Default properties will be constructed for the inbox. These can be
   * overridden by using the `options.inbox` option, but they must conform
   * to the `brLdnService.INBOX_DEFAULT_CONTEXT` JSON-LD @context.
   *
   * TODO: Should we depend on bedrock-angular-resource and create a
   * collection here or not?
   *
   * @param createUrl the URL to post to in order to create the inbox.
   * @param [options] the options to use:
   *          [inbox] the LDN inbox, sans its ID, to create; a default context
   *            of `brLdnService.INBOX_DEFAULT_CONTEXT` will be assigned if
   *            none is given.
   * @return a Promise that resolves to the LDN inbox interface upon successful
   *           retrieval of its LDN container information.
   */
  service.createInbox = function(createUrl, options) {
    options = options || {};
    var inbox = angular.extend({}, {
      '@context': service.INBOX_DEFAULT_CONTEXT,
      type: 'Container'
    }, options.inbox || {});
    return $http.post(createUrl, JSON.stringify(inbox), {
      'Content-Type': 'application/ld+json'
    });
  };

  /**
   * Gets an interface for an LDN inbox.
   *
   * @param inbox the URL for the LDN inbox.
   *
   * @return a Promise that resolves to the LDN inbox interface upon successful
   *           retrieval of its LDN container information.
   */
  service.getInbox = function(inbox) {
    return $q.when(jsonld.promises.frame(
      inbox, INBOX_FRAME, {expandContext: {'@base': inbox}, base: null}))
      .then(function(framed) {
        var container = framed['@graph'][0];
        if(!container) {
          throw new Error('LDN inbox container not found.');
        }
        // NOTE: contains can be undefined/string/array
        if(typeof container.contains === 'undefined') {
          container.contains = [];
        }
        if(typeof container.contains === 'string') {
          container.contains = [container.contains];
        }
        return new Inbox(container);
      });
  };

  service.getInboxes = function(url, query) {
    return $http({
      method: 'GET',
      url: url,
      params: query
    }).then(function(response) {
      return response.data;
    });
  };

  /**
   * Discovers a resource's LDN inbox.
   *
   * @param target the target resource to discover the LDN inbox of.
   *
   * @return a Promise that resolves to the response to sending the message.
   */
  service.discoverInbox = function(target) {
    return getInboxFromLinkHeader(target).then(function(inbox) {
      if(inbox) {
        // done, found inbox in `Link` header
        return inbox;
      }
      // GET target to find inbox relation
      return $q.when(jsonld.promises.frame(
        target, TARGET_FRAME, {expandContext: {'@base': target}, base: null}))
        .then(function(framed) {
          var result = framed['@graph'][0];
          if(!result) {
            throw new Error(
              'LDN "inbox" property not found in "Link" header ' +
              'or in target\'s resource description.');
          }
          return result.inbox;
        });
    });
  };

  // helper that gets inbox relation from a target's link header
  function getInboxFromLinkHeader(target) {
    // HEAD target to get `Link` w/LDN inbox
    return $http.head(target, {queue: true}).then(function(response) {
      var header = response.headers('link');
      if(!header) {
        return;
      }
      var parsed = jsonld.parseLinkHeader(header)[LDN_INBOX];
      if(!parsed) {
        return;
      }
      return angular.isArray(parsed) ? parsed[0].target : parsed.target;
    });
  }

  /**
   * Construct an interface for an LDN inbox.
   *
   * @param container the LDN inbox container.
   *
   * @return the inbox interface.
   */
  var Inbox = function(container) {
    if(!(this instanceof Inbox)) {
      return new Inbox(container);
    }
    this.container = container;
    this.messages = [];
    this.defaults = {
      getMessages: {count: 10}
    };
  };

  /**
   * Gets the messages specified in the container.
   *
   * @param [options] the options to use.
   *          [index] the starting index for retrieving messages.
   *          [count] the number of messages to retrieve.
   *
   * @return a Promise that resolves to this inbox once the messages have
   *           been retrieved.
   */
  Inbox.prototype.getMessages = function(options) {
    var self = this;

    options = angular.extend({
      index: self.messages.length,
      count: Math.min(
        self.defaults.getMessages.count, self.container.contains.length)
    }, options || {});

    var start = options.index;
    var slice = self.container.contains.slice(start, start + options.count);

    return $q.all(slice.map(function(url, idx) {
      var frame = {
        '@context': CONTEXT_URL_AS,
        id: url
      };
      return jsonld.promises.frame(
        url, frame, {expandContext: {'@base': url}, base: null})
        .then(function(framed) {
          return {index: idx, message: framed['@graph'][0] || {}};
        });
    })).then(function(results) {
      results.map(function(result) {
        self.messages[start + result.index] = result.message;
      });
      return self;
    });
  };

  // TODO: implement `send` on `Inbox.prototype`?

  return service;
}

return register;

});
