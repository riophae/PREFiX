var ce = chrome.extension;
var ct = chrome.tabs;
var root_url = ce.getURL('');
var popup_url = ce.getURL('popup.html');

function createTab(url) {
	ct.create({
		url: url,
		selected: true
	});
}

function updateDetails(flag) {
	var user = Ripple(PREFiX.accessToken);
	var verify = user.verify().next(function(details) {
		lscache.set('account_details', details);
		PREFiX.account = details;
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

function closeTab(id) {
	ct.remove(id);
}

function closeWindow(id) {
	chrome.windows.remove(id);
}

function update() {
	clearInterval(PREFiX.interval);
	PREFiX.interval = setInterval(update, 30000);

	var tl = PREFiX.homeTimeline;
	var statuses = fixStatusList(tl.statuses.concat(tl.buffered));
	var newest_status = statuses[0];
	var deferred_new = Deferred.next();

	chrome.browserAction.setIcon({
		path: '/icons/refresh.png'
	});
	chrome.browserAction.setBadgeText({
		text: ''
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
		PREFiX.count = data;
	});
	Deferred.parallel(deferred_new, deferred_notification).next(function() {
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
		}
		if (PREFiX.count.direct_messages) {
			switchTo('privatemsgs_model');
			title.push('你有 ' + PREFiX.count.direct_messages + ' 条未读私信');
			chrome.browserAction.setBadgeBackgroundColor({
				color: [ 211, 0, 4, 204 ]
			});
		}
		var total = PREFiX.count.mentions + PREFiX.count.direct_messages;
		chrome.browserAction.setBadgeText({
			text: total && (total + '') || ''
		});
		chrome.browserAction.setTitle({
			title: title.join('\n')
		});
		chrome.browserAction.setIcon({
			path: '/icons/19.png'
		});
	}).error(function(e) {
		chrome.browserAction.setIcon({
			path: '/icons/19_gray.png'
		});
	});
}

function loadFriends() {
	var friends = {};
	[ 'Friends', 'Followers' ].forEach(function(type) {
		(function get(page) {
			PREFiX.user['getLatestLogged' + type]({
				page: page,
				count: 100
			}).next(function(data) {
				if (data.length) {
					data = data.map(function(user) {
						return {
							name: user.name,
							string: user.id + ' ' + user.name
						};
					}).filter(function(user) {
						if (friends[user.name]) return false;
						friends[user.name] = true;
						return true;
					});
					PREFiX.friends.push.apply(PREFiX.friends, data);
					get(page + 1);
				}
			});
		})(1);
	});
}

function load() {
	if (PREFiX.loaded) return;
	PREFiX.loaded = true;
	PREFiX.count = {
		mentions: 0,
		direct_messages: 0
	};
	PREFiX.friends = [],
	PREFiX.user = Ripple(PREFiX.accessToken);
	PREFiX.user.getHomeTimeline().next(function(statuses) {
		PREFiX.homeTimeline.statuses = fixStatusList(statuses);
	});
	update();
	loadFriends();
}

function unload() {
	if (! PREFiX.loaded) return;
	clearInterval(PREFiX.interval);
	PREFiX.loaded = false;
	PREFiX.user = null;
	PREFiX.current = 'tl_model';
	PREFiX.compose = {
		text: '',
		type: '',
		id: '',
		user: ''
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
	chrome.browserAction.setIcon({
		path: '/icons/19.png'
	});
}

function initialize() {

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

var settings = {
	current: { }
};

var PREFiX = this.PREFiX = {
	version: chrome.app.getDetails().version,
	load: load,
	unload: unload,
	initialize: initialize,
	reset: reset,
	update: update,
	loaded: false,
	showExtHomePage: function() {
		//createTab('https://chrome.google.com/webstore/detail/fkabhbjhcdoccohpojphgofmlljekcgg/reviews');
	},
	interval: null,
	current: 'tl_model',
	compose: {
		text: '',
		type: '',
		id: '',
		user: ''
	},
	count: {
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
	account: lscache.get('account_details'), // 当前账号的数据, 如昵称头像等
	accessToken: lscache.get('access_token'), // 缓存的 access token, 与饭否服务器联络的凭证
	user: null // 一个 Ripple 实例, 提供所有 API 接口
};

initialize();