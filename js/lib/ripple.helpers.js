// JSDeferred 0.4.0 Copyright (c) 2007 cho45 ( www.lowreal.net )
// See http://github.com/cho45/jsdeferred
// Modified by swding
function Deferred () { return (this instanceof Deferred) ? this.init() : new Deferred() }
Deferred.ok = function (x) { return x };
Deferred.ng = function (x) { throw  x };
Deferred.prototype = {

	_id : 0xe38286e381ae,


	init : function () {
		this._next    = null;
		this.callback = {
			ok: Deferred.ok,
			ng: Deferred.ng
		};
		return this;
	},

	next  : function (fun) { return this._post("ok", fun) },

	error : function (fun) { return this._post("ng", fun) },

	call  : function (val) { return this._fire("ok", val) },

	fail  : function (err) { return this._fire("ng", err) },

	always: function (fun) { return this.error(Deferred.ok).next(fun) },

	stop  : function () { return new Deferred() },

	hold  : function (fun) {
		var _fun = function (x) {
			var okng = arguments.callee.caller.arguments[0];
			var ret = fun.call(this, x);
			ret = ret === undefined ? x : ret;
			if (arguments.callee.caller.arguments[0] == "ok") return ret;
			else throw ret;
		}
		this._next = new Deferred();
		this._next.callback = {
			ok: _fun,
			ng: _fun
		};
		return this._next;
	},

	promise: function (target) {
		var tail = d = this;
		var methods = Deferred.promiseMethods;
		target = target || {};
		target._getTail = function() {
			while (Deferred.isDeferred(tail._next))
				tail = tail._next;
			return tail;
		}
		for (var i = 0; i < methods.length; i++) (function(method) {
			target[method] = function () {
				tail = target._getTail()[method].apply(tail, arguments);
				return target;
			}
		})(methods[i]);
		target.cancel = target.cancel || function() {
			d.cancel();
		}
		target._id = d._id;
		return target;
	},

	cancel : function () {
		(this.canceller || function () {})();
		return this.init();
	},

	_post : function (okng, fun) {
		this._next =  new Deferred();
		this._next.callback[okng] = fun;
		return this._next;
	},

	_fire : function (okng, value) {
		var next = "ok";
		try {
			value = this.callback[okng].call(this, value);
		} catch (e) {
			next  = "ng";
			value = e;
			if (Deferred.onerror) Deferred.onerror(e);
		}
		if (Deferred.isDeferred(value)) {
			if (value.hasOwnProperty('next')) {
				value._getTail()._next = this._next;
			} else {
				value._next = this._next;
			}
		} else {
			if (this._next) this._next._fire(next, value);
		}
		return this;
	}
};
Deferred.isDeferred = function (obj) {
	return !!(obj && obj._id == Deferred.prototype._id);
};

Deferred.next_default = function (fun) {
	var d = new Deferred();
	var id = setTimeout(function () { d.call() }, 0);
	d.canceller = function () { clearTimeout(id) };
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next_faster_way_readystatechange = ((typeof window === 'object') && (location.protocol == "http:") && !window.opera && /\bMSIE\b/.test(navigator.userAgent)) && function (fun) {
	var d = new Deferred();
	var t = Date.now();
	if (t - arguments.callee._prev_timeout_called < 150) {
		var cancel = false;
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src  = "data:text/javascript,";
		script.onreadystatechange = function () {
			if (!cancel) {
				d.canceller();
				d.call();
			}
		};
		d.canceller = function () {
			if (!cancel) {
				cancel = true;
				script.onreadystatechange = null;
				document.body.removeChild(script);
			}
		};
		document.body.appendChild(script);
	} else {
		arguments.callee._prev_timeout_called = t;
		var id = setTimeout(function () { d.call() }, 0);
		d.canceller = function () { clearTimeout(id) };
	}
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next_faster_way_Image = ((typeof window === 'object') && (typeof(Image) != "undefined") && !window.opera && document.addEventListener) && function (fun) {
	var d = new Deferred();
	var img = new Image();
	var handler = function () {
		d.canceller();
		d.call();
	};
	img.addEventListener("load", handler, false);
	img.addEventListener("error", handler, false);
	d.canceller = function () {
		img.removeEventListener("load", handler, false);
		img.removeEventListener("error", handler, false);
	};
	img.src = "data:image/png," + Math.random();
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next_tick = (typeof process === 'object' && typeof process.nextTick === 'function') && function (fun) {
	var d = new Deferred();
	process.nextTick(function() { d.call() });
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next = Deferred.next_faster_way_readystatechange ||
                Deferred.next_faster_way_Image ||
                Deferred.next_tick ||
                Deferred.next_default;

Deferred.chain = function () {
	var chain = Deferred.next();
	for (var i = 0, len = arguments.length; i < len; i++) (function (obj) {
		switch (typeof obj) {
			case "function":
				var name = null;
				try {
					name = obj.toString().match(/^\s*function\s+([^\s()]+)/)[1];
				} catch (e) { }
				if (name != "error") {
					chain = chain.next(obj);
				} else {
					chain = chain.error(obj);
				}
				break;
			case "object":
				chain = chain.next(function() { return Deferred.parallel(obj) });
				break;
			default:
				throw "unknown type in process chains";
		}
	})(arguments[i]);
	return chain;
};

Deferred.wait = function (n) {
	var d = new Deferred(), t = Date.now();
	var id = setTimeout(function () {
		d.call(Date.now() - t);
	}, n * 1000);
	d.canceller = function () { clearTimeout(id) };
	return d;
};

Deferred.call = function (fun) {
	var args = Array.prototype.slice.call(arguments, 1);
	return Deferred.next(function () {
		return fun.apply(this, args);
	});
};

Deferred.parallel = function (dl) {
	if (arguments.length > 1) dl = Array.prototype.slice.call(arguments);
	var ret = new Deferred(), values = {}, num = 0;
	for (var i in dl) if (dl.hasOwnProperty(i)) (function (d, i) {
		if (typeof d == "function") d = Deferred.next(d);
		d.next(function (v) {
			values[i] = v;
			if (--num <= 0) {
				if (dl instanceof Array) {
					values.length = dl.length;
					values = Array.prototype.slice.call(values, 0);
				}
				ret.call(values);
			}
		}).error(function (e) {
			ret.fail(e);
		});
		num++;
	})(dl[i], i);

	if (!num) Deferred.next(function () { ret.call() });
	ret.canceller = function () {
		for (var i in dl) if (dl.hasOwnProperty(i)) {
			dl[i].cancel();
		}
	};
	return ret;
};

Deferred.earlier = function (dl) {
	if (arguments.length > 1) dl = Array.prototype.slice.call(arguments);
	var ret = new Deferred(), values = {}, num = 0;
	for (var i in dl) if (dl.hasOwnProperty(i)) (function (d, i) {
		d.next(function (v) {
			values[i] = v;
			if (dl instanceof Array) {
				values.length = dl.length;
				values = Array.prototype.slice.call(values, 0);
			}
			ret.canceller();
			ret.call(values);
		}).error(function (e) {
			ret.fail(e);
		});
		num++;
	})(dl[i], i);

	if (!num) Deferred.next(function () { ret.call() });
	ret.canceller = function () {
		for (var i in dl) if (dl.hasOwnProperty(i)) {
			dl[i].cancel();
		}
	};
	return ret;
};

Deferred.loop = function (n, fun) {
	var o = {
		begin : n.begin || 0,
		end   : (typeof n.end == "number") ? n.end : n - 1,
		step  : n.step  || 1,
		last  : false,
		prev  : null
	};
	var ret, step = o.step;
	return Deferred.next(function () {
		function _loop (i) {
			if (i <= o.end) {
				if ((i + step) > o.end) {
					o.last = true;
					o.step = o.end - i + 1;
				}
				o.prev = ret;
				ret = fun.call(this, i, o);
				if (Deferred.isDeferred(ret)) {
					return ret.next(function (r) {
						ret = r;
						return Deferred.call(_loop, i + step);
					});
				} else {
					return Deferred.call(_loop, i + step);
				}
			} else {
				return ret;
			}
		}
		return (o.begin <= o.end) ? Deferred.call(_loop, o.begin) : null;
	});
};

Deferred.repeat = function (n, fun) {
	var i = 0, end = {}, ret = null;
	return Deferred.next(function () {
		var t = Date.now();
		do {
			if (i >= n) return null;
			ret = fun(i++);
		} while (Date.now() - t < 20);
		return Deferred.call(arguments.callee);
	});
};

Deferred.register = function (name, fun) {
	this.prototype[name] = function () {
		var a = arguments;
		return this.next(function () {
			return fun.apply(this, a);
		});
	};
};

Deferred.register("loop", Deferred.loop);
Deferred.register("wait", Deferred.wait);

Deferred.connect = function (funo, options) {
	var target, func, obj;
	if (typeof arguments[1] == "string") {
		target = arguments[0];
		func   = target[arguments[1]];
		obj    = arguments[2] || {};
	} else {
		func   = arguments[0];
		obj    = arguments[1] || {};
		target = obj.target;
	}

	var partialArgs       = obj.args ? Array.prototype.slice.call(obj.args, 0) : [];
	var callbackArgIndex  = isFinite(obj.ok) ? obj.ok : obj.args ? obj.args.length : undefined;
	var errorbackArgIndex = obj.ng;

	return function () {
		var d = new Deferred().next(function (args) {
			var next = this._next.callback.ok;
			this._next.callback.ok = function () {
				return next.apply(this, args.args);
			};
		});

		var args = partialArgs.concat(Array.prototype.slice.call(arguments, 0));
		if (!(isFinite(callbackArgIndex) && callbackArgIndex !== null)) {
			callbackArgIndex = args.length;
		}
		var callback = function () { d.call(new Deferred.Arguments(arguments)) };
		args.splice(callbackArgIndex, 0, callback);
		if (isFinite(errorbackArgIndex) && errorbackArgIndex !== null) {
			var errorback = function () { d.fail(arguments) };
			args.splice(errorbackArgIndex, 0, errorback);
		}
		Deferred.next(function () { func.apply(target, args) });
		return d;
	}
};
Deferred.Arguments = function (args) { this.args = Array.prototype.slice.call(args, 0) };

Deferred.retry = function (retryCount, funcDeferred, options) {
	if (!options) options = {};

	var wait = options.wait || 0;
	var d = new Deferred();
	var retry = function () {
		var m = funcDeferred(retryCount);
		m.
			next(function (mes) {
				d.call(mes);
			}).
			error(function (e) {
				if (--retryCount <= 0) {
					d.fail(['retry failed', e]);
				} else {
					setTimeout(retry, wait * 1000);
				}
			});
	};
	setTimeout(retry, 0);
	return d;
};

Deferred.Queue = function (auto_abort) {
	var queue = [];
	var current;
	var running = false;
	function call() {
		current = queue.shift();
		if (Deferred.isDeferred(current)) {
			current = (function() {
				setTimeout(current.call, 0);
				return current.promise;
			})();
		}
		current().
		always(function() {
			if (queue.length) call();
			else running = false;
		});
	};
	return function(task) {
		auto_abort ? (queue = [task]) : queue.push(task);
		if (! running) {
			running = true;
			setTimeout(call, 0);
		} else if (auto_abort && current) {
			try {
				current.cancel();
			} catch (e) { }
		}
	};
};
Deferred.methods = ["parallel", "wait", "next", "call", "loop", "repeat", "chain"];
Deferred.promiseMethods = ["parallel", "wait", "stop", "next", "error", "always", "hold", "loop"];
Deferred.define = function (obj, list) {
	if (!list) list = Deferred.methods;
	if (!obj)  obj  = (function getGlobal () { return this })();
	for (var i = 0; i < list.length; i++) {
		var n = list[i];
		obj[n] = Deferred[n];
	}
	return Deferred;
};

this.Deferred = this.Ripple.Deferred = Deferred;


/*
File: Math.uuid.js
Version: 1.3
Change History:
v1.0 - first release
v1.1 - less code and 2x performance boost (by minimizing calls to Math.random())
v1.2 - Add support for generating non-standard uuids of arbitrary length
v1.3 - Fixed IE7 bug (can't use []'s to access string chars.  Thanks, Brian R.)
v1.4 - Changed method to be "Math.uuid". Added support for radix argument.  Use module pattern for better encapsulation.

Latest version:   http://www.broofa.com/Tools/Math.uuid.js
Information:      http://www.broofa.com/blog/?p=151
Contact:          robert@broofa.com
----
Copyright (c) 2008, Robert Kieffer
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * Neither the name of Robert Kieffer nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   '92329D39-6F5C-4520-ABFC-AAB64544E172'
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   'VcydxgltxrVZSTV'
 *
 *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   '01001010'
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   '47473046'
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   '098F4D35'
 * @member Ripple.helpers
 * @function
 */
Ripple.helpers.UUID = (function() {
	// Private array of chars to use
	var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

	return function(len, radix) {
		var chars = CHARS,
		uuid = [],
		rnd = Math.random;
		radix = radix || chars.length;

		if (len) {
			// Compact form
			for (var i = 0; i < len; i++)
				uuid[i] = chars[0 | rnd() * radix];
		} else {
			// rfc4122, version 4 form
			var r;

			// rfc4122 requires these characters
			uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
			uuid[14] = '4';

			// Fill in random data.	At i==19 set the high bits of clock sequence as
			// per rfc4122, sec. 4.1.5
			for (var i = 0; i < 36; i++) {
				if (! uuid[i]) {
					r = 0 | rnd() * 16;
					uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
				}
			}
		}

		return uuid.join('');
	};
})();


/**
 * Checks if the given value is an RFC 4122 UUID
 * @member Ripple.helpers
 */
Ripple.helpers.isUUID = function(val) {
	return val.match(/^[0-9A-Z]{8}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{12}$/);
};
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;	/* hex output format. 0 - lowercase; 1 - uppercase				*/
var b64pad	= ''; /* base-64 pad character. '=' for strict RFC compliance	 */
var chrsz	 = 8;	/* bits per input character. 8 - ASCII; 16 - Unicode			*/

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s) { return binb2hex(core_sha1(str2binb(s),s.length * chrsz)); }
function b64_sha1(s) { return binb2b64(core_sha1(str2binb(s),s.length * chrsz)); }
function str_sha1(s) { return binb2str(core_sha1(str2binb(s),s.length * chrsz)); }
function hex_hmac_sha1(key, data) { return binb2hex(core_hmac_sha1(key, data)); }
function b64_hmac_sha1(key, data) { return binb2b64(core_hmac_sha1(key, data)); }
function str_hmac_sha1(key, data) { return binb2str(core_hmac_sha1(key, data)); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test() {
	return hex_sha1('abc') == 'a9993e364706816aba3e25717850c26c9cd0d89d';
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len) {
	/* append padding */
	x[len >> 5] |= 0x80 << (24 - len % 32);
	x[((len + 64 >> 9) << 4) + 15] = len;

	var w = Array(80);
	var a =	1732584193;
	var b = -271733879;
	var c = -1732584194;
	var d =	271733878;
	var e = -1009589776;

	for(var i = 0; i < x.length; i += 16) {
		var olda = a;
		var oldb = b;
		var oldc = c;
		var oldd = d;
		var olde = e;

		for(var j = 0; j < 80; j++) {
			if(j < 16) w[j] = x[i + j];
			else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
			var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
											 safe_add(safe_add(e, w[j]), sha1_kt(j)));
			e = d;
			d = c;
			c = rol(b, 30);
			b = a;
			a = t;
		}

		a = safe_add(a, olda);
		b = safe_add(b, oldb);
		c = safe_add(c, oldc);
		d = safe_add(d, oldd);
		e = safe_add(e, olde);
	}
	return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d) {
	if(t < 20) return (b & c) | ((~b) & d);
	if(t < 40) return b ^ c ^ d;
	if(t < 60) return (b & c) | (b & d) | (c & d);
	return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t) {
	return (t < 20) ?	1518500249 : (t < 40) ?	1859775393 :
				 (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data) {
	var bkey = str2binb(key);
	if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

	var ipad = Array(16), opad = Array(16);
	for(var i = 0; i < 16; i++) {
		ipad[i] = bkey[i] ^ 0x36363636;
		opad[i] = bkey[i] ^ 0x5C5C5C5C;
	}

	var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
	return core_sha1(opad.concat(hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y) {
	var lsw = (x & 0xFFFF) + (y & 0xFFFF);
	var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
	return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt) {
	return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str) {
	var bin = Array();
	var mask = (1 << chrsz) - 1;
	for(var i = 0; i < str.length * chrsz; i += chrsz)
		bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
	return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str(bin) {
	var str = '';
	var mask = (1 << chrsz) - 1;
	for(var i = 0; i < bin.length * 32; i += chrsz)
		str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
	return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray) {
	var hex_tab = hexcase ? '0123456789ABCDEF' : '0123456789abcdef';
	var str = '';
	for(var i = 0; i < binarray.length * 4; i++) {
		str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
					 hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8	)) & 0xF);
	}
	return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray) {
	var tab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	var str = '';
	for(var i = 0; i < binarray.length * 4; i += 3) {
		var triplet = (((binarray[i	 >> 2] >> 8 * (3 -	i	 %4)) & 0xFF) << 16)
								| (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
								|	((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
		for(var j = 0; j < 4; j++) {
			if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
			else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
		}
	}
	return str;
}

/*
 * Cookies
 * from http://www.quirksmode.org/js/cookies.html
 */
Ripple.helpers.readCookie = function(name) {
	var name_eq = name + '=';
	var ca = document.cookie.split(';');
	for (var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) == ' ')
			c = c.substring(1, c.length);
		if (c.indexOf(name_eq) == 0)
			return c.substring(name_eq.length, c.length);
	}
	return null;
}

Ripple.helpers.createCookie = function(name, value, days) {
	var expires = '';
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		var expires = '; expires=' + date.toGMTString();
	}
	document.cookie = name + '=' + value + expires + '; path=/';
}

Ripple.helpers.eraseCookie = function(name) {
	Ripple.helpers.createCookie(name, '', -1);
}


Ripple.helpers.getUserIdFromCookies = function() {
	return Ripple.helpers.readCookie('u');
}


Ripple.helpers.isExist = function(url) {
	if (! url) return false;

	var xhr = new XMLHttpRequest;
	xhr.open('HEAD', url, false);

	try {
		xhr.send(null);
	}
	catch (e) {
		return false;
	}

	return xhr.status != null &&
		xhr.status >= 200 &&
		xhr.status < 300;
}

Ripple.helpers.isOnline = function() {
	return Ripple.helpers.isExist('http://m.fanfou.com/?' + Date.now());
}



Ripple.helpers.loadImage = function(url) {
	var d = new Ripple.Deferred();
	var img = new Image();
	img.src = url;
	if (img.complete) {
		// 图片已被缓存
		setTimeout(function() {
			d.call(img);
		}, 0);
	} else {
		img.onload = function() {
			d.call(img);
		}
		img.onerror = function(e) {
			d.fail(e);
		}
	}
	return d;
}


Ripple.helpers.image2canvas = function(img) {
	return Ripple.Deferred.next(function() {
		try {
			var canvas = document.createElement('canvas');
			var w = img.naturalWidth || img.width;
			var h = img.naturalHeight || img.height;
			canvas.width = w;
			canvas.height = h;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, w, h);
			return canvas;
		} catch (e) {
			throw img.url;
		}
	});
}

Ripple.helpers.buildPhotoBlob = function(object) {
	return Ripple.Deferred.next(function() {
			if (Ripple.helpers.isString(object)) {
				return Ripple.helpers.loadImage(object);
			}
			return object;
		}).
		next(function(img) {
			return Ripple.helpers.image2canvas(img);
		}).
		next(function(canvas) {
			var d = new Ripple.Deferred();
			var timeout = setTimeout(function() {
				d.fail(object);
			}, 5000);
			Ripple.Deferred.next(function() {
				canvas.toBlob(function(blob) {
					clearTimeout(timeout);
					d.call(blob);
				});
			});
			return d;
		});
}

/*
 * 时间转换器类
 * 根据参数, 生成可以把时间转换为特定格式的函数.
 * 同时会自动修复服务器和本地的时间差.
 *
 * @author 锐风(Lacc Riophae) http://fanfou.com/ruif
 * @version 0.1.0
 * @license the MIT license
 */
Ripple.helpers.generateTimeFormater = function(func) {
	var timetable = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		wk: 7 * 24 * 60 * 60 * 1000,
		ms: 30 * 24 * 60 * 60 * 1000,
		yr: 365 * 24 * 60 * 60 * 1000
	};
	var month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	var week = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	var tail = [];
	tail[1] = tail[21] = tail[31] = 'st';
	tail[2] = tail[22] = 'nd';
	tail[3] = 'rd';
	// 其他全部为 'th' 结尾

	var options = func(timetable); // func 会利用 timetable 返回根据时间范围规定的转换方法数组
	var common_handler = function() {
		// 缺省的方法
		return date;
	}
	if (Ripple.helpers.isFunction(options[options.length-1])) {
		// 当数组最后一项为函数时
		// 将会在不匹配任何时间范围时使用这个函数作为转换方法
		common_handler = options.pop();
	}
	var len = options.length;

	// 将数字补充至指定位数
	function complete(num, len) {
		num = num + '';
		if (len < 1) return num;
		while (num.length < len) {
			num = '0' + num;
		}
		return num;
	}

	// 将数字转换为序数
	function order(num) {
		num = num + '';
		num += tail[num] || 'th';
		return num;
	}

	var date, delta;
	var _date, _delta;

	var convertors = {
		_s: function(length) {
			// 原始秒数
			return complete(_date().getSeconds(), length);
		},
		S: function(length) {
			// 相差的总秒数
			return complete(Math.floor(delta / timetable.s), length);
		},
		s: function(length) {
			// 若干秒前(<60)
			return complete(_delta().getSeconds(), length);
		},
		_m: function(length) {
			// 原始分钟数
			return complete(_date().getMinutes(), length);
		},
		M: function(length) {
			// 相差的总分钟数
			return complete(Math.floor(delta / timetable.m), length);
		},
		m: function(length) {
			// 若干分钟前(<60)
			return complete(_delta().getUTCMinutes(), length);
		},
		_h: function(length) {
			// 原始小时数
			return complete(_date().getHours(), length);
		},
		H: function(length) {
			// 相差的总小时数
			return complete(Math.floor(delta / timetable.h), length);
		},
		h: function(length) {
			// 若干小时前(<24)
			return complete(_delta().getUTCHours(), length);
		},
		_d: function(length) {
			// 原始天数
			var d = _date().getDate();
			return length === true ?
				order(d) : complete(d, length);
		},
		D: function(length) {
			// 相差的总天数
			return complete(Math.floor(delta / timetable.d), length);
		},
		d: function(length) {
			// 若干天前(<31)
			return complete(_delta().getUTCDate() - 1, length);
		},
		_wk: function(length) {
			// 原始星期(英文)
			var wk = week[_date().getDay()];
			return length ? wk.slice(0, length) : wk;
		},
		WK: function(length) {
			// 相差的总星期数
			return complete(Math.floor(delta / timetable.wk), length);
		},
		_MS: function(length) {
			// 原始月份(英文)
			var MS = month[_date().getMonth()];
			return length ? MS.slice(0, length) : MS;
		},
		_ms: function(length) {
			// 原始月份(数字)
			return complete(_date().getMonth() + 1, length);
		},
		MS: function(length) {
			// 相差的总月数
			return complete(Math.floor(delta / timetable.ms), length);
		},
		ms: function(length) {
			// 若干月前(<12)
			return complete(_delta().getUTCMonth(), length);
		},
		_yr: function() {
			// 原始年份
			return _date().getFullYear();
		},
		YR: function(length) {
			// 相差的总年数
			return complete(_delta().getUTCFullYear() - 1970, length);
		}
	};

	return function() {
		date = arguments[0];
		// 修复服务器与本地的时间差
		var now = Date.now() + Ripple.OAuth.timeCorrectionMsec;
		delta = now - Date.parse(date);

		// 使用懒惰计算(缓存结果)
		_delta = function() {
			var __delta = new Date();
			__delta.setTime(delta);
			_delta = function() {
				return __delta;
			}
			return __delta;
		}
		_date = function() {
			var __date = new Date(date);
			_date = function() {
				return __date;
			}
			return __date;
		}

		for (var i = 0; i < len; i++) {
			if (delta < options[i][0]) {
				return options[i][1](convertors);
			}
		}
		return common_handler(convertors);
	}
}



/**
 * lscache library
 * Copyright (c) 2011, Pamela Fox
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *			 http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Creates a namespace for the lscache functions.
 */
;;;(function(Global) {
var lscache = Ripple.cache = function() {

	// Prefix for all lscache keys
	var CACHE_PREFIX = 'lscache-';

	// Suffix for the key name on the expiration items in localStorage
	var CACHE_SUFFIX = '-cacheexpiration';

	// expiration date radix (set to Base-36 for most space savings)
	var EXPIRY_RADIX = 10;

	// time resolution in minutes
	var EXPIRY_UNITS = 60 * 1000;

	// ECMAScript max Date (epoch + 1e8 days)
	var MAX_DATE = Math.floor(8.64e15/EXPIRY_UNITS);

	var cachedStorage;
	var cachedJSON;

	// Determines if localStorage is supported in the browser;
	// result is cached for better performance instead of being run each time.
	// Feature detection is based on how Modernizr does it;
	// it's not straightforward due to FF4 issues.
	// It's not run at parse-time as it takes 200ms in Android.
	function supportsStorage() {
		var key = '__lscachetest__';
		var value = key;

		if (cachedStorage !== undefined) {
			return cachedStorage;
		}

		try {
			setItem(key, value);
			removeItem(key);
			cachedStorage = true;
		} catch (exc) {
			cachedStorage = false;
		}
		return cachedStorage;
	}

	// Determines if native JSON (de-)serialization is supported in the browser.
	function supportsJSON() {
		/*jshint eqnull:true */
		if (cachedJSON === undefined) {
			cachedJSON = (window.JSON != null);
		}
		return cachedJSON;
	}

	/**
	 * Returns the full string for the localStorage expiration item.
	 * @param {String} key
	 * @return {string}
	 */
	function expirationKey(key) {
		return key + CACHE_SUFFIX;
	}

	/**
	 * Returns the number of minutes since the epoch.
	 * @return {number}
	 */
	function currentTime() {
		return Math.floor(Date.now()/EXPIRY_UNITS);
	}

	/**
	 * Wrapper functions for localStorage methods
	 */

	function getItem(key) {
		return localStorage.getItem(CACHE_PREFIX + key);
	}

	function setItem(key, value) {
		// Fix for iPad issue - sometimes throws QUOTA_EXCEEDED_ERR on setItem.
		localStorage.removeItem(CACHE_PREFIX + key);
		localStorage.setItem(CACHE_PREFIX + key, value);
	}

	function removeItem(key) {
		localStorage.removeItem(CACHE_PREFIX + key);
	}

	return {

		/**
		 * Stores the value in localStorage. Expires after specified number of minutes.
		 * @param {string} key
		 * @param {Object|string} value
		 * @param {number} time
		 */
		set: function(key, value, time) {
			if (!supportsStorage()) return;

			// If we don't get a string value, try to stringify
			// In future, localStorage may properly support storing non-strings
			// and this can be removed.
			if (typeof value !== 'string') {
				if (!supportsJSON()) return;
				try {
					value = JSON.stringify(value);
				} catch (e) {
					// Sometimes we can't stringify due to circular refs
					// in complex objects, so we won't bother storing then.
					return;
				}
			}

			try {
				setItem(key, value);
			} catch (e) {
				if (e.name === 'QUOTA_EXCEEDED_ERR' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
					// If we exceeded the quota, then we will sort
					// by the expire time, and then remove the N oldest
					var storedKeys = [];
					var storedKey;
					for (var i = 0; i < localStorage.length; i++) {
						storedKey = localStorage.key(i);

						if (storedKey.indexOf(CACHE_PREFIX) === 0 && storedKey.indexOf(CACHE_SUFFIX) < 0) {
							var mainKey = storedKey.substr(CACHE_PREFIX.length);
							var exprKey = expirationKey(mainKey);
							var expiration = getItem(exprKey);
							if (expiration) {
								expiration = parseInt(expiration, EXPIRY_RADIX);
							} else {
								// TODO: Store date added for non-expiring items for smarter removal
								expiration = MAX_DATE;
							}
							storedKeys.push({
								key: mainKey,
								size: (getItem(mainKey)||'').length,
								expiration: expiration
							});
						}
					}
					// Sorts the keys with oldest expiration time last
					storedKeys.sort(function(a, b) { return (b.expiration-a.expiration); });

					var targetSize = (value||'').length;
					while (storedKeys.length && targetSize > 0) {
						storedKey = storedKeys.pop();
						removeItem(storedKey.key);
						removeItem(expirationKey(storedKey.key));
						targetSize -= storedKey.size;
					}
					try {
						setItem(key, value);
					} catch (e) {
						// value may be larger than total quota
						return;
					}
				} else {
					// If it was some other error, just give up.
					return;
				}
			}

			// If a time is specified, store expiration info in localStorage
			if (time) {
				setItem(expirationKey(key), (currentTime() + time).toString(EXPIRY_RADIX));
			} else {
				// In case they previously set a time, remove that info from localStorage.
				removeItem(expirationKey(key));
			}
		},

		/**
		 * Retrieves specified value from localStorage, if not expired.
		 * @param {string} key
		 * @return {string|Object}
		 */
		get: function(key) {
			if (!supportsStorage()) return null;

			// Return the de-serialized item if not expired
			var exprKey = expirationKey(key);
			var expr = getItem(exprKey);

			if (expr) {
				var expirationTime = parseInt(expr, EXPIRY_RADIX);

				// Check if we should actually kick item out of storage
				if (currentTime() >= expirationTime) {
					removeItem(key);
					removeItem(exprKey);
					return null;
				}
			}

			// Tries to de-serialize stored value if its an object, and returns the normal value otherwise.
			var value = getItem(key);
			if (!value || !supportsJSON()) {
				return value;
			}

			try {
				// We can't tell if its JSON or a string, so we try to parse
				return JSON.parse(value);
			} catch (e) {
				// If we can't parse, it's probably because it isn't an object
				return value;
			}
		},

		/**
		 * Removes a value from localStorage.
		 * Equivalent to 'delete' in memcache, but that's a keyword in JS.
		 * @param {string} key
		 */
		remove: function(key) {
			if (!supportsStorage()) return null;
			removeItem(key);
			removeItem(expirationKey(key));
		},

		/**
		 * Returns whether local storage is supported.
		 * Currently exposed for testing purposes.
		 * @return {boolean}
		 */
		supported: function() {
			return supportsStorage();
		},

		/**
		 * Flushes all lscache items and expiry markers without affecting rest of localStorage
		 */
		flush: function() {
			if (!supportsStorage()) return;

			// Loop in reverse as removing items will change indices of tail
			for (var i = localStorage.length-1; i >= 0 ; --i) {
				var key = localStorage.key(i);
				if (key.indexOf(CACHE_PREFIX) === 0) {
					localStorage.removeItem(key);
				}
			}
		}
	};
}();

if (Global.lscache === undefined) {
	Global.lscache = lscache;
}
})(this);


/*
 * Copyright 2008 Netflix, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Here's some JavaScript software for implementing OAuth.

   This isn't as useful as you might hope.  OAuth is based around
   allowing tools and websites to talk to each other.  However,
   JavaScript running in web browsers is hampered by security
   restrictions that prevent code running on one website from
   accessing data stored or served on another.

   Before you start hacking, make sure you understand the limitations
   posed by cross-domain XMLHttpRequest.

   On the bright side, some platforms use JavaScript as their
   language, but enable the programmer to access other web sites.
   Examples include Google Gadgets, and Microsoft Vista Sidebar.
   For those platforms, this library should come in handy.
*/

// The HMAC-SHA1 signature method calls b64_hmac_sha1, defined by
// http://pajhome.org.uk/crypt/md5/sha1.js

/* An OAuth message is represented as an object like this:
   {method: "GET", action: "http://server.com/path", parameters: ...}

   The parameters may be either a map {name: value, name2: value2}
   or an Array of name-value pairs [[name, value], [name2, value2]].
   The latter representation is more powerful: it supports parameters
   in a specific sequence, or several parameters with the same name;
   for example [["a", 1], ["b", 2], ["a", 3]].

   Parameter names and values are NOT percent-encoded in an object.
   They must be encoded before transmission and decoded after reception.
   For example, this message object:
   {method: "GET", action: "http://server/path", parameters: {p: "x y"}}
   ... can be transmitted as an HTTP request that begins:
   GET /path?p=x%20y HTTP/1.0
   (This isn't a valid OAuth request, since it lacks a signature etc.)
   Note that the object "x y" is transmitted as x%20y.  To encode
   parameters, you can call OAuth.addToURL, OAuth.formEncode or
   OAuth.getAuthorization.

   This message object model harmonizes with the browser object model for
   input elements of an form, whose value property isn't percent encoded.
   The browser encodes each value before transmitting it. For example,
   see consumer.setInputs in example/consumer.js.
 */

/* This script needs to know what time it is. By default, it uses the local
   clock (new Date), which is apt to be inaccurate in browsers. To do
   better, you can load this script from a URL whose query string contains
   an oauth_timestamp parameter, whose value is a current Unix timestamp.
   For example, when generating the enclosing document using PHP:

   <script src="oauth.js?oauth_timestamp=<?=time()?>" ...

   Another option is to call OAuth.correctTimestamp with a Unix timestamp.
 */

;;;(function() {
var OAuth = Ripple.OAuth = {};

OAuth.setProperties = function(into, from) {
	if (into != null && from != null) {
		for (var key in from) {
			into[key] = from[key];
		}
	}
	return into;
}

// Utility Functions
OAuth.setProperties(OAuth, {
	percentEncode: function(s) {
		if (s == null) {
			return '';
		}
		if (s instanceof Array) {
			var e = '';
			for (var i = 0, len = s.length; i < len; i++) {
				if (e) e += '&';
				e += OAuth.percentEncode(s[i]);
			}
			return e;
		}
		s = encodeURIComponent(s);
		// Now replace the values which encodeURIComponent doesn't do
		// encodeURIComponent ignores: - _ . ! ~ * ' ( )
		// OAuth dictates the only ones you can ignore are: - _ . ~
		// Source: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Functions:encodeURIComponent
		s = s.replace(/\!/g, '%21')
				 .replace(/\*/g, '%2A')
				 .replace(/\'/g, '%27')
				 .replace(/\(/g, '%28')
				 .replace(/\)/g, '%29');
		return s;
	},
	decodePercent: function(s) {
		if (s) {
			// Handle application/x-www-form-urlencoded, which is defined by
			// http://www.w3.org/TR/html4/interact/forms.html#h-17.13.4.1
			s = s.replace(/\+/g, ' ');
		}
		return decodeURIComponent(s);
	},
	/** Convert the given parameters to an Array of name-value pairs. */
	getParameterList: function(parameters) {
		if (parameters == null) {
			return [];
		}
		if (typeof parameters != 'object') {
			return OAuth.decodeForm(parameters + '');
		}
		if (parameters instanceof Array) {
			return parameters;
		}
		var list = [];
		for (var p in parameters) {
			list.push([p, parameters[p]]);
		}
		return list;
	},
	/** Convert the given parameters to a map from name to value. */
	getParameterMap: function(parameters) {
		if (parameters == null) {
			return {};
		}
		if (typeof parameters != 'object') {
			return OAuth.getParameterMap(OAuth.decodeForm(parameters + ''));
		}
		if (parameters instanceof Array) {
			var map = {};
			for (var p = 0, len = parameters.length; p < len; ++p) {
				var key = parameters[p][0];
				if (map[key] === undefined) { // first value wins
					map[key] = parameters[p][1];
				}
			}
			return map;
		}
		return parameters;
	},
	getParameter: function(parameters, name) {
		if (parameters instanceof Array) {
			for (var p = 0, len = parameters.length; p < len; ++p) {
				if (parameters[p][0] == name) {
					return parameters[p][1]; // first value wins
				}
			}
		} else {
			return OAuth.getParameterMap(parameters)[name];
		}
		return null;
	},
	formEncode: function(parameters) {
		var form = '';
		var list = OAuth.getParameterList(parameters);
		for (var p = 0, len = list.length; p < len; ++p) {
			var value = list[p][1];
			if ([null, undefined].indexOf(value) > -1 || value !== value) value = '';
			if (form != '') form += '&';
			form += OAuth.percentEncode(list[p][0])
				+ '=' + OAuth.percentEncode(value);
		}
		return form;
	},
	decodeForm: function(form) {
		var list = [];
		var nvps = form.split('&');
		for (var n = 0, len = nvps.length; n < len; ++n) {
			var nvp = nvps[n];
			if (nvp == '') {
				continue;
			}
			var equals = nvp.indexOf('=');
			var name, value;
			if (equals < 0) {
				name = OAuth.decodePercent(nvp);
				value = null;
			} else {
				name = OAuth.decodePercent(nvp.substring(0, equals));
				value = OAuth.decodePercent(nvp.substring(equals + 1));
			}
			list.push([name, value]);
		}
		return list;
	},
	setParameter: function(message, name, value) {
		var parameters = message.parameters;
		if (parameters instanceof Array) {
			for (var p = 0; p < parameters.length; ++p) {
				if (parameters[p][0] == name) {
					if (value === undefined) {
						parameters.splice(p, 1);
					} else {
						parameters[p][1] = value;
						value = undefined;
					}
				}
			}
			if (value !== undefined) {
				parameters.push([name, value]);
			}
		} else {
			parameters = OAuth.getParameterMap(parameters);
			parameters[name] = value;
			message.parameters = parameters;
		}
	},
	setParameters: function(message, parameters) {
		var list = OAuth.getParameterList(parameters);
		for (var i = 0, len = list.length; i < len; ++i) {
			OAuth.setParameter(message, list[i][0], list[i][1]);
		}
	},
	/** Fill in parameters to help construct a request message.
		This function doesn't fill in every parameter.
		The accessor object should be like:
		{consumerKey:'foo', consumerSecret:'bar', accessorSecret:'nurn', token:'krelm', tokenSecret:'blah'}
		The accessorSecret property is optional.
	 */
	completeRequest: function(message, accessor) {
		message.method = message.method || 'GET';
		var map = OAuth.getParameterMap(message.parameters);
		if (! map.oauth_consumer_key) {
			OAuth.setParameter(message, 'oauth_consumer_key', accessor.consumerKey || '');
		}
		if (! map.oauth_token && accessor.token) {
			OAuth.setParameter(message, 'oauth_token', accessor.token);
		}
		if (! map.oauth_version) {
			OAuth.setParameter(message, 'oauth_version', '1.0');
		}
		if (! map.oauth_timestamp) {
			OAuth.setParameter(message, 'oauth_timestamp', OAuth.timestamp());
		}
		if (! map.oauth_nonce) {
			OAuth.setParameter(message, 'oauth_nonce', OAuth.nonce(6));
		}
		OAuth.SignatureMethod.sign(message, accessor);
	},
	setTimestampAndNonce: function(message) {
		OAuth.setParameter(message, 'oauth_timestamp', OAuth.timestamp());
		OAuth.setParameter(message, 'oauth_nonce', OAuth.nonce(6));
	},
	addToURL: function(url, parameters) {
		var newURL = url;
		if (parameters) {
			var toAdd = OAuth.formEncode(parameters);
			if (toAdd.length > 0) {
				newURL += url.indexOf('?') < 0 ? '?' : '&';
				newURL += toAdd;
			}
		}
		return newURL;
	},
	/** Construct the value of the Authorization header for an HTTP request. */
	getAuthorizationHeader: function(realm, parameters) {
		var header = 'OAuth realm="' + realm + '", ';
		var list = OAuth.getParameterList(parameters);
		var parameter, name;
		var toAdd = [];
		for (var p = 0, len = list.length; p < len; ++p) {
			parameter = list[p];
			name = parameter[0];
			if (name.indexOf('oauth_') == 0 || name.indexOf('x_auth_') == 0) {
				toAdd.push(OAuth.percentEncode(name) + '="' + OAuth.percentEncode(parameter[1]) + '"');
			}
		}
		header += toAdd.join(', ');
		return header;
	},
	/** Correct the time using a parameter from the URL from which the last script was loaded. */
	correctTimestampFromSrc: function(parameterName) {
		parameterName = parameterName || 'oauth_timestamp';
		var scripts = document.getElementsByTagName('script');
		if (scripts == null || ! scripts.length) return;
		var src = scripts[scripts.length-1].src;
		if (! src) return;
		var q = src.indexOf('?');
		if (q < 0) return;
		parameters = OAuth.getParameterMap(OAuth.decodeForm(src.substring(q+1)));
		var t = parameters[parameterName];
		if (! t) return;
		OAuth.correctTimestamp(t);
	},
	/** Generate timestamps starting with the given value. */
	correctTimestamp: function(timestamp, now) {
		now = now || new Date;
		OAuth.timeCorrectionMsec = (timestamp * 1000) - now.getTime();
	},
	/** The difference between the correct time and my clock. */
	timeCorrectionMsec: 0,
	timestamp: function timestamp() {
		var t = Date.now() + OAuth.timeCorrectionMsec;
		return Math.floor(t / 1000);
	},
	nonce: function(length) {
		var chars = OAuth.nonce.CHARS;
		var result = '';
		for (var i = 0; i < length; ++i) {
			var rnum = Math.floor(Math.random() * chars.length);
			result += chars.substring(rnum, rnum+1);
		}
		return result;
	}
});

OAuth.nonce.CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';

/** Define a constructor function,
	without causing trouble to anyone who was using it as a namespace.
	That is, if parent[name] already existed and had properties,
	copy those properties into the new constructor.
 */
OAuth.declareClass = function(parent, name, newConstructor) {
	var previous = parent[name];
	parent[name] = newConstructor;
	if (newConstructor != null && previous != null) {
		for (var key in previous) {
			if (key != 'prototype') {
				newConstructor[key] = previous[key];
			}
		}
	}
	return newConstructor;
}

/** An abstract algorithm for signing messages. */
OAuth.declareClass(OAuth, 'SignatureMethod', function() { });

// instance members
OAuth.setProperties(OAuth.SignatureMethod.prototype, {
	/** Add a signature to the message. */
	sign: function(message) {
		var baseString = OAuth.SignatureMethod.getBaseString(message);
		var signature = this.getSignature(baseString);
		OAuth.setParameter(message, 'oauth_signature', signature);
		return signature; // just in case someone's interested
	},
	/** Set the key string for signing. */
	initialize: function(name, accessor) {
		var consumerSecret;
		if (accessor.accessorSecret
			&& name.length > 9
			&& name.substring(name.length-9) == '-Accessor')
		{
			consumerSecret = accessor.accessorSecret;
		} else {
			consumerSecret = accessor.consumerSecret;
		}
		this.key = OAuth.percentEncode(consumerSecret)
			+ '&' + OAuth.percentEncode(accessor.tokenSecret);
	}
});

/* SignatureMethod expects an accessor object to be like this:
	 {tokenSecret: "lakjsdflkj...", consumerSecret: "QOUEWRI..", accessorSecret: "xcmvzc..."}
	 The accessorSecret property is optional.
 */
// Class members:
OAuth.setProperties(OAuth.SignatureMethod, {
	sign: function sign(message, accessor) {
		var name = OAuth.getParameterMap(message.parameters).oauth_signature_method;
		if (name == null || name == '') {
			name = 'HMAC-SHA1';
			OAuth.setParameter(message, 'oauth_signature_method', name);
		}
		OAuth.SignatureMethod.newMethod(name, accessor).sign(message);
	},
	/** Instantiate a SignatureMethod for the given method name. */
	newMethod: function(name, accessor) {
		var impl = OAuth.SignatureMethod.REGISTERED[name];
		if (impl) {
			var method = new impl();
			method.initialize(name, accessor);
			return method;
		}
		var err = new Error('signature_method_rejected');
		var acceptable = '';
		for (var r in OAuth.SignatureMethod.REGISTERED) {
			if (acceptable != '') acceptable += '&';
			acceptable += OAuth.percentEncode(r);
		}
		err.oauth_acceptable_signature_methods = acceptable;
		throw err;
	},
	/** A map from signature method name to constructor. */
	REGISTERED : {},
	/** Subsequently, the given constructor will be used for the named methods.
		The constructor will be called with no parameters.
		The resulting object should usually implement getSignature(baseString).
		You can easily define such a constructor by calling makeSubclass, below.
	 */
	registerMethodClass: function(names, classConstructor) {
		for (var n = 0, len = names.length; n < len; ++n) {
			OAuth.SignatureMethod.REGISTERED[names[n]] = classConstructor;
		}
	},
	/** Create a subclass of OAuth.SignatureMethod, with the given getSignature function. */
	makeSubclass: function(getSignatureFunction) {
		var superClass = OAuth.SignatureMethod;
		var subClass = function() {
			superClass.call(this);
		};
		subClass.prototype = new superClass();
		// Delete instance variables from prototype:
		// delete subclass.prototype... There aren't any.
		subClass.prototype.getSignature = getSignatureFunction;
		subClass.prototype.constructor = subClass;
		return subClass;
	},
	getBaseString: function(message) {
		var URL = message.action;
		var q = URL.indexOf('?');
		var parameters;
		if (q < 0) {
			parameters = message.parameters;
		} else {
			// Combine the URL query string with the other parameters:
			parameters = OAuth.decodeForm(URL.substring(q + 1));
			var toAdd = OAuth.getParameterList(message.parameters);
			for (var a = 0, len = toAdd.length; a < len; ++a) {
				parameters.push(toAdd[a]);
			}
		}
		return OAuth.percentEncode(message.method.toUpperCase())
			+ '&' + OAuth.percentEncode(OAuth.SignatureMethod.normalizeUrl(URL))
			+ '&' + OAuth.percentEncode(OAuth.SignatureMethod.normalizeParameters(parameters));
	},
	normalizeUrl: function(url) {
		var uri = OAuth.SignatureMethod.parseUri(url);
		var scheme = uri.protocol.toLowerCase();
		var authority = uri.authority.toLowerCase();
		var dropPort = (scheme == 'http' && uri.port == 80)
					|| (scheme == 'https' && uri.port == 443);
		if (dropPort) {
			// find the last : in the authority
			var index = authority.lastIndexOf(':');
			if (index >= 0) {
				authority = authority.substring(0, index);
			}
		}
		var path = uri.path;
		if (! path) {
			path = '/'; // conforms to RFC 2616 section 3.2.2
		}
		// we know that there is no query and no fragment here.
		return scheme + '://' + authority + path;
	},
	parseUri: function(str) {
		/* This function was adapted from parseUri 1.2.1
			 http://stevenlevithan.com/demo/parseuri/js/assets/parseuri.js
		 */
		var o = {
			key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
			parser: {
				strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@\/]*):?([^:@\/]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
			}
		};
		var m = o.parser.strict.exec(str);
		var uri = {};
		var i = 14;
		while (i--) {
			uri[o.key[i]] = m[i] || '';
		}
		return uri;
	},
	normalizeParameters: function(parameters) {
		if (parameters == null) {
			return '';
		}
		var list = OAuth.getParameterList(parameters);
		var sortable = [];
		for (var p = 0, len = list.length; p < len; ++p) {
			var nvp = list[p];
			if (nvp[0] != 'oauth_signature') {
				sortable.push([OAuth.percentEncode(nvp[0])
								+ ' ' // because it comes before any character that can appear in a percentEncoded string.
								+ OAuth.percentEncode(nvp[1])
								, nvp]);
			}
		}
		sortable.sort(function(a,b) {
			if (a[0] < b[0]) return -1;
			if (a[0] > b[0]) return 1;
			return 0;
		});
		var sorted = [];
		for (var s = 0, len = sortable.length; s < len; ++s) {
			sorted[sorted.length] = (sortable[s][1]);
		}
		return OAuth.formEncode(sorted);
	}
});

OAuth.SignatureMethod.registerMethodClass(
	['HMAC-SHA1', 'HMAC-SHA1-Accessor'],
	OAuth.SignatureMethod.makeSubclass(function(baseString) {
		b64pad = '=';
		var signature = b64_hmac_sha1(this.key, baseString);
		return signature;
	})
);

try {
	OAuth.correctTimestampFromSrc();
} catch(e) { }
})();


/* BlobBuilder.js
 * A complete BlobBuilder shim
 * By Eli Grey
 * License: MIT/X11
 *
 * Modified by Lacc Riophae @ 1/28/2013
 */
self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder ||
self.OBlobBuilder || self.MsBlobBuilder || (self.Blob ? (function(view) {
	var
	FakeBlobBuilder = function () {},
	FBB_proto = FakeBlobBuilder.prototype = [];
	FBB_proto.append = function (data) {
		this.push(data);
	};
	FBB_proto.getBlob = function (type) {
		if (!arguments.length) {
			type = "application/octet-stream";
		}
		return new Blob(this.slice.call(this, 0), { type: type });
	};
	FBB_proto.toString = function () {
		return "[object BlobBuilder]";
	};
	self.BlobBuilder = FakeBlobBuilder;
})(self) : (function (view) {
	"use strict";
	var
	get_class = function (object) {
		return Object.prototype.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
	},
	FakeBlobBuilder = view.BlobBuilder = function () {},
	FakeBlob = view.Blob = function (data, type) {
		this.data = data;
		this.size = data.length;
		this.type = type;
	},
	FBB_proto = FakeBlobBuilder.prototype = [],
	FB_proto = FakeBlob.prototype,
	FileReaderSync = view.FileReaderSync,
	FileException = function (type) {
		this.code = this[this.name = type];
	},
	file_ex_codes = (
		"NOT_FOUND_ERR SECURITY_ERR ABORT_ERR NOT_READABLE_ERR ENCODING_ERR "
		 + "NO_MODIFICATION_ALLOWED_ERR INVALID_STATE_ERR SYNTAX_ERR").split(" "),
	file_ex_code = file_ex_codes.length,
	URL = view.URL = view.URL || view.webkitURL || view,
	real_create_object_url,
	real_revoke_object_url,
	btoa = view.btoa,
	ArrayBuffer = view.ArrayBuffer,
	can_apply_typed_arrays = false,
	can_apply_typed_arrays_test = function (pass) {
		can_apply_typed_arrays = !pass;
	};
	while (file_ex_code--) {
		FileException.prototype[file_ex_codes[file_ex_code]] = file_ex_code + 1;
	}
	try {
		if (ArrayBuffer) {
			can_apply_typed_arrays_test.apply(0, new Uint8Array(1));
		}
	} catch (ex) {}
	if (!URL.createObjectURL) {
		URL = {};
	}
	real_create_object_url = URL.createObjectURL;
	real_revoke_object_url = URL.revokeObjectURL;
	URL.createObjectURL = function (blob) {
		var type = blob.type;
		if (type === null) {
			type = "application/octet-stream";
		}
		if (blob instanceof FakeBlob) {
			if (btoa) {
				return "data:" + type + ";base64," + btoa(blob.data);
			} else {
				return "data:" + type + "," + encodeURIComponent(blob.data);
			}
		} else if (real_create_object_url) {
			return real_create_object_url.call(URL, blob);
		}
	};
	URL.revokeObjectURL = function (object_url) {
		if (object_url.substring(0, 5) !== "data:" && real_revoke_object_url) {
			real_revoke_object_url.call(URL, object_url);
		}
	};
	FBB_proto.append = function (data /*, endings*/
	) {
		var bb = this;
		// decode data to a binary string
		if (ArrayBuffer && data instanceof ArrayBuffer) {
			if (can_apply_typed_arrays) {
				bb.push(String.fromCharCode.apply(String, new Uint8Array(data)));
			} else {
				var
				str = "",
				buf = new Uint8Array(data),
				i = 0,
				buf_len = buf.length;
				for (; i < buf_len; i++) {
					str += String.fromCharCode(buf[i]);
				}
			}
		} else if (get_class(data) === "Blob" || get_class(data) === "File") {
			if (FileReaderSync) {
				var fr = new FileReaderSync;
				bb.push(fr.readAsBinaryString(data));
			} else {
				// async FileReader won't work as BlobBuilder is sync
				throw new FileException("NOT_READABLE_ERR");
			}
		} else if (data instanceof FakeBlob) {
			bb.push(data.data);
		} else {
			if (typeof data !== "string") {
				data += ""; // convert unsupported types to strings
			}
			// decode UTF-16 to binary string
			bb.push(unescape(encodeURIComponent(data)));
		}
	};
	FBB_proto.getBlob = function (type) {
		if (!arguments.length) {
			type = null;
		}
		return new FakeBlob(this.join(""), type);
	};
	FBB_proto.toString = function () {
		return "[object BlobBuilder]";
	};
	FB_proto.slice = function (start, end, type) {
		var args = arguments.length;
		if (args < 3) {
			type = null;
		}
		return new FakeBlob(
			this.data.slice(start, args > 1 ? end : this.data.length), type);
	};
	FB_proto.toString = function () {
		return "[object Blob]";
	};
	return FakeBlobBuilder;
})(self));


/* canvas-toBlob.js
 * A canvas.toBlob() implementation.
 * 2011-07-13
 *
 * By Eli Grey, http://eligrey.com and Devin Samarin, https://github.com/eboyjr
 * License: X11/MIT
 *	 See LICENSE.md
 */

/*! @source http://purl.eligrey.com/github/canvas-toBlob.js/blob/master/canvas-toBlob.js */

(function (view) {
	"use strict";
	var
	Uint8Array = view.Uint8Array,
	HTMLCanvasElement = view.HTMLCanvasElement,
	is_base64_regex = /\s*;\s*base64\s*(?:;|$)/i,
	base64_ranks,
	decode_base64 = function (base64) {
		var
		len = base64.length,
		buffer = new Uint8Array(len / 4 * 3 | 0),
		i = 0,
		outptr = 0,
		last = [0, 0],
		state = 0,
		save = 0,
		rank,
		code,
		undef;
		while (len--) {
			code = base64.charCodeAt(i++);
			rank = base64_ranks[code - 43];
			if (rank !== 255 && rank !== undef) {
				last[1] = last[0];
				last[0] = code;
				save = (save << 6) | rank;
				state++;
				if (state === 4) {
					buffer[outptr++] = save >>> 16;
					if (last[1] !== 61 /* padding character */
					) {
						buffer[outptr++] = save >>> 8;
					}
					if (last[0] !== 61 /* padding character */
					) {
						buffer[outptr++] = save;
					}
					state = 0;
				}
			}
		}
		// 2/3 chance there's going to be some null bytes at the end, but that
		// doesn't really matter with most image formats.
		// If it somehow matters for you, truncate the buffer up outptr.
		return buffer.buffer;
	};
	if (Uint8Array) {
		base64_ranks = new Uint8Array([
					62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, 0, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
				]);
	}
	if (HTMLCanvasElement && !HTMLCanvasElement.prototype.toBlob) {
		HTMLCanvasElement.prototype.toBlob = function (callback, type /*, ...args*/
		) {
			if (!type) {
				type = "image/png";
			}
			if (this.mozGetAsFile) {
				callback(this.mozGetAsFile("canvas", type));
				return;
			}
			var
			args = Array.prototype.slice.call(arguments, 1),
			dataURI = this.toDataURL.apply(this, args),
			header_end = dataURI.indexOf(","),
			data = dataURI.substring(header_end + 1),
			is_base64 = is_base64_regex.test(dataURI.substring(0, header_end)),
			BlobBuilder = view.BlobBuilder || view.WebKitBlobBuilder || view.MozBlobBuilder,
			bb = new BlobBuilder,
			blob;
			if (BlobBuilder.fake) {
				// no reason to decode a data: URI that's just going to become a data URI again
				blob = bb.getBlob(type);
				if (is_base64) {
					blob.encoding = "base64";
				} else {
					blob.encoding = "URI";
				}
				blob.data = data;
				blob.size = data.length;
			} else if (Uint8Array) {
				if (is_base64) {
					bb.append(decode_base64(data));
				} else {
					bb.append(decodeURIComponent(data));
				}
				blob = bb.getBlob(type);
			}
			callback(blob);
		};
	}
})(self);
