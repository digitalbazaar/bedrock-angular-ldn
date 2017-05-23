/*!
 * Bedrock Linked Data Notification Sender + Consumer
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
import angular from 'angular';
import LdnService from './ldn-service.js';

var module = angular.module('bedrock.ldn', []);

module.service('brLdnService', LdnService);
