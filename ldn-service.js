/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

function register(module) {
  module.service('brLdnService', factory);
}

/* @ngInject */
function factory() {
  var service = {};

  /**
   * Sends a LDN message.
   *
   * @param message the message to send.
   * @param options the options to use:
   *          [inbox] the inbox to send the message to.
   *          [target] the target to send the message to; LDN inbox discovery
   *            will be performed to discover the target's inbox.
   */
  service.send = function(message, options) {
    options = options || {};
    
    // TODO: implement
  };

  return service;
}

return register;

});
