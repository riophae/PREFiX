var ce = chrome.extension;
var ct = chrome.tabs;
var root_url = ce.getURL('');
var popup_url = ce.getURL('popup.html');

chrome.runtime.onMessage.addListener(function(request, sender) {
	if (request.act === 'draw_attention') {
		if (! sender || ! sender.tab || ! sender.tab.windowId) return;
		chrome.windows.update(sender.tab.windowId, {
			drawAttention: true
		});
	} else if (request.act === 'stop_drawing_attention') {
		if (! sender || ! sender.tab || ! sender.tab.windowId) return;
		chrome.windows.update(sender.tab.windowId, {
			drawAttention: false
		});
	} else {
		chrome.tabs.query({
			url: chrome.extension.getURL('/popup.html?new_window=true')
		}, function(tabs) {
			tabs.forEach(function(tab) {
				if (! sender.tab) {
					chrome.tabs.remove(tab.id);
				}
			});
		});
	}
});

function onInputEntered(text) {
	PREFiX.user.postStatus({
		status: text
	}).next(function(status) {
		PREFiX.update();
		showNotification({
			title: '消息已成功发送至饭否',
			content: status.text,
			timeout: 10000
		}).addEventListener('click', function(e) {
			this.cancel();
		});
	}).error(function(e) {
		console.log(arguments)
		var content = '错误原因: ' + e.exceptionType;
		if (e.response && e.response.error) {
			content += ' / ' + e.response.error;
		}
		content += ' (点击这里重试)';
		showNotification({
			title: '消息发送失败',
			content: content,
			timeout: false
		}).addEventListener('click', function(e) {
			this.cancel();
			onInputEntered(text);
		});
	});
}

var birthday_interval;
chrome.omnibox.setDefaultSuggestion({
	description: '发送消息至饭否'
});

function updateDetails(flag) {
	var user = Ripple(PREFiX.accessToken);
	var verify = user.verify().next(function(details) {
		lscache.set('account_details', details);
		PREFiX.account = details;
		birthday_interval = setInterval(checkBirthday, 60000);
		checkBirthday();
	});
	if (flag) {
		// 延时重试
		verify.
		error(function() {
			setTimeout(function() {
				updateDetails(flag);
			}, 60000);
		});
	}
	return verify;
}

function checkBirthday() {
	detectBirthday();
	detectFanfouBirthday();
}

function detectFanfouBirthday() {
	if (! PREFiX.account) return;
	var now = new Date(Date.now() + Ripple.OAuth.timeCorrectionMsec);
	var ff_birthday = new Date(Date.parse(PREFiX.account.created_at));
	var year = ff_birthday.getFullYear();
	var delta;
	do {
		delta = now - ff_birthday;
	} while (delta > 0 && (ff_birthday.setFullYear(++year) || true));
	ff_birthday.setFullYear(--year);
	[ 'Milliseconds', 'Seconds', 'Minutes', 'Hours' ].
	forEach(function(i) {
		ff_birthday['set' + i](0);
	});
	ff_birthday.setHours(-(now.getTimezoneOffset() / 60 + 8));
	delta = now - ff_birthday;
	PREFiX.isTodayFanfouBirthday = delta >= 0 && delta < 24 * 60 * 60 * 1000;
	if (PREFiX.isTodayFanfouBirthday) {
		PREFiX.fanfouYears = (now - (new Date(Date.parse(PREFiX.account.created_at)))) 
			/ 365 / 24 / 60 / 60 / 1000;
	}
}

function detectBirthday() {
	if (PREFiX.account && PREFiX.account.birthday) {
		var birthday = PREFiX.account.birthday;
		var now = new Date(Date.now() + Ripple.OAuth.timeCorrectionMsec);
		var birth_month = +birthday.split('-')[1];
		var birth_date = +birthday.split('-')[2];
		if (birth_month && birth_date) {
			if (birth_month === now.getMonth() + 1 &&
				birth_date === now.getDate()) {
				PREFiX.isTodayBirthday = true;
				return;
			}
		}
	}
	PREFiX.isTodayBirthday = false;
}

function detectFriendBirthday() {
	PREFiX.birthdayFriends = [];
	var now = new Date(Date.now() + Ripple.OAuth.timeCorrectionMsec);
	PREFiX.friends.forEach(function(friend) {
		var birthday = friend.birthday;
		var birth_month = +birthday.split('-')[1];
		var birth_date = +birthday.split('-')[2];
		if (birth_month && birth_date) {
			if (birth_month === now.getMonth() + 1 &&
				birth_date === now.getDate()) {
				PREFiX.birthdayFriends.push(friend);
			}
		}
	});
}

function createTab(url) {
	ct.create({
		url: url,
		selected: true
	});
}

function closeTab(id) {
	ct.remove(id);
}

function closeWindow(id) {
	chrome.windows.remove(id);
}

function update() {
	var d = new Deferred;

	clearInterval(PREFiX.interval);
	PREFiX.interval = setInterval(update, 30000);

	var tl = PREFiX.homeTimeline;
	var statuses = fixStatusList(tl.statuses.concat(tl.buffered));
	var newest_status = statuses[0];
	var deferred_new = Deferred.next();

	chrome.browserAction.setBadgeText({
		text: '...'
	});
	chrome.browserAction.setBadgeBackgroundColor({
		color: [ 255, 255, 255, 200 ]
	});
	chrome.browserAction.setTitle({
		title: 'PREFiX - 正在刷新'
	});

	if (newest_status) {
		deferred_new = PREFiX.user.getHomeTimeline({
			since_id: newest_status.id
		}).setupAjax({
			lock: update
		}).next(function(statuses) {
			unshift(tl.buffered, statuses);
		});
	}
	var deferred_notification = PREFiX.user.getNotification().next(function(data) {
		PREFiX.previous_count = PREFiX.count;
		PREFiX.count = data;
	});
	Deferred.parallel(deferred_new, deferred_notification).next(function() {
		var need_notify = false;
		var title = [ 'PREFiX' ];

		var new_statuses = tl.buffered.filter(function(status) {
			return ! status.is_self;
		});
		if (new_statuses.length) {
			title.push(new_statuses.length + ' 条新消息');
		}
		if (PREFiX.count.mentions) {
			switchTo('mentions_model');
			title.push('你被 @ 了 ' + PREFiX.count.mentions + ' 次');
			chrome.browserAction.setBadgeBackgroundColor({
				color: [ 113, 202, 224, 204 ]
			});
			if (PREFiX.count.mentions > PREFiX.previous_count.mentions)
				need_notify = true;
		}
		if (PREFiX.count.direct_messages) {
			switchTo('privatemsgs_model');
			title.push('你有 ' + PREFiX.count.direct_messages + ' 条未读私信');
			chrome.browserAction.setBadgeBackgroundColor({
				color: [ 211, 0, 4, 204 ]
			});
			if (PREFiX.count.direct_messages > PREFiX.previous_count.direct_messages)
				need_notify = true;
		}
		chrome.browserAction.setBadgeText({
			text: (PREFiX.count.direct_messages || PREFiX.count.mentions || '') + ''
		});
		chrome.browserAction.setTitle({
			title: title.join('\n')
		});
		if (need_notify) playSound();

		d.call();
	}).error(function(e) {
		chrome.browserAction.setBadgeText({
			text: ' '
		});
		chrome.browserAction.setBadgeBackgroundColor({
			color: [ 255, 0, 0, 200 ]
		});
		chrome.browserAction.setTitle({
			title: 'PREFiX - 网络连接断开或内部错误'
		});
	});

	return d;
}

function loadFriends() {
	var friends = {};
	var dl = [];
	[ 'Friends', 'Followers' ].forEach(function(type) {
		var d = new Deferred;
		dl.push(d);
		(function get(page) {
			PREFiX.user['getLatestLogged' + type]({
				page: page,
				count: 100
			}).next(function(data) {
				if (data.length) {
					data = data.map(function(user) {
						return {
							name: user.name,
							id: user.id,
							string: user.id + ' ' + user.name,
							birthday: user.birthday
						};
					}).filter(function(user) {
						if (friends[user.name]) return false;
						friends[user.name] = true;
						return true;
					});
					PREFiX.friends.push.apply(PREFiX.friends, data);
					get(page + 1);
				} else {
					d.call();
				}
			});
		})(1);
	});
	dl = new Deferred.parallel(dl).next(function() {
		detectFriendBirthday();
		setInterval(detectFriendBirthday, 60 * 60 * 1000);
	});
}

var init_interval;

function load() {
	if (PREFiX.loaded) return;
	PREFiX.loaded = true;
	PREFiX.count = {
		mentions: 0,
		direct_messages: 0
	};
	PREFiX.friends = [];
	PREFiX.birthdayFriends = [];
	PREFiX.birthday = null;
	PREFiX.user = Ripple(PREFiX.accessToken);
	var init_data = function() {
		PREFiX.user.getHomeTimeline().next(function(statuses) {
			if (! PREFiX.homeTimeline.statuses.length) {
				PREFiX.homeTimeline.statuses = fixStatusList(statuses);
			}
			clearInterval(init_interval);
		});
	};
	init_interval = setInterval(init_data, 15 * 1000);
	init_data();
	update();
	loadFriends();
	chrome.omnibox.onInputEntered.addListener(onInputEntered);
}

function unload() {
	if (! PREFiX.loaded) return;
	clearInterval(PREFiX.interval);
	clearInterval(init_interval);
	clearInterval(birthday_interval);
	PREFiX.loaded = false;
	PREFiX.user = PREFiX.account = null;
	PREFiX.current = 'tl_model';
	PREFiX.compose = {
		text: '',
		type: '',
		id: '',
		user: '',
		username: ''
	};
	PREFiX.count = {
		mentions: 0,
		direct_messages: 0
	};
	PREFiX.homeTimeline = {
		statuses: [],
		buffered: [],
		scrollTop: 0
	};
	PREFiX.mentions = { 
		statuses: [],
		scrollTop: 0
	};
	PREFiX.privatemsgs = { 
		messages: [],
		scrollTop: 0
	};
	PREFiX.friends = [];
	chrome.browserAction.setBadgeText({
		text: ''
	});
	chrome.browserAction.setTitle({
		title: 'PREFiX'
	});
	chrome.omnibox.onInputEntered.removeListener(onInputEntered);
}

function initialize() {
	settings.load();

	if (PREFiX.accessToken) {
		// 更新账户信息
		updateDetails().
		next(function() {
			// 成功
			load();
		}).
		error(function(event) {
			if (event.status) {
				if (event.status === 401) {
					// access token 无效
					reset();
				} else {
					// 可能 API Hits 用光了, 延时重试
					setTimeout(initialize, 60000);
				}
			} else {
				// 网络错误
				if (PREFiX.account) {
					// 如果本地存在缓存的账户信息,
					// 则先使用缓存, 等一会再重试
					load();
					setTimeout(function() {
						updateDetails(true);
					}, 60000);
				} else {
					// 如果不存在, 则稍后再重试
					setTimeout(initialize, 60000);
				}
			}
		});

		return;
	}

	var tab_id, tab_port;
	Ripple.authorize.withPINCode(function(auth_url) {
		var options = {
			url: auth_url,
			selected: true
		};
		var deferred = Deferred();

		// 打开验证页面
		ct.create(options, function(tab) {

			ct.onUpdated.addListener(function onUpdated(id, info) {
				// 等待用户点击 '授权' 后跳转至 PIN Code 页面
				if (id !== tab.id) return;
				tab_id = id;

				// 继续验证操作
				ct.executeScript(id, {
					file: 'js/authorize.js'
				}, function() {
					// 等待页面传送 PIN Code
					var port = ct.connect(id);
					port.onMessage.addListener(function listenForPINCode(msg) {
						var pin_code = msg.pinCode;
						tab_port = port;
						// 如果页面端没有拿到 PIN Code, 会传送 'rejected' 消息过来
						deferred[pin_code == 'rejected' ? 'fail' : 'call'](pin_code);

						ct.onUpdated.removeListener(onUpdated);
						tab_port.onMessage.removeListener(listenForPINCode);
					});
				});

				ct.insertCSS(id, {
					code: '#retry { text-decoration: underline; }' +
								'#retry:hover { cursor: pointer; }'
				});
			});

		});

		// 返回 Deferred, 当拿到 PIN Code 后会继续后面的操作
		return deferred;
	}).
	next(function(token) {
		// 成功拿到 access token
		tab_port.postMessage({
			type: 'authorize',
			msg: 'success'
		});

		// 把 access token 缓存下来并重启程序
		lscache.set('access_token', token);
		PREFiX.accessToken = token;
		initialize();

		setTimeout(function() {
			closeTab(tab_id);
		}, 5000);
	}).
	error(function(error) {
		if (Ripple.getConfig('dumpLevel') > 0) {
			console.log(error);
		}
		if (tab_port) {
			// 打开了验证页面, 却没有完成验证
			tab_port.postMessage('failure');
			tab_port.onMessage.addListener(function(msg) {
				// 等待用户点击 '重试'
				if (msg.type === 'authorize' && msg.msg === 'retry') {
					closeTab(tab_id);
					initialize();
				}
			});
		} else {
			// 可能由于网络错误, 导致验证地址没有成功获取
			setTimeout(initialize, 60000);
		}
	});

}

// 清理所有与当前用户有关的数据, 恢复到未加载状态
function reset() {
	PREFiX.unload();
	PREFiX.accessToken = PREFiX.account = PREFiX.user = null;
	lscache.remove('access_token');
	lscache.remove('account_details');
	initialize();
}

function switchTo(model) {
	if (! PREFiX.popupActive) {
		PREFiX.current = model;
	}
}

var playSound = (function() {
	var audio = new Audio;
	audio.src = 'dongdong.mp3';
	var timeout;
	var last_played = new Date;
	last_played.setFullYear(1970);
	return function() {
		clearTimeout(timeout);
		if (! settings.current.playSound)
			return;
		timeout = setTimeout(function() {
			if (audio.networkState !== 1)
				return playSound();
			var now = new Date;
			if (now - last_played < 15 * 1000)
				return;
			last_played = now;
			audio.play();
		}, 50);
	}
})();

var is_mac = navigator.platform.indexOf('Mac') > -1;

var settings = {
	current: { },
	default: {
		playSound: true,
		smoothScroll: ! is_mac
	},
	load: function() {
		var local_settings = lscache.get('settings') || { };
		var current = settings.current;
		for (var key in settings.default) {
			current[key] = local_settings[key] === undefined ?
				settings.default[key] : local_settings[key];
		}
	},
	save: function() {
		lscache.set('settings', settings.current);
	}
};

var PREFiX = this.PREFiX = {
	version: chrome.app.getDetails().version,
	is_mac: is_mac,
	load: load,
	unload: unload,
	initialize: initialize,
	reset: reset,
	update: update,
	loaded: false,
	interval: null,
	current: 'tl_model',
	compose: {
		text: '',
		type: '',
		id: '',
		user: '',
		username: ''
	},
	count: {
		mentions: 0,
		direct_messages: 0
	},
	previous_count: {
		mentions: 0,
		direct_messages: 0
	},
	homeTimeline: {
		statuses: [],
		buffered: [],
		scrollTop: 0
	},
	mentions: { 
		statuses: [],
		scrollTop: 0
	},
	privatemsgs: { 
		messages: [],
		scrollTop: 0
	},
	friends: [],
	settings: settings,
	account: lscache.get('account_details'), // 当前账号的数据, 如昵称头像等
	accessToken: lscache.get('access_token'), // 缓存的 access token, 与饭否服务器联络的凭证
	user: null // 一个 Ripple 实例, 提供所有 API 接口
};

initialize();