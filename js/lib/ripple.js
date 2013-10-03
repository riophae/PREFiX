/**
 * @fileOverview Ripple / 饭否 JavaScript 工具包
 * @author       锐风(Lacc Riophae) http://fanfou.com/ruif
 *
 * @description
 *   Ripple 是一个面向 Web 应用 / 浏览器扩展 的饭否开发工具包, 提供了 AJAX 类、
 *   OAuth 验证、所有 API 方法及客户端常用的工具等. 利用 Ripple, 你可以轻松的创
 *   建各种类型的饭否迷你应用，甚至是极其复杂的支持多个账号的饭否客户端. 支持
 *   XAuth、PIN Code 和 OAuth Callback 验证方法.
 *
 * @note
 *   需要注意的是, 这个工具包仅适用于支持 ECMAScript 262 v5.1 以及 XMLHttpRequest Level 2
 * 	 的现代浏览器. Ripple 只能在可以跨域的环境下运行, 请在使用前明确应用的运行环境.
 *   反对使用 Ripple 为不支持 HTML5 / CSS3 的浏览器开发应用.
 *
 * @thirdParties
 *   包含以下类库/框架(均有改动):
 *     OAuth.js / Copyright 2008 Netflix, Inc / Licensed under the Apache License, Version 2.0
 *     JSDeferred / Copyright (c) 2007 cho45 ( www.lowreal.net ) / Licensed under the MIT license
 *
 *   部分源码复制/修改/借鉴自:
 *     SpazCore / Copyright (c) 2007-2010, Edward Finkler, Funkatron Productions
 *       @license
 *       All rights reserved.
 *
 *       Redistribution and use in source and binary forms, with or without
 *       modification, are permitted provided that the following conditions are met:
 *
 *               Redistributions of source code must retain the above copyright
 *               notice, this list of conditions and the following disclaimer.
 *
 *               Redistributions in binary form must reproduce the above
 *               copyright notice, this list of conditions and the following
 *               disclaimer in the documentation and/or other materials provided
 *               with the distribution.
 *
 *               Neither the name of Edward Finkler, Funkatron Productions nor
 *               the names of its contributors may be used to endorse or promote
 *               products derived from this software without specific prior written
 *               permission.
 *
 *
 *       THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *       AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 *       IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 *       DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
 *       FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 *       DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 *       SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 *       CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 *       OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 *       OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 *     Underscroe.js / Copyright (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc. / Licensed under the MIT license
 *     RightJS / Copyright (c) 2008-2012 Nikolay Nemshilov / Licensed under the MIT license
 *     Mass Framework / Copyright (c) 司徒正美
 *     jQuery / Copyright 2011, John Resig / Dual licensed under the MIT or GPL Version 2 licenses
 *
 * @license      the MIT license
 * @version      0.1.0 alpha
 * @lastModified 2012/4/20 09:00
 */

(function(Global, undefined) {

	/* ES5.1 严格模式 */
	'use strict';

	/* 判断是否支持 ES5.1 严格模式 */
	(function() {
		if (this) {
			throw 'Ripple 加载失败: 当前浏览器不支持 ES5.1 严格模式.';
		}
	})();


	/*
		 ** Consumer **
	*/

	var consumer = {
		consumer_key: '',
		consumer_secret: ''
	};


	/*
		 ** Ripple 全局常量/方法 **
	*/

	var constants = {};

	constants.baseOAuthUrl = 'http://fanfou.com/oauth/';

	constants.requestTokenStorage = '__Ripple_Request_Token__';

	/* 错误输出模式代号 */
	constants.dumpLevels = {
		none: 0,
		error: 1,
		warning: 2,
		notice: 3,
		debug: 4
	};

	/* 错误输出模式名称 */
	constants.dumpLevelNames = (function() {
		var numbers = {};
		Object.keys(constants.dumpLevels).forEach(function(name) {
			numbers[constants.dumpLevels[name]] = name;
		});
		return numbers;
	})();

	/* 允许输出的错误最大长度 */
	constants.dumpMaxLen = 512;

	/* OAuth 签名方法 */
	constants.signMethod = 'HMAC-SHA1';

	/* 全局事件名称 */
	constants.globalEventType = '_global_event_';

	/* 全局系统事件名称 */
	constants.globalSystemEventType = '_global_system_event_';

	/* 临时事件名称 */
	constants.OneTimeEventType = '_one_time_event_';

	constants.systemEventTypes = 'create_account process_status'.split(' ');

	/* 服务器端响应类型值 */
	constants.responseTypes = {
		xml: 'application/xml, text/xml',
		html: 'text/html',
		text: 'text/plain',
		json: 'application/json, text/javascript'
	};

	constants.responseTypes['*'] =
	Object.keys(constants.responseTypes).
	map(function(type) {
		return constants.responseTypes[type];
	}).join(', ');

	/* 默认 AJAX 属性 */
	constants.ajaxOptions = {
		method: 'GET',
		async: true,
		accepts: '*',
		global: true, // 是否触发 ajax_start / ajax_stop 事件
		success: noop,
		onstart: noop,
		send: noop,
		oncomplete: noop,
		onprogress: noop,
		onloadstart: noop,
		onloadend: noop,
		encoding: 'utf-8',
		urlEncoded: true,
		processData: true,
		evalResponse: false,
		evalJS: true,
		evalJSON: true,
		unique: true // 是否认为该 AJAX 请求为独特请求, 设为否则忽略重复的请求
	};

	/* AJAX 事件名称 */
	constants.normalAjaxEventTypes = {
		onload: 'success',
		onerror: 'error',
		onabort: 'onabort',
		ontimeout: 'ontimeout'
	};

	constants.uploadingAjaxEventTypes = ['onprogress', 'onload', 'onloadstart', 'onloadend'];

	constants.customAjaxEventTypes = ['onstart', 'send'];

	constants.globalAjaxEventTypes = ['ajax_start', 'ajax_stop'];

	/* JavaScript 原生对象类型 */
	constants.primaevalTypes = 'Boolean Number String Function Array Date RegExp Object'.split(' ');

	/* 常用方法 */
	var slice = Array.prototype.slice,
			splice = Array.prototype.splice,
			toString = Object.prototype.toString,
			hasOwn = Object.prototype.hasOwnProperty;

	/* 记录全局 ID 的属性名 */
	var UID_KEY = '_UNIQUE_ID_';

	function noop() { }
	function returnTrue() { return true; }
	returnTrue.toString = function() { return 'true'; }
	function returnFalse() { return false; }
	returnFalse.toString = function() { return 'false'; }

	/* 超轻量级类工厂 */
	function MiniClass(obj) {
		obj = obj || {};
		var klass = function() {
			var args = arguments;
			['_super',	'_init'].forEach(function(prop) {
				if (hasOwn.call(obj, prop) && helpers.isFunction(obj[prop])) {
					obj[prop].apply(this, args);
				}
				if (hasOwn.call(obj, '_' + prop)) {
					obj[prop] = obj['_' + prop];
					delete obj['_' + prop];
				}
			}, this);
		};
		if (obj._super) obj.__proto__ = obj._super.prototype;
		klass.prototype = obj;
		return klass;
	}



	/*
		 ** Ripple 默认设置 **
	*/

	var config = {
		dumpLevel: 0, // debug 模式
		baseAPIUrl: 'http://api.fanfou.com/',
		OAuthVersion: '1.0',
		ajaxOptions: {
			timeout: 30 * 1000, // 默认 AJAX 连接时限
			error: noop,
			onabort: noop,
			ontimeout: noop,
			noCache: false
		}
	};


	/*
		 ** Ripple 辅助方法 **
	*/

	var helpers = {};

	/* 转换 arguments 对象为真正的数组 */
	var $A = helpers.makeArray = function(obj, start) {
		return slice.call(obj, start || 0);
	}

	/* 获取由对象的键或值组成的数组 */
	;;;['keys', 'values'].forEach(function(item, i) {
		helpers[item] = function(obj, option) {
			var arr = [], key;
			if (obj && typeof obj == 'object') {
				for (key in obj) {
					if (option && ! obj.hasOwnProperty(key)) continue;
					arr[arr.length] = i ? obj[key] : key;
				}
			}
			return arr;
		}
	});

	/* 将参数串行化 */
	helpers.param = function(params) {
		if (! params) return '';
		switch (helpers.type(params)) {
			case 'string':
				return params;
			default:
				return Ripple.OAuth.formEncode(params);
		}
	}

	/* 生成由 [key, value] 构成的数组 */
	helpers.paramList = function(params) {
		helpers.paramList = function(params) {
			return Ripple.OAuth.getParameterList(params).filter(function(item) {
				return item && item[1] !== undefined && item[1] !== null;
			});
		}
		return helpers.paramList(params);
	}

	/* 生成 key/value 对象 */
	helpers.paramMap = function(params) {
		helpers.paramMap = function(params) {
			return helpers.without(Ripple.OAuth.getParameterMap(params), undefined, null);
		}
		return helpers.paramMap(params);
	}

	/* 将对象转换为 FormData */
	helpers.buildFormData = function(params) {
		var fd = new FormData, key;
		for (key in params) {
			if (params.hasOwnProperty(key)) {
				fd.append(key, params[key]);
			}
		}
		return fd;
	}

	/* 判断对象/数组/字符串是否包含指定值 */
	helpers.contains = function(thing, item) {
		switch (helpers.type(thing)) {
			case 'object':
				thing = helpers.values(thing);
			case 'string': case 'array':
				return thing.indexOf(item) > -1;
		}
		return false;
	}

	/* 获取不包含指定值的对象 */
	helpers.without = function() {
		var filter = $A(arguments), object = filter.shift(), copy = {}, key;
		for (key in object) {
			if (filter.indexOf(key) === -1) {
				copy[key] = object[key];
			}
		}
		return copy;
	}

	/* 获取不包含指定值的数组 */
	helpers.compact = function() {
		var filter = $A(arguments), array = filter.shift();
		return array.filter(function(value) {
			return filter.indexOf(value) === -1;
		});
	}

	/* 清空对象 */
	helpers.clean = function(object) {
		return helpers.delete(object, Object.keys(object));
	}

	/* 根据键名数组批量移除对象属性 */
	helpers.delete = function(object, keys) {
		for (var i = 0, len = keys.length; i < len; i++) {
			delete object[keys[i]];
		}
		return object;
	}

	/* 对象扩展 */
	helpers.extend = function() {
		var options, name, src, copy, copyIsArray, clone,
			target = arguments[0] || {},
			i = 1,
			length = arguments.length,
			deep = false;

		if (typeof target == 'boolean') {
			deep = target;
			target = arguments[1] || {};
			i = 2;
		}

		if (typeof target != 'object' && ! helpers.isFunction(target)) {
			target = {};
		}

		for (; i < length; i++) {
			if ((options = arguments[i]) == null) continue;
			for (name in options) {
				src = target[name];
				copy = options[name];

				if (target === copy) continue;

				if (deep && copy && (helpers.isPlainObject(copy) || (copyIsArray = helpers.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && helpers.isArray(src) ? src : [];
					} else {
						clone = src && helpers.isPlainObject(src) ? src : {};
					}
					target[name] = helpers.extend(deep, clone, copy);
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}

		return target;
	}

	/* 快速浅扩展 */
	helpers.fastExtend = function(target, source) {
		var key;
		for (key in source) {
			target[key] = source[key];
		}
		if (arguments.length > 2) {
			var args = $A(arguments, 2);
			args.unshift(target);
			return helpers.fastExtend.apply(helpers, args);
		}
		return target;
	}

	/* 对象克隆 */
	helpers.clone = function() {
		var args = $A(arguments);
		if (! helpers.isBoolean(args[0])) {
			// 默认使用浅拷贝
			args.unshift(false);
		}
		args.splice(1, 0, {});
		return helpers.extend.apply(helpers, args);
	}

	/* 利用原型链实现快速克隆 */
	helpers.fastClone = function() {
		return new (helpers.inherit.apply(undefined, arguments));
	}

	/* 设置缺省值 */
	helpers.defaults = function() {
		var args = $A(arguments);
		args.push(helpers.fastExtend({}, args[0])); // 扩展到最后时恢复原始值
		// 先把所有源复制到目的对象上, 最后进行恢复操作
		return helpers.fastExtend.apply(helpers, args);
	}

	/* 判断字符串是否由指定字符串开始或结束 */
	;;;['startsWith', 'endsWith'].forEach(function(item, i) {
		helpers[item] = function(str, patt) {
			if (helpers.isString(str)) {
				patt = patt + '';
				return i ?
					str.lastIndexOf(patt) === str.length - patt.length :
					str.indexOf(patt) === 0;
			}
			return false;
		}
	});

	/* 检索并返回目标前后的内容 */
	['Before', 'After'].forEach(function(item, i) {
		helpers['search' + item] = function(str, patt) {
			// 强制类型转换
			str = str + '';
			patt = patt + '';
			var index = str.indexOf(patt);
			return index > -1 ? // 如果没有检索到, 则返回原字符串
				(i ? str.slice(index + patt.length) : str.slice(0, index)) : str;
		}
	});

	/* 转换为连字符风格 */
	helpers.underscored = function(string) {
		return string.
			replace(/([a-z\d])([A-Z]+)/g, '$1_$2').
			replace(/\-/g, '_').
			toLowerCase();
	}

	/* 类型判断 */
	helpers.class2type = (function() {
		var class2type = {};
		constants.primaevalTypes.forEach(function(type) {
			class2type['[object ' + type + ']'] = type.toLowerCase();
			// 注册便捷方法
			helpers['is' + type] = function(thing) {
				return helpers.type(thing) === type.toLowerCase();
			}
		});
		return class2type;
	})();

	/* 快速获取类型 */
	helpers.type = function(thing) {
		return thing == null ?
			String(thing) : helpers.class2type[toString.call(thing)] || 'object';
	}

	/* 判断对象否为纯粹的对象字面量 */
	helpers.isPlainObject = function(object) {
		if (! object || helpers.type(object) != 'object') return false;
		return object.__proto__ == Object.prototype;
	}

	/* 判断是否为空对象 */
	helpers.isEmptyObject = function(object) {
		if (! helpers.isObject(object)) return false;
		for (var name in object) {
			return false;
		}
		return true;
	}

	/* 判断是否为元素对象 */
	helpers.isElement = function(thing) {
		return thing != null && thing.nodeType === 1;
	}

	/* 判断是否为节点对象 */
	helpers.isNode = function(thing) {
		return thing != null && thing.nodeType != null;
	}

	/* 错误输出 */
	helpers.dump = function(object, level, callback) {
		if (level && level > config.dumpLevel) return;
		if (helpers.isString(object) && object.length > constants.dumpMaxLen) {
			object = object.slice(0, constants.dumpMaxLen) + '…[TRUNC]';
		} else if (helpers.isObject(object)) {
			object = 'KEYS: ' + helpers.keys(object);
		}
		var level_name = constants.dumpLevelNames[level];
		level_name = level_name ? ' (' + level_name + ') ' : '';
		helpers.log('Ripple' + level_name + ':\n' + object);
		callback && callback(object, level);
	}

	/* 日志输出函数 */
	helpers.log = console.log.bind(console);

	['error error', 'warn warning', 'note notice', 'debug debug'].
	map(function(item) {
		return item.split(' ');
	}).
	forEach(function(item) {
		helpers[item[0]] = function(object) {
			return helpers.dump(object, constants.dumpLevels[item[1]]);
		}
	});

	/* 全局作用域下运行脚本 */
	helpers.eval = function(text) {
		if (! text) return;
		if ('execScript' in window) {
			window.execScript(text);
		} else {
			var script = document.createElement('script');
			script.appendChild(document.createTextNode(text));
			document.documentElement.appendChild(script);
		}
	}

	/* 设置并返回对象的全局 ID */
	helpers.$UID = function(item) {
		return UID_KEY in item ? item[UID_KEY] : (item[UID_KEY] = helpers.UUID(8));
	}

	/* 实现继承和多构造器 */
	helpers.inherit = function() {
		var args = helpers.makeArray(arguments);
		var result = {}, child;
		while (args.length) {
			child = args.shift();
			if (hasOwn.call(child, '_super')) {
				child.__super = child._super;
			}
			child._super = new MiniClass(result);
			result = child;
		}
		return new MiniClass(result);
	}


	/*
		 ** 事件 **
	*/

	var events = {

		/* 存储注册的事件、监听器、事件对象模板 */
		registeredEvents: {},

		/* 存储事件模板的只读属性名称 */
		registeredReadOnlyEventProperties: [],

		/* 存储注册的事件名称, 用于快速判断 */
		_registeredEventList: {},

		/* 判断事件是否已注册 */
		isEventRegistered: function(event_type) {
			return event_type != null && events._registeredEventList[(event_type + '').toLowerCase()];
		},

		/* 通用事件模板 */
		commonEventTemplate: {
			_init: noop, // 事件被初始化时被调用的函数(一般为构造函数)
			_passableProperties: {
				// 可写属性
				isStopped: returnFalse,
				isDefaultPrevented: returnFalse
			},
			isAjaxEvent: returnFalse, // 是否为 AJAX 事件
			isStopable: returnTrue, // 是否可以阻止事件
			isSystemEvent: returnFalse, // 是否为系统事件
			isOneTimeEvent: returnFalse, // 是否在触发后自动取消注册事件 (一次性)
			autoTrigger: true, // 是否自动触发 "before." 和 ".after" 子事件
			global: false, // 是否为全局性事件
			// 正在执行的监听器函数
			currentObserver: (function() {
				var func = function() { }
				func.isSystemObserver = func.isDefaultObserver = returnFalse;
				return func;
			})(),
			// 阻止监听器队列继续运行
			stop: function() {
				if (! this.isStopable()) {
					helpers.error('阻止 ' + this.type + ' 事件时发生错误: 不可阻止系统或全局事件.');
					return false;
				}
				if (! this.isStopped()) {
					if (! this.currentObserver.isSystemObserver()) {
						helpers.debug('事件 ' + this.type + ' 停止触发.');
					}
					this.isStopped = returnTrue;
				}
				return this.isStopped();
			},
			preventDefault: function() {
				this.isDefaultPrevented = returnTrue;
			}
		}

	};

	/* 判断是否为子事件 */
	['Before', 'After'].forEach(function(item, i) {
		var s = item.toLowerCase();
		events['_is' + item + 'Event'] = function(event_type) {
			return helpers.startsWith(event_type, s + '.');
		}
	});

	/* 注册/解除注册事件监听器 */
	['observe', 'stopObserving'].forEach(function(item, i) {
		events[item] = function() {
			return events._act.apply(events, [! i].concat($A(arguments)));
		}
	});

	/* 监听器操作 */
	events._act = function(type, event_type, func) {
		var event_type, context, func;

		if (! event_type) {
			helpers.error('必须指定事件类型.');
			return false;
		}

		event_type = event_type + '';
		if (event_type != event_type.toLowerCase()) {
			helpers.warn('事件类型 ' + event_type + ' 应为小写.');
		}
		event_type = event_type.toLowerCase();

		if (event_type === constants.globalEventType.toLowerCase()) {
			helpers.error('非法操作: 对于全局事件必须使用 "before." 或 "after." 子事件!');
			return false;
		}

		if (! events.isEventRegistered(event_type)) {
			helpers.error('试图向 ' + event_type + ' ' + (type ? '' : '解除') + '注册监听器时发生错误: 未知事件.');
			return false;
		}

		// 获取合法化的事件名称
		var _event_type = events.parseEventType(event_type);
		// 与事件对应的监听器队列
		var observers_list = events.getObserverList(event_type);

		// 注册监听器时, 必须指定监听函数; 取消注册时, 监听函数为可选值
		if (type) {
			switch (helpers.type(func)) {
				case 'function': case 'array':
					break;
				default:
					helpers.error(event_type + ' 事件回调函数无效.');
					return false;
			}
		}

		var error = '在 ' + event_type + ' 事件上' + (type ? '' : '取消') + '注册监听器时发生错误: ';
		if (func) {
			switch (helpers.type(func)) {
				case 'array':
					// func 可以是监听函数队列, 此时进行批量操作
					var successful = true;
					func.forEach(function(func) {
						// 只要出现错误就视为失败
						if (events._act(type, event_type, func) === false) successful = false;
					});
					return successful;

				case 'function':
					if (func === noop) return false;
					var index = observers_list.indexOf(func);
					if (type) {
						if (index > -1) {
							helpers.warn(error + '监听函数已存在. \n' + func);
							return false;
						}
						func.__proto__ = events.commonEventTemplate.currentObserver;
						observers_list.push(func);
						return true;
					} else {
						if (index === -1) {
							helpers.warn(error + '监听函数不存在. ' + '\n' + func);
							return false;
						}
						observers_list.splice(index, 1);
						return true;
					}
			}
			helpers.error(error + '监听函数非法.' + '\n' + func);
			return false;
		} else if (arguments.length == 2) {
			// 没有指定监听函数且操作类型为解除注册
			// 直接清空队列
			observers_list.length = 0;
			return true;
		}
		helpers.error(error + '参数错误.');
		return false;
	}

	/* 获得合法化的事件名 / 获取监听器列表 */
	;;;['parseEventType', 'getObserverList'].forEach(function(item, i) {
		events[item] = function(event_type) {
			// 事件名中的字母必须用小写
			event_type = (event_type + '').toLowerCase();
			// 判断是否为子事件类型
			var is_before = events._isBeforeEvent(event_type),
					is_after	= ! is_before && events._isAfterEvent(event_type);
			var _event_type = (is_before || is_after) && helpers.searchAfter(event_type, '.') || event_type;

			if (! i) return _event_type;

			var list_name = (is_before || is_after) ?
				(helpers.searchBefore(event_type, '.') + 'Listeners') : 'listeners';
			return events.registeredEvents[_event_type][list_name];
		}
	});

	/* 注册事件 */
	events.register = function(event_type, event_temp) {
		var error = '注册事件时发生错误: \n';
		if (! event_type) {
			helpers.error(error + '未指定事件类型. ');
			return false;
		}
		// 事件名称中的字母必须用小写
		event_type = (event_type + '').toLowerCase();
		if (events.isEventRegistered(event_type)) {
			helpers.warn(error + '事件类型' + event_type + '已存在, 请不要重复注册.');
			return false;
		}

		if (events._typeCheck(event_type)) {
			// 不允许使用子事件名进行注册
			helpers.error(error + '事件类型' + event_type + '不应包含 "before." 或 "after." 前缀.');
			return false;
		}

		event_temp = event_temp || {};
		event_temp.type = event_type;

		// 事件参数
		var event_params = events.registeredEvents[event_type] = {
			beforeListeners: [],
			listeners: [],
			afterListeners: [],
			errorHandler: noop,
			eventTemplate: event_temp,
			getCompleteTemplate: function() {
				return helpers.fastClone(events.getCommonEventTemplate(), this.eventTemplate);
			}
		};

		// 创建事件名列表, 用于快速判断事件是否注册
		events._createEventList();
		// 注册事件对象属性
		events.registerEventProperties(event_params);

		event_temp = event_params.getCompleteTemplate();

		// 系统/一次性事件注册后不会记录日志
		if (! event_temp.isSystemEvent() && ! event_temp.isOneTimeEvent()) {
			helpers.debug('已成功注册 ' + event_type + ' 事件.');
		}
		return true;
	}

	/* 取消注册事件 */
	events.unregister = function(event_type) {
		// 获得合法化的事件名
		event_type = events.parseEventType(event_type);
		// 事件必须已经注册且不允许取消注册系统事件
		if (events.isEventRegistered(event_type)) {
			var event_temp = events.registeredEvents[event_type].getCompleteTemplate();
			if (! event_temp.isSystemEvent()) {
				// 取消注册所有监听器
				['before.', '', 'after.'].forEach(function(item) {
					events.stopObserving(item + event_type);
				});
				if (! event_temp.isOneTimeEvent()) {
					helpers.debug('已成功取消注册 ' + event_type + ' 事件.');
				}
				delete events.registeredEvents[event_type];
				// 重建事件名列表
				events._createEventList();
				// 重建事件模板属性名列表
				events._createReadOnlyEventPropertyList();
				return true;
			}
		}
		helpers.warn('取消注册事件 ' + event_type + ' 失败: 未知事件.');
		return false;
	}

	/* 注册系统事件 */
	events.registerSystemEvent = function(event_type, params) {
		params = helpers.defaults(params || {}, {
			isSystemEvent: returnTrue,
			isStopable: returnFalse, //系统事件不允许被阻止
			autoTrigger: false // 默认不会自动触发 before. 和 after. 子事件
		});
		return events.register(event_type, params);
	}

	/* 注册系统/默认事件监听器 */
	'_addSystemObserver isSystemObserver|addDefaultObserver isDefaultObserver'.split('|').
	forEach(function(item, i) {
		item = item.split(' ');
		events[item[0]] = function(event_type, func) {
			switch (helpers.type(func)) {
				case 'function':
					func[item[1]] = returnTrue;
					break;
				case 'array':
					var successful = true;
					func.forEach.call(function(f) {
						if (events[item[0]](event_type, f) === false) {
							successful = false;
						}
					});
					return successful;
				default:
					helpers.error('注册系统事件监听器时发生错误: 监听器函数无效.' + '\n' + func);
					return false;
			}
			return events.observe(event_type, func);
		}
	});

	/* 注册一次性事件 */
	events.registerOneTimeEvent = function() {
		var args = $A(arguments);
		if (! helpers.isString(args[0])) {
			args.unshift('');
		}
		var event_type_prefix = args[0], event_temp = args[1];
		if (events._typeCheck(event_type_prefix)) {
			helpers.error('注册一次性事件时发生致命错误: 事件名前缀 ' + event_type_prefix + ' 非法.')
			return false;
		}

		var event_type, successful = false;
		var unregister = function() {
			setTimeout(function() {
				events.unregister(event_type);
			}, 0);
		}
		event_temp = helpers.defaults(event_temp || {}, {
			isOneTimeEvent: returnTrue,
			autoTrigger: false // 默认不自动触发 before. 和 after. 子事件
		});
		do {
			// 由于事件名不允许包含大写字母, 所以生成的 ID 应是 36 位数而不是 62 位数.
			event_type = (event_type_prefix + constants.OneTimeEventType + helpers.UUID(2, 36)).toLowerCase();
			successful = events.register(event_type, event_temp);
		} while (! successful); // 可能由于种种原因导致注册失败, 此时重新注册
		// 返回含有便捷方法的对象
		return events.getShortcuts(event_type);
	}

	/* 根据事件名获取含有便捷方法的事件对象 */
	events.getShortcuts = (function() {
		function processArgs() {
			var args = $A(arguments);
			// 补全事件名
			if (events._typeCheck(args[0] + '.')) {
				args[0] = (args[0] + '').toLowerCase() + '.' + this.getEventType();
			} else {
				args.unshift(this.getEventType());
			}
			return args;
		}
		function _handler(_type) {
			_type = _type ? 'observe' : 'stopObserving';
			return function() {
				events[_type].apply(events, processArgs.apply(this, arguments));
				return this;
			}
		}

		function getShortcuts(event_type) {
			// 确认事件是否已注册
			if (! events.isEventRegistered(event_type)) {
				helpers.error('获取事件 ' + event_type + ' 时发生致命错误.');
				return false;
			}
			// 取得合法化的事件名称
			event_type = events.parseEventType(event_type);
			return new Shortcuts(event_type);
		}

		var Shortcuts = function(event_type) {
			this.getEventType = function() {
				return event_type;
			}
		}

		Shortcuts.prototype = {
			constructor: getShortcuts,
			trigger: function() {
				return events.trigger.apply(undefined, processArgs.apply(this, arguments));
			},
			triggerWith: function() {
				return events.trigger.apply(arguments[0], processArgs.apply(this, $A(arguments, 1)));
			},
			unregister: function() {
				return events.isEventRegistered(this.getEventType()) && events.unregister(this.getEventType());
			}
		};
		['observe', 'stopObserving'].forEach(function(item, i) {
			Shortcuts.prototype[item] = _handler(! i);
		});

		return getShortcuts;
	})();

	/* 注册/取消注册全局事件监听器 */
	['addGlobalObserver', 'removeGlobalObserver'].forEach(function(item, i) {
		var error = (i ? '解除' : '') + '注册全局事件失败: ';
		events[item] = function(type, func) {
			var successful = false;
			switch (helpers.type(func)) {
				case 'function':
					successful = events._act(! i, type.toLowerCase() + '.' + constants.globalEventType, func);
					if (successful && ! func.isSystemObserver()) {
						helpers.debug((i ? '解除' : '') + '注册 ' + type.toLowerCase() + ' 全局事件监听器成功.' + '\n' + func);
					}
					break;

				case 'array':
					successful = true;
					func.forEach.call(function(func) {
						if (events[item](type, func) === false) successful = false;
					});
					break;

				default:
					helpers.error(error + '监听器函数无效.' + '\n' + func);
					break;
			}
			return successful;
		}
	});

	/* 注册全局系统事件监听器 */
	events.addGlobalSystemObserver = function(type, func) {
		func && (func.isSystemObserver = returnTrue);
		return events.observe((type ? type + '.' : '') + constants.globalSystemEventType, func);
	}

	/* 注册事件属性 */
	events.registerEventProperties = function(params) {
		if (! helpers.isObject(params)) {
			helpers.error('注册事件属性失败: 参数无效.');
			return false;
		}
		// 先复制一份, 避免修改原对象
		var event_temp_copy = helpers.fastExtend({}, params.eventTemplate);
		// 提取出可写属性
		var passableProperties = event_temp_copy._passableProperties;
		delete event_temp_copy._passableProperties;
		// 获取所有只读属性的名称
		params.regularProperties = Object.keys(event_temp_copy);
		// 再复制一份, 并且将可写参数也一并写入, 将最终的对象设置为事件模板
		params.eventTemplate = helpers.fastExtend({}, event_temp_copy, passableProperties);
		// 获取所有可写属性的名称
		params.passableProperties = Object.keys(event_temp_copy);

		events._createReadOnlyEventPropertyList();
		return true;
	}

	/* 创建只读事件属性名列表 */
	events._createReadOnlyEventPropertyList = function() {
		var properties = {}, registered_event, _regular;
		for (registered_event in events.registeredEvents) {
			helpers.fastExtend(properties, registered_event.regularProperties);
		}

		events.registeredReadOnlyEventProperties = Object.keys(properties);
	}

	/* 获取通用模板 */
	events.getCommonEventTemplate = function() {
		return events._commonEventTemplate || events.setupCommonEventTemplate(events.commonEventTemplate);
	}

	/* 配置通用事件模板 */
	events.setupCommonEventTemplate = function(temp) {
		if (helpers.isObject(temp)) {
			var common_temp = events.commonEventTemplate;
			helpers.extend(true, common_temp, temp);
			events._commonEventTemplate = helpers.clone(true, common_temp, common_temp._passableProperties);
			events.registerEventProperties(helpers.clone(common_temp));
		} else {
			helpers.warn('配置通用事件模板失败: 参数无效.');
		}
		return events._commonEventTemplate;
	}

	/* 设置错误回调函数 */
	events.setupErrorHandler = function(event_type, func) {
		var error = '为 ' + event_type + ' 事件设置错误回调函数时发生错误: ';
		if (! events.isEventRegistered(event_type)) {
			helpers.error(error + '未知事件.');
			return false;
		}
		if (! helpers.isFunction(func)) {
			helpers.error(error + '错误回调函数无效.' + '\n' + func);
			return false;
		}
		var _event_type = events.parseEventType(event_type);
		events.registeredEvents[_event_type]['errorHandler'] = func;
		if (! func.isSystemObserver()) {
			helpers.debug('成功为 ' + event_type + ' 事件设置错误回调函数.');
		}
		return true;
	}

	/* 创建已注册事件名称列表, 用于快速判断事件是否注册 */
	events._createEventList = function() {
		events._registeredEventList = {};
		Object.keys(events.registeredEvents).
		forEach(function(event_type) {
			['before.', '', 'after.'].forEach(function(name) {
				events._registeredEventList[name + event_type] = true;
			});
		});
		return events._registeredEventList;
	}

	/* 检查事件是否为 "before." 或 "after." 子事件 */
	events._typeCheck = function(event_type) {
		event_type = (event_type + '').toLowerCase();
		return events._isBeforeEvent(event_type) || events._isAfterEvent(event_type);
	}

	/* 初始化事件对象 */
	events.initEvent = function(event_type, event) {
		// 取得合法化的事件名称
		var _event_type = events.parseEventType(event_type);
		// 事件模板
		var event_temp = events.isEventRegistered(event_type) ?
			events.registeredEvents[_event_type].getCompleteTemplate() : {};

		/* 删除那些不应该被传递的属性 */
		if (helpers.isObject(event)) {
			helpers.delete(event, events.registeredReadOnlyEventProperties);
		}
		event = event || {};
		event.type = event_type;

		/* 利用类的继承实现快速属性扩展 */
		event.__proto__ = event_temp;
		return event;
	}

	/* 触发事件 */
	events.trigger = function(event_type, data, event) {

		if (! event_type) {
			helpers.error('触发事件失败: 请指定事件类型.');
			return false;
		}
		// 事件名中的字母必须是小写
		event_type = (event_type + '').toLowerCase();

		if (! events.isEventRegistered(event_type)) {
			helpers.error('触发事件失败: 未知事件类型 ' + event_type + '.');
			return false;
		}

		if (event_type === constants.globalEventType) {
			helpers.error('非法操作: 对于全局事件必须使用 \'before.\' 或 \'after.\' 子事件!');
			return false;
		}

		// 获取监听器列表
		var observers_list = events.getObserverList(event_type);
		// 获取合法化的事件名称
		var _event_type = events.parseEventType(event_type);

		// 判断事件是否已注册
		if (! events.isEventRegistered(event_type)) {
			helpers.error('未知事件: ' + event_type);
			return false;
		}

		var event_params = events.registeredEvents[_event_type];
		var event_temp = event_params.getCompleteTemplate();

		event = event || {};

		// 如果当前事件类型不是 "before." 或 "after." 事件 (全局事件一定是 "before." 或 "after." 事件)
		// 自动触发 "before." 子事件
		if (! event_temp.global && event_temp.autoTrigger &&
			_event_type == event_type) {
			data = events.triggerWith(
				this,
				'before.' + _event_type,
				data,
				event
			);
		}

		// 应用事件对象模板, 不会修改传入的 event 中的属性
		event = events.initEvent(event_type, event);

		// 触发全局 "before." 事件
		if (! event_temp.global && ! event.isStopped()) {
			data = events.triggerWith(
				this,
				'before.' + constants.globalEventType,
				data,
				{ srcEvent: event }
			);
		}

		if (! event.isStopped()) {
			// 获取监听器列表
			try {
				var current, ret;
				for (var m = 0; (current = observers_list[m]) && ! event.isStopped(); m++) {
					if (event.isDefaultPrevented() && current.isDefaultObserver()) continue;

					event.currentObserver = current;

					// 系统事件或系统监听器不应生成日志
					if (! current.isSystemObserver() && ! event_temp.isSystemEvent()) {
						helpers.note('触发事件: ' + event_type);
					}

					ret = current.call(this, data, event);
					// 如果监听器返回了数据, 则将这些返回值作为参数传入后面的监听器
					if (ret !== undefined) data = ret;

					delete event.currentObserver;
				}
			}
			catch (error) {
				helpers.error('触发 ' + event_type + ' 事件时发生错误: ' + '\n' + error + '\n' +
											'func:' + current + '\n' + 'data: ' + data + '\n' + 'context: ' + this);
				// 不确定此时该事件是否已被取消注册, 为避免出错需进行判断
				if (events.isEventRegistered(event_type)) {
					events.registeredEvents[_event_type]['errorHandler'](error, event, data);
				}
				event_temp.isStopable() && event.stop();
			}
		}

		// 如果是一次性事件, 则在触发完毕后取消注册所有监听器
		if (event_temp.isOneTimeEvent()) {
			events.stopObserving(event_type);
		}

		// 如果监听器列表非空, 事件没有被阻止, 且不是系统事件, 则生成日志
		if (! event.isStopped() && ! event_temp.isSystemEvent()) {
			if (
				observers_list && observers_list.some &&
				// 判断是否触发了非系统监听器
				observers_list.some(function(func) {
					return func && ! func.isSystemObserver();
				})
			) {
				helpers.debug('事件 ' + event_type + ' 已成功触发.');
			}
		}

		// 触发全局 "after." 事件
		if (! event_temp.global) {
			data = events.triggerWith(
				this,
				'after.' + constants.globalEventType,
				data,
				{ srcEvent: event }
			);
		}

		// 触发 "after." 子事件
		if (! event_temp.global && ! event.isStopped() &&
			event_temp.autoTrigger && _event_type == event_type) {
			data = events.triggerWith(
				this,
				'after.' + _event_type,
				data,
				event
			);
		}

		return data;
	}

	/* 使用指定的上下文触发事件 */
	events.triggerWith = function() {
		return events.trigger.apply(arguments[0], $A(arguments, 1));
	}


	/*
		 ** AJAX 类 **
	*/

	/* AJAX 类构造函数 */
	var ajax = function(url, options) {
		if (! (this instanceof ajax)) {
			return new ajax(url, options);
		}
		var request = this;

		options = this.options = helpers.clone(constants.ajaxOptions, config.ajaxOptions, options || {});

		var xhr = this.xhr = new XMLHttpRequest;
		var method = options.method = options.method.toUpperCase();
		var headers = options.headers = (options.headers || {});
		var deferred = this.deferred = new Ripple.Deferred();
		this.deferred.promise(this);

		this.oneTimeEvents = {};

		// 准备数据
		if (options.processData) {
			options.params = helpers.paramMap(options.params);
			// 如果禁用缓存, 则加上时间戳
			if (options.noCache) {
				options.params._ = Date.now();
			}
		}

		// 临时事件的事件模板
		var _getEventTemp = function() {
			// 使用一个函数来获得模板对象, 避免不同事件使用同一个事件模板对象
			// 防止参数互相污染
			// 把 ajax 参数写入事件模板, 这样全局监听器就可以修改参数
			return {
				autoTrigger: true,
				// 如果 global 为真, 则可能触发 ajax_start / ajax_stop 事件
				globalAjax: options.global,
				isAjaxEvent: returnTrue,
				isStopable: returnTrue,
				xhr: xhr,
				_passableProperties: {
					// 这些值可以被修改
					url: url,
					ajaxOptions: options
				}
			};
		}

		// AJAX 请求结束时调用的回调函数
		var _oncomplete = function(data) {
			// 触发 oncomplete 事件
			ajax_oncomplete_event.triggerWith(request, data);
			// 如果 global 为 true, 且全部 ajax 请求都已结束, 触发全局 ajax_stop 事件
			if (options.global && ! --ajax.active) {
				events.triggerWith(request, 'ajax_stop');
			}
			setTimeout(function() {
				// 取消注册所有一次性事件, 释放资源
				unregisterOneTimeEvents();
				// 取消注册 ajax
				if (ajax_uid !== true) {
					delete ajax.pool[ajax_uid];
				}
				// 取消锁定
				var lock = options.lock;				
				if (lock) {
					delete lock._ajax_active_;
				}
			}, 0);
		}

		// AJAX 请求失败时调用的回调函数
		var _onexception = function(_, e) {
			var type = this.getHeader('Content-type');
			return helpers.extend(callback_event, {
				status: xhr.status,
				statusText: xhr.statusText,
				url: e.url,
				options: e.ajaxOptions,
				params: e.ajaxOptions.params,
				method: e.ajaxOptions.method,
				responseType: type,
				responseXML: xhr.responseXML
			});
		}

		// 注册一次性事件
		var ajax_onstart_event = events.registerOneTimeEvent('ajax_onstart', _getEventTemp());
		var ajax_send_event = events.registerOneTimeEvent('ajax_send', _getEventTemp());
		var ajax_oncomplete_event = events.registerOneTimeEvent('ajax_oncomplete',
			helpers.clone(_getEventTemp(), { isStopable: returnFalse }));

		function unregisterOneTimeEvents() {
			var one_time_event;
			for (one_time_event in ajax_one_time_events) {
				if (ajax_one_time_events.hasOwnProperty(one_time_event)) {
					ajax_one_time_events[one_time_event].unregister();
				}
			}
		}

		// 将所有一次性事件收集起来, 请求结束后全部取消注册
		// 同时为 "observe" 方法做准备
		var ajax_one_time_events = this.oneTimeEvents = {
			onstart: ajax_onstart_event,
			send: ajax_send_event,
			oncomplete: ajax_oncomplete_event
		};

		// 注册带有状态意义 (如 success, onabort) 的一次性事件
		Object.keys(constants.normalAjaxEventTypes).
		forEach(function(formal_type) {
			// formal_type 为符合标准的事件名, local_type 为 Ripple 规定的事件名
			var local_type = constants.normalAjaxEventTypes[formal_type];
			// 注册一次性事件
			var typed_event = events.registerOneTimeEvent('ajax_' + local_type, _getEventTemp());
			// 将一次性事件收集起来
			ajax_one_time_events[local_type] = typed_event;

			if (local_type == 'success') {
				// 如果成功, 则先对数据进行处理
				typed_event.observe(request.processData.bind(request));
			}
			if (local_type == 'error') {
				typed_event.observe(function() {
					// 尝试处理数据
					callback_event.response = request.processData();
				});
			}
			if (local_type != 'success') {
				// 处理异常
				typed_event.observe([
					function() {
						callback_event.exceptionType = local_type;
						return callback_event;
					},
					_onexception
				]);
			}
			if (options[local_type] !== noop) {
				// 如果指定了有效的回调函数, 那么注册为监听器
				typed_event.observe(options[local_type]);
			}
			// 事件触发完毕后, 触发 oncomplete 事件
			typed_event.observe('after', _oncomplete);
		});

		// 如果请求失败, 则将这个对象传入相应的回调函数
		var callback_event = {
			status: 0,
			statusText: '',
			exceptionType: '',
			response: ''
		};

		var ajax_uid;
		if (options.unique) {
			// unique 为 true, 则不管是否存在重复的请求, 都继续进行
			ajax_uid = true;
		} else {
			// 如果 unique 为 false, 则根据参数判断是否存在重复的请求正在进行
			ajax_uid = JSON.stringify({
				url: url,
				params: options.params,
				success: options.success,
				error: options.error
			});
			if (ajax.pool[ajax_uid]) {
				// 如果存在则直接忽略这次请求
				// 因为事件已经注册, 所以需要取消注册
				unregisterOneTimeEvents();
				return new Ripple.Deferred();
			}
			// 注册这次 ajax 请求
			ajax.pool[ajax_uid] = true;
		}

		// 在各个一次性事件中传递的事件对象, 帮助传递参数
		var event = {};

		// 将对事件的触发异步化, 所以在事件得到触发前, 允许用户继续修改参数
		// 所以即便 ajax 请求被封装在系统内部, 仍然可以很容易地被外界修改
		Ripple.Deferred.
		next(function() {
			// lock 是一个对象或元素, 可选
			var lock = options.lock;
			if (lock) {
				// 如果检查到 lock 上面的标记, 则直接停止
				// 但考虑到可能会设置链式回调函数, 所以需要返回一个 Deferred 以避免出错
				// 这些回调函数不会被触发
				if (lock._ajax_active_) {
					unregisterOneTimeEvents();
					if (! options.unique) {
						delete ajax.pool[ajax_uid];
					}
					return new Ripple.Deferred();
				}
				// 在 lock 上面做标记
				lock._ajax_active_ = true;
			}

		}).
		next(function() {
			// 全局监听器可能会监视这个事件并使用 event.srcEvent.stop()
			ajax_onstart_event.
				observe(options.onstart).
				triggerWith(request, undefined, event);

			// 如果事件被阻止, 则视为放弃这次 ajax 请求
			// 我们认为是通过全局监听器阻止了事件, 所以实际上没有任何事件被触发
			// 因此不去触发 onabort 事件
			if (event.isStopped()) {
				setTimeout(unregisterOneTimeEvents, 0);
				// 返回一个 Deferred 对象, 从而终止 next 链的运行
				return new Ripple.Deferred();
			}
		}).

		next(function() {
			ajax_oncomplete_event.observe([
				options.oncomplete,
				function(data, e) {
					xhr.onreadystatechange = null;
					// 如果是连接到饭否服务器的请求
					if (helpers.startsWith(e.url, constants.baseOAuthUrl) ||
						helpers.startsWith(e.url, config.baseAPIUrl)) {
						// 读取服务器时间
						var server_time = this.getHeader('Date');
						if (server_time && xhr.localTime) {
							// 修正服务器与本地的时间差
							Ripple.OAuth.correctTimestamp(Date.parse(server_time) / 1000, xhr.localTime);
						}
					}
					// 调用链式回调函数 (Deferred)
					request.deferred[request.isSuccessful() ? 'call' : 'fail'](data);
				}
			])
		}).

		next(function() {
			// 如果 global 为 true, 且当前没有任何 ajax 请求运行
			// 则触发全局 ajax_start 事件
			if (options.global && ! ajax.active++) {
				events.triggerWith(request, 'ajax_start');
			}
		}).

		next(function() {
			ajax_send_event.
			observe(options.send).
			observe(function(_, event) {
				if (event.isStopped()) {
					// 如果这个时候事件被阻止, 则触发 onabort 事件
					ajax_one_time_events['onabort'].triggerWith(request, undefined, event);
					return;
				}
				try {
					// url 和 options 可以在全局监听器中修改
					var url = event.url;
					var options = event.ajaxOptions;
					xhr.open(method, url, options.async);

					xhr.timeout = options.timeout;

					// 监听 XMLHttpRequest Level 2 事件
					Object.keys(constants.normalAjaxEventTypes).
					forEach(function(formal_type) {
						var local_type = constants.normalAjaxEventTypes[formal_type];
						xhr[formal_type] = function(e) {
							var event_type = local_type;
							if (formal_type == 'onload' && ! request.isSuccessful()) {
								event_type = 'error';
							}
							ajax_one_time_events[event_type].triggerWith(
								event_type == 'success' ? (options.context || request) : request,
								undefined, event);
						}
					});

					// 监听与上传相关的事件
					constants.uploadingAjaxEventTypes.
					forEach(function(event_type) {
						if (options[event_type] !== noop) {
							xhr.upload[event_type] = options[event_type];
						}
					});

					// 处理参数
					var params = options.params;
					if (options.processData) {
						// 先将参数转换为 map
						params = helpers.paramMap(params);
						switch (method) {
							// 如果是 'DELETE' / 'PUT' 方法, 需要特殊处理
							case 'DELETE': case 'PUT':
								params['_method'] = method.toLowerCase();
								method = options.method = 'POST';
						}
						// 大多数情况下会把参数串行化
						// 但当需要上传文件的时候, 就需要使用 FormData
						params = options.urlEncoded ?
							helpers.param(params) : helpers.buildFormData(params);
					}

					if (options.urlEncoded && method != 'GET') {
						headers['Content-Type'] = 'application/x-www-form-urlencoded';
					}

					// 如果是 GET 方法, 则将参数全部加到 url 后面
					if (method == 'GET') {
						if (params) {
							url += (url.indexOf('?') > -1 ? '&' : '?') + params;
						}
						params = null;
					}

					// 把最终的 url 和参数重新写到事件对象里, 这样在错误回调函数中,
					// 可以得到这些最终使用的参数
					options.params = params;
					event.url = url;

					headers['Accept'] = constants.responseTypes[options.accepts] || constants.responseTypes['*'];
					try {
						for (var header in headers) {
							if (headers.hasOwnProperty(header)) {
								xhr.setRequestHeader(header, headers[header]);
							}
						}
					} catch (e) { }

					xhr.onreadystatechange = function(e) {
						if (xhr.readyState === 3) {
							xhr.localTime = new Date;
						}
					}
					xhr.send(params);
				} catch (e) {
					// 处理错误
					ajax_one_time_events['error'].triggerWith(request, undefined, event);
				}
			}).triggerWith(request, undefined, event);
		});

		return this;
	}

	/* 记录运行中的 AJAX 请求数量 */
	ajax.active = 0;

	/* 保存 AJAX 请求的识别信息 */
	ajax.pool = {};

	var ajaxPt = ajax.prototype;

	/* 处理返回数据 */
	ajaxPt.processData = function() {
		var text = this.xhr.responseText;
		var xml = this.xhr.responseXML;
		var options = this.options;
		var content_type = this.getHeader('Content-type');
		var x_json_data	= this.getHeader('X-JSON');

		try {
			if (x_json_data) {
				return JSON.parse(x_json_data);
			}

			if (options.evalResponse || (options.evalJS && /(ecma|java)script/i.test(content_type))) {
				helpers.eval(text);
			} else if (options.evalJSON && helpers.startsWith(content_type, 'application/json')) {
				return JSON.parse(text);
			} else if (/(application|text)\/xml/i.test(content_type)) {
				return xml;
			}
		} catch (e) { }
		return text;
	}

	/* 取消 AJAX 请求 */
	ajaxPt.cancel = function() {
		try {
			this.xhr.abort();
		} catch (e) { }
	}

	/* 判断请求是否成功 */
	ajaxPt.isSuccessful = function() {
		var xhr = this.xhr;
		var status = xhr.status;
		if (! status && ! xhr.statusText && xhr.response) {
			// 本地请求
			return true;
		}
		return status >= 200 && status < 300;
	}

	/* 注册监听器 */
	ajaxPt.observe = function() {
		// 提供一个注册监听器的便捷方法
		var args = $A(arguments);
		var event_type = args[0];
		if (args.length == 2) {
			if (events._typeCheck(args[0])) {
				args = [
					events.parseEventType(event_type),
					helpers.searchBefore(event_type, '.'),
					args[1]
				];
			}
		}
		event_type = args.shift();
		var one_time_event = this.oneTimeEvents[event_type];
		one_time_event.observe.apply(one_time_event, args);
		return this;
	}

	/* 读取 Request Header */
	ajaxPt.getHeader = function(name) {
		var value = null;
		try {
			value = this.xhr.getResponseHeader(name);
		} catch(e) { }
		return value;
	}

	/* 设置 Request Header */
	ajaxPt.setHeader = function(name, value) {
		this.options.headers[name] = value;
		return this;
	}

	/* 配置 AJAX 请求 */
	ajaxPt.setupAjax = function(object) {
		// 提供一个配置 ajax 的便捷方法
		// 可以在 ajax 请求生成后使用
		// 从而打破 ajax 被封闭在系统内部后造成的限制
		helpers.extend(true, this.options, object);
		return this;
	}

	/* 注册便捷方法 */
	;;;['GET', 'POST', 'PUT', 'DELETE'].forEach(function(method) {
		ajax[method.toLowerCase()] = function(url, options) {
			options = options || {};
			options.method = method;
			return new ajax(url, options);
		}
	});

	/* 内部使用的便捷方法 */
	var get = ajax.get, post = ajax.post;

	var getJSON = ajax.getJSON = function(url, options) {
		options = options || {};
		options.accepts = 'json';
		return get(url, options);
	}



	/*
		 ** 网址缩短 **
	*/
	var shorten = {};

	/* 注册网址缩短服务 */
	shorten.register = function(options) {
		shorten[options.name] = function() {
			var params = options.argsProcessor.apply(this, arguments);
			return post(options.url, {
				params: params
			});
		}
	}

	shorten.register({
		name: 'is.gd',
		url: 'http://is.gd/create.php',
		argsProcessor: function(long_url) {
			return {
				format: 'simple',
				url: long_url
			};
		}
	});

	shorten.register({
		name: 'yep.it',
		url: 'http://yep.it/api.php',
		argsProcessor: function(long_url) {
			return {
				url: long_url
			};
		}
	});


	/*
		 ** OAuth 验证方法 **
	*/
	var authorize = {};

	/* 获取 Request Token */
	authorize.getRequestToken = function() {
		var message = authorize.generateMsg('request_token');
		return authorize.sendRequest(message);
	}

	/* 获取 Access Token */
	authorize.getAccessToken = function(request_token, pincode) {
		var message = authorize.generateMsg('access_token', {
			oauth_token: request_token.oauth_token,
		});
		if (arguments.length == 2) {
			message.parameters.oauth_verifier = pincode;
		}
		var accessor = {
			tokenSecret: request_token.oauth_token_secret
		};
		return authorize.sendRequest(message, accessor);
	}

	/* 获取验证地址 */
	authorize.withPINCodeOrCallbackUrl = function(callback_url) {
		return authorize.
			getRequestToken().
			next(function(request_token) {
				request_token = Ripple.OAuth.decodeForm(request_token);
				request_token = Ripple.OAuth.getParameterMap(request_token);
				var url = constants.baseOAuthUrl +
					'authorize?oauth_token=' +
					request_token.oauth_token +
					'&oauth_callback=' +
					(callback_url || 'oob');
				return {
					request_token: request_token,
					auth_url: url
				};
			});
	}

	/* 通过 PIN Code 获取 Access Token */
	authorize.withPINCode = function(promise) {
		var request_token;
		return authorize.
			withPINCodeOrCallbackUrl('oob').
			next(function(args) {
				request_token = args.request_token;
				return promise(args.auth_url);
			}).
			next(function(pincode) {
				return authorize.
					getAccessToken(request_token, pincode).
					next(authorize.processToken);
			});
	}

	/* 通过 Callback 获取 Access Token */
	authorize.withCallbackUrl = function(callback_url) {
		return authorize.
			byPINCodeOrCallbackUrl(callback_url).
			next(function(args) {
				Ripple.cache.set(constants.requestTokenStorage, args.request_token);
				return args.auth_url;
			});
	}

	/* 生成 OAuth Callback */
	authorize.generateCallback = function() {
		try {
			var params = window.location.href.split('?')[1];
			var request_token = authorize.processToken(params);
			var _request_token = Ripple.cache.get(constants.requestTokenStorage);
			if (_request_token.oauth_token !== request_token.oauth_token) {
				throw 'error';
			}
		} catch (e) {
			var d = new Ripple.Deferred();
			Ripple.Deferred.call(d.fail, 'Request Token 无效.');
			return d;
		}
		window.localStorage.removeItem(constants.requestTokenStorage);
		return authorize.
			getAccessToken(_request_token).
			next(authorize.processToken);
	}

	/* 通过用户名与密码获取 Access Token */
	authorize.withCredentials = function(username, password) {
		var message = authorize.generateMsg('access_token', {
			x_auth_username: username,
			x_auth_password: password,
			x_auth_mode: 'client_auth'
		});
		return authorize.
			sendRequest(message).
			next(authorize.processToken);
	}

	/* 生成 Message 对象 */
	authorize.generateMsg = function(action, parameters) {
		var message = {
			action: constants.baseOAuthUrl + action,
			method: 'GET',
			parameters: parameters || {}
		};
		helpers.fastExtend(message.parameters, {
			oauth_signature_method: constants.signMethod,
			oauth_consumer_key: consumer.consumer_key,
			oauth_version: config.OAuthVersion
		});
		return message;
	}

	/* 将返回的参数处理为 map */
	authorize.processToken = function(token) {
		token = Ripple.OAuth.decodeForm(token);
		token = Ripple.OAuth.getParameterMap(token);
		return token;
	}

	/* 发送请求 */
	authorize.sendRequest = function(message, accessor) {
		accessor = accessor || {};
		accessor.consumerSecret = consumer.consumer_secret;

		Ripple.OAuth.setTimestampAndNonce(message);
		Ripple.OAuth.SignatureMethod.sign(message, accessor);

		return getJSON(message.action, {
			headers: {
				Authorization: Ripple.OAuth.getAuthorizationHeader('', message.parameters)
			},
			params: null,
			processData: false
		});
	}


	/*
		 ** 账号对象构造函数 **
	*/

	var Account = function(access_token, options) {
		this.accessToken = access_token;
		this.accessor = {
			consumerSecret: '',
			tokenSecret: access_token.oauth_token_secret
		};

		options && helpers.fastExtend(this, options);
		events.triggerWith(this, 'create_account', options);
		return this;
	}

	/* 处理参数 */
	Account.argsProcessor = function(x) {
		return helpers.isObject(x) ? x : {};
	}

	/* 处理 Url */
	Account.urlProcessor = function(x) { return x; }

	var registeredAPIList = [];

	var registerAPI = function(options, default_ajax_options) {
		var name = options.name;
		registeredAPIList.push(name);

		var event_type = helpers.underscored(name);
		var event_temp = options.eventTemplate || {};
		events.registerSystemEvent(event_type, event_temp);

		var packer = options.packer;
		if (packer) {
			Account.prototype[name] = packer;
			return true;
		}

		var action = config.baseAPIUrl + options.action + '.json';
		var method = options.method = options.method.toUpperCase();
		var argsProcessor = options.argsProcessor || Account.argsProcessor;
		var urlProcessor = options.urlProcessor || Account.urlProcessor;

		default_ajax_options = helpers.fastExtend({
			method: method,
			accepts: 'json',
			urlEncoded: true,
			processData: true
		}, default_ajax_options || {});

		var success = default_ajax_options.success;
		default_ajax_options.success = success ?
			(function(data, event) {
				event.actionType = event_type;
				return success.call(this, data, event);
			}) : (function(data, event) {
				event.actionType = event_type;
				return events.triggerWith(this, event_type, data, event);
			});

		Account.prototype[name] = function() {
			var self = this;
			var parameters = argsProcessor.apply(this, arguments);

			var message = {
				action: urlProcessor(action, parameters),
				method: method,
				parameters: {
					oauth_consumer_key: consumer.consumer_key,
					oauth_token: self.accessToken.oauth_token,
					oauth_signature_method: constants.signMethod,
					oauth_version: config.OAuthVersion
				}
			};
			var accessor = {
				consumerSecret: consumer.consumer_secret,
				tokenSecret: this.accessor.tokenSecret
			};

			Ripple.OAuth.setTimestampAndNonce(message);

			var ajax_options = helpers.fastExtend({
				params: parameters,
				context: self
			}, default_ajax_options);

			var headers = ajax_options.headers = {};

			if (method == 'GET' || ajax_options.urlEncoded === true) {
				message.parameters = helpers.fastExtend({}, parameters, message.parameters);
				Ripple.OAuth.SignatureMethod.sign(message, accessor);
				if (method == 'GET') {
					var params = helpers.param(parameters);
					message.action += params ? ('?' + params) : '';
					ajax_options.params = null;
					ajax_options.processData = false;
				}
			} else {
				Ripple.OAuth.SignatureMethod.sign(message, accessor);
				helpers.fastExtend(parameters, message.parameters);
			}

			headers['Authorization'] = Ripple.OAuth.getAuthorizationHeader(action, message.parameters);
			headers['Cache-Control'] = 'no-cache';

			return ajax(message.action, ajax_options);
		}

		return true;
	}


	/*
		 ** 初始化 **
	*/

	;;;(function initialize() {
		// 注册真正的全局事件 (所有全局监听器都会绑定在上面)
		[constants.globalEventType, constants.globalSystemEventType].
		forEach(function(event_type) {
			events.registerSystemEvent(event_type, { global: true });
		});

		// 使全局系统事件的 before. 和 after. 子事件得到自动触发
		['before', 'after'].forEach(function(type) {
			var func = function(data, e) {
				events.trigger(type + '.' + constants.globalSystemEventType, data, e);
			}
			func.isSystemObserver = returnTrue;
			events.addGlobalObserver(type, func);
		});

		// 把全局性的 AJAX 事件注册为系统事件, 这样它们就不会被阻止
		constants.globalAjaxEventTypes.
		forEach(function(type) {
			events.registerSystemEvent(type);
		});

		// 注册 AJAX 事件
		Object.keys(constants.normalAjaxEventTypes).
		concat(constants.customAjaxEventTypes).
		map(function(formal_type) {
			// formal_type 为实际的事件名, local_type 为 Ripple 定义的事件名
			var local_type = (constants.normalAjaxEventTypes[formal_type] || formal_type);
			return 'ajax_' + local_type;
		}).
		forEach(function(event_type) {
			events.registerSystemEvent(event_type, { global: true });
			['before', 'after'].forEach(function(type) {
				events.addGlobalSystemObserver(type, function(data, e) {
					if (helpers.startsWith(e.srcEvent.type, event_type)) {
						events.trigger(type + '.' + event_type, data, e);
					}
				});
			});
		});

		events.addGlobalSystemObserver('after', function(data, e) {
			if (e.srcEvent.isOneTimeEvent() && events._isAfterEvent(e.srcEvent.type)) {
				// 触发一次性事件的 after. 子事件后, 取消注册事件
				var event_type = events.parseEventType(e.srcEvent.type);
				if (events.isEventRegistered(event_type)) {
					events.unregister(event_type);
				}
			}
		});

		// 注册系统事件
		constants.systemEventTypes.
		forEach(function(event_type) {
			events.register(event_type);
		});
	})();



	var Ripple = Global.Ripple = function(access_token, options) {
		return new Account(access_token, options);
	}

	helpers.fastExtend(Ripple, {

		/* 配置 consumer */
		setupConsumer: function(object) {
			consumer = {
				consumer_key: object.consumer_key || object.key,
				consumer_secret: object.consumer_secret || object.secret
			};
			return this;
		},

		/* Ripple 参数配置 */
		config: function(param) {
			helpers.extend(true, config, param);
			return this;
		},
		getConfig: function(name) {
			return config[name];
		},

		/* 网址缩短服务 */
		shorten: shorten,

		/* 验证方法 */
		authorize: authorize,

		/* 注册 API */
		registerAPI: registerAPI,

		/* 已注册的 API 列表 */
		registeredAPIList: registeredAPIList,

		/* 辅助方法 */
		helpers: helpers,

		/* 事件 */
		events: events,

		/* AJAX 类 */
		ajax: ajax

	});

	// 便捷写法
	if (Global.R === undefined) Global.R = Ripple;
	if (Global.O_o === undefined) Global.O_o = Ripple;

})(this);
