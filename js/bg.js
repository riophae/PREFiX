var ce = chrome.extension;
var ct = chrome.tabs;
var root_url = ce.getURL('');
var popup_url = ce.getURL('popup.html');

var short_url_re = /https?:\/\/(?:bit\.ly|goo\.gl|v\.gd|is\.gd|tinyurl\.com|to\.ly|yep\.it|j\.mp)\//;
var status_url_re = /<a href="([^"]+)" title="([^"]+)" rel="nofollow" target="_blank">([^<]+)<\/a>/g;
var fanfou_url_re = /^http:\/\/(?:\S+\.)?fanfou\.com\//;

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

function batchProcess(callback) {
	var views = ce.getViews();
	views.forEach(callback);
}

function markStatusAsFavourited(status_id) {
	var lists = [
		PREFiX.homeTimeline.buffered,
		PREFiX.homeTimeline.statuses,
		PREFiX.mentions.statuses
	];
	lists.forEach(function(list) {
		list.some(function(status) {
			if (status.id === status_id) {
				status.favorited = true;
				return true;
			}
		});
	});
}

function markStatusAsUnfavourited(status_id) {
	var lists = [
		PREFiX.homeTimeline.buffered,
		PREFiX.homeTimeline.statuses,
		PREFiX.mentions.statuses
	];
	lists.forEach(function(list) {
		list.some(function(status) {
			if (status.id === status_id) {
				status.favorited = false;
				return true;
			}
		});
	});
}

function deleteStatusFromAllLists(status_id) {
	var lists = [
		PREFiX.homeTimeline.buffered,
		PREFiX.homeTimeline.statuses,
		PREFiX.mentions.statuses
	];
	lists.forEach(function(list) {
		var index = -1;
		list.some(function(status, i) {
			if (status.id === status_id) {
				index = i;
				return true;
			}
		});
		if (index > -1) {
			list.splice(index, 1);
		}
	});
}

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

function initUrlExpand() {
	var short_url_services = lscache.get('short_url_services');
	if (short_url_services) {
		// 识别更多短链接
		short_url_services['[a-z0-9]{1,5}\.[a-z]{2,3}'] = true;
		var re = '^https?:\\/\\/';
		re += '(?:' + Object.keys(short_url_services).join('|') + ')';
		re += '\\/\\S+';
		re = re.replace(/\./g, '\\.');
		PREFiX.shortUrlRe = new RegExp(re);
		return;
	}
	Ripple.ajax.get('http://api.longurl.org/v2/services', {
		params: {
			format: 'json'
		},
		success: function(data) {
			lscache.set('short_url_services', data);
			initUrlExpand();
		},
		error: function(e) {
			setTimeout(initUrlExpand, 60000);
		}
	});
}

var cached_short_urls = { };
function expandUrl(url) {
	var d = new Deferred;
	if (cached_short_urls[url]) {
		setTimeout(function() {
			d.call(cached_short_urls[url]);
		});
	} else {
		function cb(long_url) {
			cached_short_urls[url] = long_url;
			d.call(long_url);
		}
		var is_gd_re = /https?:\/\/is\.gd\/([a-zA-Z0-9\-\_]+)/;
		if (is_gd_re.test(url)) {
			Ripple.ajax.get('http://is.gd/forward.php', {
				params: {
					shorturl: url.match(is_gd_re)[1],
					format: 'simple'
				},
				success: cb
			});
		} else {
			Ripple.ajax.get('http://api.longurl.org/v2/expand', {
				params: {
					url: url,
					format: 'json'
				}
			}).next(function(data) {
				cb(data['long-url']);
			});
		}
	}
	return d;
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
			var cache_amount = Math.max(self.unread_count, 20);
			self.statuses.splice(cache_amount);
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

function initStreamingAPI() {
	var processed_index = -1;
	function notify(options) {
		if (! settings.current.notification)
			return;
		var is_mention_or_pm = [ 'mention', 'privatemsg' ].indexOf(options.type) > -1;
		if (is_mention_or_pm) {
			if (PREFiX.popupActive && (! PREFiX.panelMode || PREFiX.is_popup_focused))
				return;
		}
		if (options.type === 'mention' && ! settings.current.notif_mention)
			return;
		if (options.type === 'privatemsg' && ! settings.current.notif_privatemsg)
			return;
		if (options.type === 'friend' && ! settings.current.notif_follower)
			return;
		if (options.type === 'request' && ! settings.current.notif_friendreq)
			return;
		if (options.type === 'favourite' && ! settings.current.notif_favourite)
			return;
		showNotification(options).addEventListener('click', function(e) {
			this.cancel();
			if (options.url) {
				createTab(options.url);
			}
			if (! is_mention_or_pm)
				return;
			if (PREFiX.panelMode) {
				var url = chrome.extension.getURL('/popup.html?new_window=true');
				chrome.tabs.query({
					url: url
				}, function(tabs) {
					tabs.forEach(function(tab) {
						chrome.windows.update(tab.windowId, {
							focused: true
						});
					});
				});
				var views = chrome.extension.getViews();
				views.some(function(view) {
					if (view.location.href == url) {
						var selector = '#navigation-bar ';
						if (options.type === 'mention') {
							selector += '.mentions';
						} else if (options.type === 'privatemsg') {
							selector += '.privatemsgs';
						}
						var elem = view.$(selector)[0];
						var event = new Event('click');
						elem.dispatchEvent(event);
						return true;
					}
				});
			} else {
				createPopup();
			}
		});
	}
	function process(data) {
		if (! data || ! data.trim().length)
			return;
		try {
			data = JSON.parse(data);
		} catch (e) {
			console.log('failed to parse data', data);
			throw e;
		}
		var object = data.object;
		if (object && object.text) {
			Ripple.events.trigger('process_status', object);
			if (object.photo && object.photo.url) {
				object.textWithoutTags += '[Photo]';
			}
		}
		if (data.event === 'message.create' ||
			data.event === 'dm.create') {
			var retry = 3;
			setTimeout(function() {
				getNotification().next(function() {
					if (! PREFiX.count.mentions &&
						! PREFiX.count.direct_messages &&
						! object.is_self &&
						retry--) {
						getNotification().next(arguments.callee);
						return;
					}
					updateTitle();
					if (! object.is_self) {
						playSound();
						var options = { };
						if (data.event === 'message.create') {
							options.type = 'mention';
							options.title = object.user.name + ' (' +
								object.user.id + ') 提到了你';
							options.content = object.textWithoutTags;
							options.icon = data.source.profile_image_url_large;
						} else if (data.event === 'dm.create') {
							options.type = 'privatemsg';
							options.title = '收到 ' + data.source.name +
								' (' + data.source.id + ') 发送的私信';
							options.content = object.textWithoutTags;
							options.icon = data.source.profile_image_url_large;
						}
						if (! options.type) return;
						chrome.tabs.query({
							active: true,
							currentWindow: true
						}, function(tabs) {
							var tab = tabs[0];
							if (! tab || tab.url.indexOf('fanfou.com/') === -1)
								notify(options);
						});
					}
				});
			}, 500);
		} else if (data.event === 'message.delete') {
			if (object.is_self) {
				batchProcess(function(view) {
					setTimeout(function() {
						view.deleteStatusFromAllLists && view.deleteStatusFromAllLists(object.id);
					}, 2000);
				});
			}
		} else if (data.event === 'fav.create') {
			if (data.source.id === PREFiX.account.id) {
				batchProcess(function(view) {
					view.markStatusAsFavourited && view.markStatusAsFavourited(object.id);
				});
				return;
			}
			notify({
				type: 'favourite',
				title: data.source.name + ' (' + data.source.id + ') ' +
					(data.event === 'fav.create' ? '' : '取消') +
					'收藏了你的消息',
				content: object.textWithoutTags,
				icon: data.source.profile_image_url_large
			});
		} else if (data.event === 'fav.delete') {
			if (data.source.id === PREFiX.account.id) {
				batchProcess(function(view) {
					view.markStatusAsUnfavourited && view.markStatusAsUnfavourited(object.id);
				});
				return;
			}
		} else if (data.event === 'friends.create') {
			if (PREFiX.acount.protected) return;
			notify({
				type: 'friend',
				title: data.source.name + ' (' + data.source.id + ') ' +
					'关注了你',
				content: data.source.description,
				url: 'http://fanfou.com/' + data.source.id,
				icon: data.source.profile_image_url_large
			});
		} else if (data.event === 'friends.request') {
			notify({
				type: 'request',
				title: data.source.name + ' (' + data.source.id + ') ' +
					'请求关注你',
				content: data.source.description,
				url: 'http://fanfou.com/friend.request',
				icon: data.source.profile_image_url_large
			});
		} else {
			console.log('streaming event', data)
		}
	}
	PREFiX.streamingAjax = PREFiX.user.streamingAPI({
		method: 'GET',
		action: 'http://stream.fanfou.com/1/user.json',
		callback: function(e) {
			var data = this.responseText;
			if (! data) return;
			var parsed_data = data.split('\r\n');
			for (var i = processed_index + 1; true; i++) {
				if (parsed_data[i + 1] !== undefined) {
					processed_index = i;
					try {
						process(parsed_data[i]);
					} catch (e) { }
				} else {
					break;
				}
			}
		}
	}).hold(function(e) {
		if (PREFiX.account) {
			setTimeout(initStreamingAPI, 60 * 1000);
		}
	});
}

function stopStreamingAPI() {
	if (PREFiX.streamingAjax) {
		PREFiX.streamingAjax.cancel();
		PREFiX.streamingAjax = null;
	}
}

function resetTimer() {
	clearInterval(PREFiX.interval);
	var interval_time = (PREFiX.rateLimit - PREFiX.rateLimitRemaining) / 10 * 1000;
	PREFiX.interval = setInterval(update, Math.max(interval_time, 30000));
}

function getNotification() {
	return PREFiX.user.getNotification().next(function(data) {
			PREFiX.previous_count = PREFiX.count;
			PREFiX.count = data;
		});
}

function update(retry_chances, new_status_id) {
	var d = new Deferred;

	resetTimer();

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
	var deferred_notification = getNotification();
	Deferred.parallel(deferred_new, deferred_notification).next(function() {
		updateTitle();
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

function getNaturalDimentions(url, callback) {
	var image = new Image;
	image.src = url;
	waitFor(function() {
		return image.naturalWidth;
	}, function() {
		callback({
			width: image.naturalWidth,
			height: image.naturalHeight
		});
		image.src = '';
		image = null;
	});
}

function processPhoto(status, photo) {
	var img = new Image;
	img.src = photo.thumburl = photo.thumburl || photo.largeurl;
	var width = photo.width;
	var height = photo.height;
	waitFor(function() {
		return width || img.naturalWidth;
	}, function() {
		width = width || img.naturalWidth;
		height = height || img.naturalHeight;
		if (width > height) {
			if (width > 120) {
				var k = width / 120;
				width = 120;
				height /= k;
			}
		} else {
			if (height > 120) {
				var k = height / 120;
				height = 120;
				width /= k;
			}
		}
		if (img.src != status.photo.largeurl) {
			img.src = status.photo.largeurl;
		}
		photo.thumb_width = Math.round(width) + 'px';
		photo.thumb_height = Math.round(height) + 'px';
		if (status.photo.url && photo.thumburl !== status.photo.thumburl) {
			return;
		}
		$.extend(true, status.photo, photo);
	});
}

var enrichStatus = (function() {
	this.lib = [];

	function UrlItem(url) {
		this.url = url;
		this.status = 'initialized';
		this.callbacks = [];
		this.fetch();
		lib.push(this);
	}

	UrlItem.prototype.fetch = function fetch() {
		var self = this;
		var url = this.longUrl || this.url;
		this.status = 'loading';

		short_url_re = PREFiX.shortUrlRe || short_url_re;
		if (short_url_re.test(url)) {
			if (! isPhotoLink(url)) {
				expandUrl(url).next(function(long_url) {
					if (self.longUrl && self.longUrl === long_url)
						return;
					self.longUrl = long_url;
					fetch.call(self);
				});
				return;
			}
		} else if (self.url.indexOf('fanfou.com') === -1 &&
			! self.longUrl) {
			setTimeout(function() {
				self.longUrl = self.url;
			});
		}

		if (! isPhotoLink(url)) {
			self.status = 'ignored';
			lscache.set('url-' + url, self);
			return;
		}

		var result = url.match(instagram_re);
		if (result) {
			var image_url = result[0] + 'media/';
			image_url = image_url.replace('instagr.am', 'instagram.com');
			loadImage({
				url: self.url,
				large_url: image_url + '?size=l',
				thumbnail_url: image_url + '?size=t',
				urlItem: self
			});
			return;
		}

		var result = url.match(pinsta_re);
		if (result) {
			var id = result[1];
			Ripple.ajax.get(url).
			next(function(html) {
				var $html = $(html);
				var large_url;
				var thumbnail_url;
				[].some.call($html.find('script'), function(script) {
					var code = script.textContent;
					if (code.indexOf('var mediaJson') > -1) {
						code = code.match(/var mediaJson = ([^;]+);/)[1];
						var media_json = JSON.parse(code);
						media_json.some(function(item) {
							if (item.id === id) {
								large_url = item.images.standard_resolution;
								thumbnail_url = item.images.thumbnail;
								return true;
							}
						});
						return true;
					}
				});
				$html.length = 0;
				$html = null;
				if (large_url) {
					loadImage({
						url: self.url,
						large_url: large_url,
						thumbnail_url: thumbnail_url,
						urlItem: self
					});
				} else {
					self.status = 'ignored';
					lscache.set('url-' + url, self);
				}
			});
			return;
		}

		var result = url.match(weibo_re);
		if (result) {
			var large_url = url.replace(/\/(?:mw1024|bmiddle|thumbnail)\//, '/large/');
			loadImage({
				url: self.url,
				large_url: large_url,
				thumbnail_url: large_url.replace('/large/', '/thumbnail/'),
				urlItem: self
			});
			return;
		}

		var result = url.match(imgly_re);
		if (result) {
			Ripple.ajax.get(url).
			next(function(html) {
				var $html = $(html);
				var full_url = $html.find('#button-fullview a').attr('href');
				$html.length = 0;
				$html = null;
				if (! /^http/.test(full_url)) {
					full_url = 'http://img.ly' + full_url;
				}
				Ripple.ajax.get(full_url).next(function(html) {
					var $html = $(html);
					var large_url = $html.find('#image-full img').attr('src');
					$html.length = 0;
					$html = null;
					if (large_url) {
						loadImage({
							url: self.url,
							large_url: large_url,
							urlItem: self
						});
					} else {
						self.status = 'ignored';
						lscache.set('url-' + url, self);
					}
				})
			});
			return;
		}

		var result = url.match(lofter_re);
		if (result) {
			Ripple.ajax.get(url).
			next(function(html) {
				var $html = $(html);
				var large_url = $html.find('[bigimgsrc]').attr('bigimgsrc');
				$html.length = 0;
				$html = null;
				if (large_url) {
					loadImage({
						url: self.url,
						large_url: large_url,
						urlItem: self
					});
				} else {
					self.status = 'ignored';
					lscache.set('url-' + url, self);
				}
			});
			return;
		}

		var result = url.match(imgur_re);
		if (result) {
			Ripple.ajax.get(url).
			next(function(html) {
				html = html.replace(/(src|href)="\/\//g, function(_, $1) {
					return $1 + '="http://';
				});
				var $html = $(html);
				var large_url = $html.find('#image a').prop('href');
				large_url = large_url || $html.find('#image img').prop('src');
				$html.length = 0;
				$html = null;
				if (large_url) {
					loadImage({
						url: self.url,
						large_url: large_url,
						urlItem: self
					});
				} else {
					self.status = 'ignored';
					lscache.set('url-' + url, self);
				}
			});
			return;
		}

		var result = url.match(tinypic_re);
		if (result) {
			Ripple.ajax.get(url).
			next(function(html) {
				var $html = $(html);
				var large_url = $html.find('#imgFrame a').prop('href');
				$html.length = 0;
				$html = null;
				if (large_url) {
					loadImage({
						url: self.url,
						large_url: large_url,
						urlItem: self
					});
				} else {
					self.status = 'ignored';
					lscache.set('url-' + url, self);
				}
			});
			return;
		}

		var result = url.match(fanfou_re);
		if (result) {
			Ripple.ajax.get(url).
			next(function(html) {
				var $html = $(html);
				var large_url = $html.find('#photo img').attr('src');
				$html.length = 0;
				$html = null;
				if (large_url) {
					loadImage({
						url: self.url,
						large_url: large_url,
						urlItem: self
					});
				} else {
					self.status = 'ignored';
					lscache.set('url-' + url, self);
				}
			});
			return;
		}

		var result = url.match(flickr_re);
		if (result) {
			Ripple.ajax.get(url).
			next(function(html) {
				function createPhotoURL(size) {
					var url;
					if (size.secret) {
						url = base_url.replace(/_.*\.jpg$/, '_' + size.secret + size.fileExtension + '.jpg');
					} else {
						url = base_url.replace(/\.jpg$/, size.fileExtension + '.jpg');
					}
					if (size.queryString) {
						url += size.queryString;
					}
					return url;
				}
				var result = html.match(/baseURL: '(\S+)',/);
				var base_url = result && result[1];
				var result = html.match(/sizeMap: (\[[^\]]+\])/);
				var size_map = result && JSON.parse(result[1]);
				var size_t = size_map[0];
				var size_l = size_map.reverse()[0];
				var large_url = createPhotoURL(size_l);
				var thumbnail_url = createPhotoURL(size_t);
				if (large_url) {
					loadImage({
						url: self.url,
						large_url: large_url,
						thumbnail_url: thumbnail_url,
						urlItem: self
					});
				} else {
					self.status = 'ignored';
					lscache.set('url-' + url, self);
				}
			});
			return;
		}

		var result = picture_re.test(url);
		if (result) {
			loadImage({
				url: self.url,
				large_url: url,
				urlItem: self
			});
		}
	}

	UrlItem.prototype.call = function() {
		var callback;
		while (callback = this.callbacks.shift()) {
			callback();
		}
	}

	UrlItem.prototype.done = function(callback) {
		if (this.status === 'ignored')
			return;
		if (this.status === 'error') {
			this.fetch();
		}
		if (this.status === 'loading') {
			this.callbacks.push(callback);
		} else if (this.status === 'completed') {
			setTimeout(callback);
		}
	}

	function process(status, url_item) {
		status.urlProcessed = true;
		if (! url_item.data) return;
		var data = url_item.data;
		processPhoto(status, {
			largeurl: data.url,
			thumburl: data.thumbnail_url,
			width: data.width,
			height: data.height
		});
	}

	function loadImage(options) {
		var url_item = options.urlItem;
		var url = options.thumbnail_url || options.large_url;
		getNaturalDimentions(url, function(dimentions) {
			url_item.data = {
				url: options.large_url,
				width: dimentions.width,
				height: dimentions.height,
				type: 'photo',
				thumbnail_url: options.thumbnail_url
			};
			url_item.status = 'completed';
			lscache.set('url-' + options.url, url_item);
			setTimeout(function() {
				url_item.call();
			});
		});
	}

	var instagram_re = /https?:\/\/(instagram\.com|instagr.am)\/p\/[a-zA-Z0-9_]+\//;
	var pinsta_re = /https?:\/\/pinsta\.me\/p\/([a-zA-Z0-9_]+)/;
	var weibo_re = /https?:\/\/[w0-9]+\.sinaimg\.cn\/\S+\.jpg/;
	var imgly_re = /https?:\/\/img\.ly\//;
	var lofter_re = /\.lofter\.com\/post\/[a-zA-Z0-9_]+/;
	var imgur_re = /imgur\.com\//;
	var tinypic_re = /tinypic\.com\//;
	var fanfou_re = /https?:\/\/fanfou\.com\/photo\//;
	var flickr_re = /https?:\/\/(?:www\.)?flickr\.com\/photos\//;
	var picture_re = /\.(?:jpg|jpeg|png|gif|webp)(?:\??\S*)?$/i;

	var photo_res = [
		instagram_re,
		pinsta_re,
		weibo_re,
		imgly_re,
		lofter_re,
		imgur_re,
		tinypic_re,
		fanfou_re,
		flickr_re,
		picture_re
	];

	function isPhotoLink(url) {
		return photo_res.some(function(re) {
				return re.test(url);
			});
	}

	function setLink($link, url) {
		$link.prop('title', url);
		$link.prop('href', url);
		var display_url = url.replace(/^https?:\/\/(?:www\.)?/, '');
		if (display_url.length > 25) {
			display_url = display_url.substring(0, 25) + '...';
		}
		$link.text(display_url);
	}

	return function(status) {
		if (status.urlProcessed)
			return;
		short_url_re = PREFiX.shortUrlRe || short_url_re;
		var urls = [];
		var result;
		while (result = url_re.exec(status.text)) {
			urls.push(result[1]);
		}
		if (! urls.length)
			return;
		urls.forEach(function(url) {
			if (! url.split('/')[3]) return;
			if (fanfou_url_re.test(url)) {
				var text = status.fixedText;
				$temp.html(text);
				var $link = $temp.find('[href="' + url + '"]');
				if ($link.length) {
					var text = $link.text();
					if (/^http:\/\//.test(text)) {
						setLink($link, url)
						status.fixedText = $temp.html();
					}
				}
				if (! fanfou_re.test(url))
					return;
			}
			var is_url = url_re.test(url);
			var is_photo_link = isPhotoLink(url) || is_url;
			if (! is_photo_link) return;
			var cached, url_item;
			lib.some(function(url_item) {
				if (url_item.url === url) {
					cached = url_item;
					return true;
				}
			});
			var ls_cached = lscache.get('url-' + url);
			cached = cached || ls_cached;
			if (cached) {
				cached.__proto__ = UrlItem.prototype;
				cached.done(function() {
					process(status, cached);
				});
				url_item = cached;
			} else {
				url_item = new UrlItem(url);
				url_item.done(function() {
					process(status, url_item);
				});
			}
			if (is_url) {
				setTimeout(function() {
					waitFor(function() {
						return url_item.longUrl;
					}, function() {
						var text = status.fixedText;
						$temp.html(text);
						var $link = $temp.find('[href="' + url_item.url + '"]');
						setLink($link, url_item.longUrl)
						status.fixedText = $temp.html();
					});
				});
			}
		});
	}
})();

var cached_res = { };
function prepareRE(str) {
	if (cached_res[str]) {
		return cached_res[str];
	}
	var re = /^\/(\S+)\/([igm]*)$/;
	if (re.test(str)) {
		var result = str.match(re);
		re = new RegExp(result[1], result[2] || '');
	} else {
		re = new RegExp(
			str.
			replace(/(\.|\||\+|\{|\}|\[|\]|\(|\)|\\)/g, '\\$1').
			replace(/\?/g, '.').
			replace(/\*/g, '.*'),
			'i'
		);
	}
	cached_res[str] = re;
	return re;
}

function filterOut(status) {
	if (status.is_self) {
		status.filtered_out = false;
		return;
	}
	settings.current.filters.some(function(filter) {
		var re = prepareRE(filter.pattern);
		var str = '';
		switch (filter.type) {
			case 'id':
				str = (status.user || status.sender).id;
				break;
			case 'name':
				str = (status.user || status.sender).name;
				break;
			case 'content':
				str = status.fixedText;
				break;
			case 'client':
				str = status.source;
				break;
		}
		var result = re.test(str);
		status.filtered_out = result;
		return result;
	});
}

function filterOutAllLists() {
	var lists = [
		PREFiX.homeTimeline,
		PREFiX.mentions,
		PREFiX.privatemsgs
	];
	lists.forEach(function(list) {
		[ 'buffered', 'statuses', 'messages' ].forEach(function(type) {
			if (! list[type]) return;
			list[type] = list[type].filter(function(status) {
				filterOut(status);
				return ! status.filtered_out;
			});
		});
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
			initStreamingAPI();
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
	stopStreamingAPI();
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
		current: '',
		is_replying: false
	};
	PREFiX.mentions = { 
		statuses: [],
		scrollTop: 0,
		current: '',
		is_replying: false
	};
	PREFiX.privatemsgs = { 
		messages: [],
		scrollTop: 0,
		current: '',
		is_replying: false
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

	initUrlExpand();

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
	var notification = Notifications.createNotification(options.icon || '/icons/40.png',
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

Ripple.events.observe('process_status', function(status) {
	if (! status) return;

	if (status.user) {
		status.is_self = status.user.id === PREFiX.account.id;
	} else if (status.sender) {
		status.is_self = status.sender.id === PREFiX.account.id;
	} else if (status.sender_id) {
		status.is_self = status.sender_id === PREFiX.account.id;
	}

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
		status.is_breakpoint = false;
		status.loaded_at = null;
		status.loaded_at_relative = '';
	}

	if (status.user) {
		status.user.created_at_ymd = getYMD(status.user.created_at);
	}

	var html = status.text;
	$temp.html(html);
	status.textWithoutTags = $temp.text();
	html = jEmoji.softbankToUnified(html);
	html = jEmoji.googleToUnified(html);
	html = jEmoji.docomoToUnified(html);
	html = jEmoji.kddiToUnified(html);
	html = jEmoji.unifiedToHTML(html);

	html = html.replace(/@\n/g, '@');
	html = html.replace(/\s*\n+\s*/g, '<br />');

	var mention_re = /<a href="http:\/\/fanfou\.com\/([^"]+)" class="former">([^<]+)<\/a>/gi;
	html = html.replace(mention_re, function(_, id, name) {
		return '<a href="http://fanfou.com/' + id +
			'" title="@' + name + ' (' + id +
			')" data-userid="' + id + '">' + name + '</a>';
	});

	if (status.sender) {
		// 私信, 由于饭否的 API 返回的 direct_message 对象没有
		// 自动转换 URL 为超链接的参数, 所以手动转换一下
		html = html.replace(url_re, function(url) {
			return '<a href="' + url + '" title="' +
				url + '" rel="nofollow" target="_blank">' +
				url + '</a>';
		});
	}

	// 转发或回复的消息显示查看上下文的按钮
	if (status.repost_status || status.in_reply_to_status_id) {
		html += '<span class="context" title="查看上下文消息 (快捷键 C)"></span>';
	}

	status.fixedText = html;

	status.current_replied = false;

	if (status.photo) {
		processPhoto(status, status.photo);
	} else {
		status.photo = {
			largeurl: '',
			imageurl: '',
			thumburl: '',
			url: '',
			thumb_height: '',
			thumb_width: ''
		};

	}

	enrichStatus(status);

	if (status.repost_status) {
		arguments.callee.call(this, status.repost_status);
	}

	filterOut(status);
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
		smoothScroll: ! is_mac,
		birthdayNotice: true,
		birthdayNoticeType: 'only_friends',
		birthdayGreetingType: 'post_status',
		autoFlushCache: false,
		cacheAmount: 75,
		zoomRatio: '1',
		drawAttention: ! is_mac,
		showSavedSearchCount: true,
		createPopAtStartup: false,
		volume: .75,
		holdCtrlToSubmit: false,
		notification: true,
		notif_mention: true,
		notif_privatemsg: true,
		notif_follower: true,
		notif_friendreq: false,
		notif_favourite: true,
		repostFormat: '转@$name$ $text$',
		newlineAfterMyName: true,
		filters: [
			{ pattern: '街旁', type: 'client' }
		],
		flushCacheWhenTop: true
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
		batchProcess(function(view) {
			view.filterOutAllLists && view.filterOutAllLists();
		});
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
	'',
	'如果您希望删除消息或私信, 请<b>双击</b>删除图标. ',
	'您可以在设置页开启浏览器启动时自动打开 PREFiX 窗口功能. ',
	'',
	'如果您觉得提示音音量过大, 可以在设置页调整音量. ',
	'您可以使用 Vim 风格的快捷键操作 PREFiX, 详见设置页. ',
	'您可以在扩展管理页面末端给 PREFiX 设置快捷键, 从而使用快捷键直接打开 PREFiX 页面. ',
	'如果您发现 PREFiX 启动时容易卡顿, 建议开启自动抛弃缓存功能, 并设置保留在缓存中的最大消息数量. ',
	'将鼠标指针放在饭友名字后面的 # 上时, 可以查看消息的完整发布时间, 点击将打开消息在饭否的页面. ',
	'如果您习惯使用双击选中文本, 请在设置页中开启 "只有按住 Ctrl / Command 键才能双击输入框发送消息". ',
	'如果您希望查看完整的使用技巧, 参见设置页. ',
	'如果您希望旋转图片, 请按快捷键 R 键. ',
	'点击用户名在应用内打开个人消息页面, 点击头像打开该用户的饭否个人页面. ',
	'您可以自由定义转发时消息的格式, 详见设置页. ',
	'您可以在设置页中设置过滤消息的规则, 也可以按住 Shift 键右击用户头像来屏蔽 TA. ',
	'点击链接 (或回车) 时按住 Shift 键在前台标签页打开, 否则为后台标签页. '
];

var PREFiX = this.PREFiX = {
	version: chrome.app.getDetails().version,
	is_mac: is_mac,
	load: load,
	unload: unload,
	initialize: initialize,
	reset: reset,
	update: update,
	getNotification: getNotification,
	streamingAjax: null,
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
		current: '',
		is_replying: false
	},
	mentions: { 
		statuses: [],
		scrollTop: 0,
		current: '',
		is_replying: false
	},
	privatemsgs: { 
		messages: [],
		scrollTop: 0,
		current: '',
		is_replying: false
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