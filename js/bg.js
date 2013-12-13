var ce = chrome.extension;
var ct = chrome.tabs;
var root_url = ce.getURL('');
var popup_url = ce.getURL('popup.html');

var $temp = $('<div />');

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
	} else if (request.act === 'set_consumer') {
		enableCustomConsumer(request.key, request.secret);
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

function onInputStarted() {
	chrome.omnibox.setDefaultSuggestion({
		description: '按回车键发送消息至饭否, 按 ↑/↓ 回复指定消息'
	});
	prepareSuggestions();
}

var suggestions = [];
function prepareSuggestions() {
	var users = { };
	function getSpaces(n) {
		return (new Array(n + 1)).join(' ');
	}
	suggestions = PREFiX.homeTimeline.buffered.
		concat(PREFiX.homeTimeline.statuses).
		slice(0, 5).
		map(function(status) {
			var text = $temp.text(status.textWithoutTags).html().
				replace(/@[\u4E00-\u9FA5\uf900-\ufa2da-zA-Z][\u4E00-\u9FA5\uf900-\ufa2da-zA-Z\._0-9]+/g, function(name) {
					return '<url>' + name + '</url>';
				});
			users[status.user.name] = users[status.user.name] || 0;
			return {
				content: '@' + status.user.name + getSpaces(++users[status.user.name]),
				description: '<dim>' + status.user.name + ': </dim>' +
					(status.photo ? '<url>[Photo]</url> ' : '') +
					text + '<dim> - ' +
					getRelativeTime(status.created_at) +
					' via ' + status.source + '</dim>'
			};
		});
}

var delaySuggest = _.throttle(prepareSuggestions, 1000);

function onInputChanged(text, suggest) {
	delaySuggest();
	suggest(suggestions);
}

function onInputEntered(text) {
	var re = /^@([\u4E00-\u9FA5\uf900-\ufa2da-zA-Z][\u4E00-\u9FA5\uf900-\ufa2da-zA-Z\._0-9]+)( +)/g;
	var result = re.exec(text);
	var at_user, spaces;
	var status_id;
	if (result) {
		at_user = result[1];
		spaces = result[2];
		var matched_statuses = [];
		PREFiX.homeTimeline.buffered.
		concat(PREFiX.homeTimeline.statuses).
		forEach(function(status) {
			if (status.user.name === at_user) {
				matched_statuses.push(status);
			}
		});
		for (var i = spaces.length; i-- > 0;) {
			if (matched_statuses[i]) {
				status_id = matched_statuses[i].id;
				break;
			}
		}
	}
	PREFiX.user.postStatus({
		status: text.replace(/\s+/g, ' ').trim(),
		in_reply_to_status_id: status_id
	}).next(function(status) {
		PREFiX.update();
		showNotification({
			title: '消息已成功发送至饭否',
			content: $temp.html(status.text).text(),
			timeout: 10000
		}).addEventListener('click', function(e) {
			this.cancel();
		});
	}).error(function(e) {
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
function updateDetails(flag) {
	var user = Ripple(PREFiX.accessToken);
	var verify = user.verify().next(function(details) {
		lscache.set('account_details', details);
		if (details.friends_count >= 85 && is_first_run) {
			settings.current.autoFlushCache = true;
			settings.save();
		}
		is_first_run = false;
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
				if (PREFiX.settings.current.birthdayNoticeType === 'friends_and_followers' ||
					friend.following) {
					PREFiX.birthdayFriends.push(friend);
				}
			}
		}
	});
}

var saved_searches_items = [];
function initSavedSearches() {
	var re = new RegExp('class="former">' + PREFiX.account.name + '<\\/a>');
	stopSavedSearches();
	function SavedSearchItem(q) {
		this.keyword = q;
		this.statuses = [];
		this.unread_count = 0;
		this.interval = setInterval(this.check.bind(this), 3 * 60 * 1000);
		this.ajax = null;
		this.check();
	}
	SavedSearchItem.prototype.check = function() {
		if (this.ajax) {
			this.ajax.cancel();
		}
		var self = this;
		var q = this.keyword;
		var last_status_id;
		var last_read_status_rawid = lscache.get('saved-search-' + q + '-rawid');
		if (this.statuses.length) {
			last_status_id = this.statuses[0].id;
		}
		this.ajax = getDataSince(
				'searchPublicTimeline',
				last_status_id,
				this,
				{ q: q },
				90
			).next(function(statuses) {
				if (statuses.length) {
					unshift(self.statuses, statuses);
					if (! last_read_status_rawid) {
						last_read_status_rawid = statuses[0].rawid;
						lscache.set('saved-search-' + q + '-rawid', statuses[0].rawid)
					}
				}
				if (! settings.current.showSavedSearchCount) {
					self.unread_count = 0;
					self.statuses.map(function(s) {
						s.is_unread = false;
					});
				} else {
					self.unread_count = self.statuses.filter(function(s) {
							s.is_unread = s.user.id !== PREFiX.account.id &&
								s.rawid > last_read_status_rawid &&
								! re.test(s.text);
							return s.is_unread;
						}).length;
				}
			});
	}
	SavedSearchItem.prototype.stop = function() {
		if (this.ajax) {
			this.ajax.cancel();
		}
		clearInterval(this.interval);
	}
	PREFiX.user.getSavedSearches().next(function(data) {
		data.forEach(function(saved_search) {
			saved_search = new SavedSearchItem(saved_search.query);
			saved_searches_items.push(saved_search);
		});
	});
	setTimeout(initSavedSearches, 60 * 60 * 1000);
}

function stopSavedSearches() {
	saved_searches_items.forEach(function(item) {
		item.stop();
	});
	saved_searches_items = [];
}

function getSavedSearchStatusesCount() {
	var count = 0;
	saved_searches_items.forEach(function(item) {
		count += item.unread_count;
	});
	return count;
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

function getDataSince(method, since_id, lock, extra_data, timeout) {
	if (lock) {
		if (lock._ajax_active_) {
			return new Deferred;
		}
		lock.timeout = setTimeout(function() {
			d.fail({
				exceptionType: 'timeout'
			});
			d = new Deferred;
		}, timeout * 1000);
		lock._ajax_active_ = true;
	}

	var d = new Deferred;
	var list = [];
	var get = PREFiX.user[method].bind(PREFiX.user);
	var count = 60;

	var data = extra_data || { };
	if (since_id) {
		data.since_id = since_id;
	}
	data.count = count;

	function getBetween() {
		if (! since_id) {
			d.call(list);
			return;
		}
		data.max_id = list[ list.length - 1 ].id;
		return get(data).next(function(data) {
				push(list, data);
				if (data.length < count) {
					d.call(list);
				} else {
					getBetween();
				}
			}).error(function(err) {
				d.fail(err);
			});
	}

	get(data).next(function(data) {
		list = fixStatusList(data);
		if (data.length < count) {
			d.call(list);
		} else {
			getBetween();
		}
	}).error(function(err) {
		d.fail(err);
	});

	return d.error(function(err) {
			if (lock) {
				delete lock._ajax_active_;
				clearTimeout(lock.timeout);
			}
			throw err;
		}).next(function(data) {
			if (lock) {
				delete lock._ajax_active_;
				clearTimeout(lock.timeout);
			}
			return data;
		});
}

function updateTitle() {
	var need_notify = false;
	var title = [ 'PREFiX' ];

	var tl = PREFiX.homeTimeline;
	var new_statuses = tl.buffered.filter(function(status) {
		return ! status.is_self;
	});
	if (new_statuses.length) {
		title.push(new_statuses.length + ' 条新消息');
		switchTo('tl_model');
	}
	var saved_searches_count = getSavedSearchStatusesCount();
	if (saved_searches_count) {
		title.push(saved_searches_count + ' 条关注的话题消息');
		switchTo('searches_model');
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

	return need_notify;
}

function update(retry_chances, new_status_id) {
	var d = new Deferred;

	clearInterval(PREFiX.interval);
	var interval_time = (PREFiX.rateLimit - PREFiX.rateLimitRemaining) / 10 * 1000;
	PREFiX.interval = setInterval(update, Math.max(interval_time, 30000));

	var tl = PREFiX.homeTimeline;
	var statuses = fixStatusList(tl.statuses.concat(tl.buffered));
	var latest_status = statuses[0];
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

	if (latest_status) {
		deferred_new = getDataSince('getHomeTimeline', latest_status.id, update, null, 45).
			next(function(statuses) {
				if (retry_chances && new_status_id) {
					var new_status_found = statuses.some(function(s) {
						return s.id === new_status_id;
					});
					if (! new_status_found) {
						setTimeout(function() {
							update(--retry_chances, new_status_id);
						});
					}
				}
				unshift(tl.buffered, statuses);
				if (! settings.current.autoFlushCache)
					return;
				if (! PREFiX.popupActive && tl.scrollTop < 30) {
					var buffered_count = tl.buffered.length;
					var read_count = tl.statuses.length;
					var cache_amount = settings.current.cacheAmount;
					if (buffered_count + read_count > cache_amount) {
						tl.statuses.splice(Math.max(0, cache_amount - buffered_count));
						if (buffered_count > cache_amount) {
							tl.buffered.splice(cache_amount);
						}
					}
				}
			});
	}
	var deferred_notification = PREFiX.user.getNotification().next(function(data) {
		PREFiX.previous_count = PREFiX.count;
		PREFiX.count = data;
	});
	Deferred.parallel(deferred_new, deferred_notification).next(function() {
		var need_notify = updateTitle();
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
		var time = getShortTime(new Date);
		console.log('Error thrown @ ' + time, e);
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
							birthday: user.birthday,
							following: user.following
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
	PREFiX.rateLimitRemaining = 1500;
	PREFiX.rateLimitReset = Date.now() + Ripple.OAuth.timeCorrectionMsec;
	updateRateLimit();
	update();
	loadFriends();
	initSavedSearches();
	chrome.omnibox.onInputStarted.addListener(onInputStarted);
	chrome.omnibox.onInputChanged.addListener(onInputChanged);
	chrome.omnibox.onInputEntered.addListener(onInputEntered);
	if (startup && settings.current.createPopAtStartup) {
		createPopup();
	}
	startup = false;
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
		scrollTop: 0,
		current: ''
	};
	PREFiX.mentions = { 
		statuses: [],
		scrollTop: 0,
		current: ''
	};
	PREFiX.privatemsgs = { 
		messages: [],
		scrollTop: 0,
		current: ''
	};
	PREFiX.keyword = '';
	PREFiX.friends = [];
	stopSavedSearches();
	chrome.browserAction.setBadgeText({
		text: ''
	});
	chrome.browserAction.setTitle({
		title: 'PREFiX'
	});
	chrome.omnibox.onInputStarted.removeListener(onInputStarted);
	chrome.omnibox.onInputChanged.removeListener(onInputChanged);
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

function switchTo(model_name) {
	if (! PREFiX.popupActive) {
		PREFiX.current = model_name;
	}
}
window.Notifications = window.Notifications || window.webkitNotifications;
var notifications = [];

function showNotification(options) {
	var notification = Notifications.createNotification(options.icon || '/icons/128.png',
		options.title || 'PREFiX', options.content);

	if (options.id) {
		notification.id = options.id;
		notifications = notifications.filter(function(n) {
			if (n.id != options.id)
				return true;
			n.cancel();
			return false;
		});
	}

	notification.addEventListener('close', function(e) {
		clearTimeout(notification.timeout);
		hideNotification(notification);
	}, false);

	notification.show();
	notifications.push(notification);

	if (options.timeout !== false) {
		notification.timeout = setTimeout(function() {
			hideNotification(notification);
		}, options.timeout || 30000);
	}

	return notification;
}
function hideAllNotifications() {
	notifications.slice(0).
	forEach(hideNotification);
}
function hideNotification(notification) {
	notification.cancel();
	if (notification.timeout) {
		clearTimeout(notification.timeout);
	}
	var index = notifications.indexOf(notification);
	if (index > -1) {
		notifications.splice(index, 1);
	}
}

function getStatusCount() {
	return lscache.get('status_count') || 0;
}

function getPhotoCount() {
	return lscache.get('photo_count') || 0;
}

var playSound = (function() {
	var audio = new Audio;
	audio.src = 'dongdong.mp3';
	var timeout;
	var last_played = new Date;
	last_played.setFullYear(1970);
	return function(force) {
		clearTimeout(timeout);
		if (! settings.current.playSound && ! force)
			return;
		timeout = setTimeout(function() {
			if (audio.networkState !== 1)
				return playSound();
			var now = new Date;
			if (now - last_played < 15 * 1000 && ! force)
				return;
			last_played = now;
			audio.volume = settings.current.volume;
			audio.play();
		}, 50);
	}
})();

var chs_re = new RegExp;
chs_re.compile('[「\u4E00-\u9FA5\uf900-\ufa2d」]', 'g');
Ripple.events.observe('process_status', function(status) {
	if (! status) return;

	var created_at = status.created_at;
	status.fullTime = getFullTime(created_at);
	status.relativeTime = '';

	if (status.source) {
		status.source = $temp.html(status.source).text();
		status.source = ({
			'网页': 'Web',
			'手机上网': 'Wap',
			'iPhone版': 'iPhone'
		})[status.source] || status.source;
		status.source = status.source.replace('客户端', '');
		status.source = status.source.replace(/[a-zA-Z0-0]+/g, function(en) {
			return '<span class="en">' + en + '</span>'
		}).replace(chs_re, function(chs) {
			return '<span class="chs">' + chs + '</span>';
		});
		status.is_breakpoint = false;
		status.loaded_at = null;
		status.loaded_at_relative = '';
	}

	var html = status.text;
	$temp.html(html);
	status.textWithoutTags = $temp.text();
	html = jEmoji.softbankToUnified(html);
	html = jEmoji.googleToUnified(html);
	html = jEmoji.docomoToUnified(html);
	html = jEmoji.kddiToUnified(html);
	html = jEmoji.unifiedToHTML(html);

	html = html.replace(/\s*\n+\s*/g, '<br />');

	var mention_re = /<a href="http:\/\/fanfou\.com\/([^"]+)" class="former">([^<]+)<\/a>/gi;
	html = html.replace(mention_re, function(_, id, name) {
		return '<a href="http://fanfou.com/' + id +
			'" title="@' + name + ' (' + id +
			')">' + name + '</a>';
	});

	status.fixedText = html;

	if (status.photo) {
		var img = new Image;
		img.src = status.photo.thumburl;
		waitFor(function() {
			return img.naturalWidth;
		}, function() {
			status.photo.thumb_width = img.naturalWidth;
			status.photo.thumb_height = img.naturalHeight;
			img.src = status.photo.largeurl;
		});
	}

	if (status.repost_status) {
		arguments.callee.call(this, status.repost_status);
	}
});

Ripple.events.addGlobalObserver('after', function(data, e) {
	if (! e || e.type !== 'after.ajax_success')
		return;
	e = e.srcEvent;
	if (! e) return;
	if (e.url === 'http://api.fanfou.com/statuses/update.json') {
		lscache.set('status_count', getStatusCount() + 1);
	} else if (e.url === 'http://api.fanfou.com/photos/upload.json') {
		lscache.set('photo_count', getPhotoCount() + 1);
	}
});

Ripple.events.addGlobalObserver('after', function(data, e) {
	if (! e || e.type !== 'after.ajax_oncomplete')
		return;
	e = e.srcEvent;
	if (! e) return;
	if (e.url.indexOf('http://api.fanfou.com/') === 0) {
		PREFiX.rateLimitRemaining--;
		var now = Date.now() + Ripple.OAuth.timeCorrectionMsec;
		if (PREFiX.rateLimitReset <= now) {
			PREFiX.rateLimitRemaining == PREFiX.rateLimit;
		}
	}
});

function updateRateLimit() {
	if (! PREFiX.account) return;
	PREFiX.user.getRateLimit().next(function(result) {
		PREFiX.rateLimit = result.hourly_limit;
		PREFiX.rateLimitReset = Date.parse(result.reset_time);
		PREFiX.rateLimitRemaining = result.remaining_hits;
	});
}
setInterval(updateRateLimit, 5 * 60 * 1000);

if (! lscache.get('install_time')) {
	lscache.set('install_time', Date.now());
}

var is_mac = navigator.platform.indexOf('Mac') > -1;

var settings = {
	current: { },
	default: {
		playSound: true,
		smoothScroll: true,
		birthdayNotice: true,
		birthdayNoticeType: 'only_friends',
		birthdayGreetingType: 'post_status',
		autoFlushCache: false,
		cacheAmount: 75,
		zoomRatio: '1',
		drawAttention: true,
		showSavedSearchCount: true,
		createPopAtStartup: false,
		volume: 1,
		holdCtrlToSubmit: false
	},
	load: function() {
		var local_settings = lscache.get('settings') || { };
		var current = settings.current;
		for (var key in settings.default) {
			current[key] = local_settings[key] === undefined ?
				settings.default[key] : local_settings[key];
		}
		if (current.zoomRatio === '1.11') {
			current.zoomRatio = '1.125';
			settings.save();
		}
	},
	save: function() {
		lscache.set('settings', settings.current);
	},
	onSettingsUpdated: function() {
		detectFriendBirthday();
		initSavedSearches();
		chrome.extension.getViews().forEach(function(view) {
			if (view.location.pathname === '/popup.html' &&
				view.location.search === '?new_window=true') {
				view.location.reload();
			}
		});
	}
};

var usage_tips = [
	'按 Ctrl + Enter 或双击输入框即可发送消息. ',
	'如果您觉得字体太小, 可以在设置页启用<b>放大功能</b>. ',
	'点击 PREFiX 回到页面顶部或刷新. ',
	'在地址栏输入 f 按空格键, 然后输入内容按回车即可直接发送消息. ',
	'按 1/2/3/4 键在 首页/提到我的/私信/随便看看和关注的话题 页面间切换. ',
	'左击上下文图标展开回复和转发, 右击显示上下文消息. ',
	'右击消息中的图片, 将在后台新标签打开大图. ',
	'将鼠标指针放在用户头像或消息中提到的名字上, 可以显示用户 ID. ',
	'窗口模式运行时最小化, 当有新消息时任务栏图标会闪烁. ',
	'如果饭友生日提醒打扰了您, 可以在设置页关闭. ',
	'如果您不希望 PREFiX 播放提示音, 可以在设置页关闭. ',
	'PREFiX 页面关闭前保持滚动条在顶端可让程序性能更佳. ',
	'当输入框中字数超过 140 时, 输入框背景将显示为淡红色. ',
	'按住 Ctrl / Command 键双击输入框可以发送歌词 :)',
	'按 PageUp/PageDown 键可以快速翻页. ',
	'按 Home/End 键可以快速滑动到页面顶端/末端. ',
	'您可以自定义尾巴 (即通过...发送), 详情请见设置页. ',
	'独立窗口模式运行时, 您可以纵向拖拽窗口调整大小. ',
	'点击生日提醒中的用户名可以发送私信. ',
	'点击用户名发送私信, 点击头像打开饭否个人页面. ',
	'如果您希望删除消息或私信, 请<b>双击</b>删除图标. ',
	'您可以在设置页开启浏览器启动时自动打开 PREFiX 窗口功能. ',
	'您可以点击 TL 上自己的名字打开您的消息页面. ',
	'如果您觉得提示音音量过大, 可以在设置页调整音量. ',
	'您可以使用 Vim 风格的快捷键操作 PREFiX, 详见设置页. ',
	'您可以在扩展管理页面末端给 PREFiX 设置快捷键, 从而使用快捷键直接打开 PREFiX 页面. ',
	'如果您发现 PREFiX 启动时容易卡顿, 建议开启自动抛弃缓存功能, 并设置保留在缓存中的最大消息数量. ',
	'将鼠标指针放在饭友名字后面的 # 上时, 可以查看消息的完整发布时间, 点击将打开消息在饭否的页面. ',
	'如果您习惯使用双击选中文本, 请在设置页中开启 "只有按住 Ctrl / Command 键才能双击输入框发送消息". ',
	'如果您希望查看完整的使用技巧, 参见设置页. '
];

var PREFiX = this.PREFiX = {
	version: chrome.app.getDetails().version,
	is_mac: is_mac,
	load: load,
	unload: unload,
	initialize: initialize,
	reset: reset,
	update: update,
	getDataSince: getDataSince,
	loaded: false,
	interval: null,
	current: 'tl_model',
	keyword: '',
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
		scrollTop: 0,
		current: ''
	},
	mentions: { 
		statuses: [],
		scrollTop: 0,
		current: ''
	},
	privatemsgs: { 
		messages: [],
		scrollTop: 0,
		current: ''
	},
	friends: [],
	rateLimit: 1500,
	rateLimitRemaining: 1500,
	rateLimitReset: Date.now(),
	settings: settings,
	account: lscache.get('account_details'), // 当前账号的数据, 如昵称头像等
	accessToken: lscache.get('access_token'), // 缓存的 access token, 与饭否服务器联络的凭证
	user: null // 一个 Ripple 实例, 提供所有 API 接口
};

initialize();
var is_first_run = lscache.get('is_first_run') !== false;
lscache.set('is_first_run', false);

var startup = true;