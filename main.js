/*!
 * Bedrock Linked Data Notification Sender + Consumer
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
define([
  'angular',
  './ldn-service'
], function(angular) {

'use strict';

var module = angular.module('bedrock.ldn', []);

Array.prototype.slice.call(arguments, 1).forEach(function(register) {
  register(module);
});

});
