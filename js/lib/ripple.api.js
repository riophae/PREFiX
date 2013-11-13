/**
 * 饭否 API Version 1.0
 * https://github.com/FanfouAPI/FanFouAPIDoc/wiki/Apicategory
 *
 * @lastModified 		2012/4/20 09:00
 */


(function(R) {

	R.config({
		baseAPIUrl: 'http://api.fanfou.com/',
		OAuthVersion: '1.0',
		htmlMode: true, // status 以 HTML 格式返回
		liteMode: true // status 对象不含有 profile 信息
	});

	var H = R.helpers,
			E = R.events,
			G = R.getConfig,
			N = R.registerAPI;

	function completeStatusParams(params) {
		params = params || {};
		if (G('liteMode')) {
			params.mode = params.mode || 'lite';
		}
		if (G('htmlMode')) {
			params.format = params.format || 'html';
		}
		return params;
	}

	function processStatus(event_type, status) {
		var event = { actionType: event_type };
		status = E.triggerWith(this, 'process_status', status, event);
		status = E.triggerWith(this, event_type, status, event);
		return status;
	}

	function processStatuses(event_type, statuses) {
		for (var i = 0, len = statuses.length; i < len; i++) {
			statuses[i] = processStatus.call(this, event_type, statuses[i]);
		}
		return statuses;
	}

	function _processStatus(status, event) {
		return processStatus.call(this, event.actionType, status);
	}

	function _processStatuses(statuses, event) {
		return processStatuses.call(this, event.actionType, statuses);
	}

	function idReplacer(url, params) {
		return url.replace('{:id}', params.id);
	}


	/* Statuses */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.update
	N({
		name: 'postStatus',
		action: 'statuses/update',
		method: 'POST',
		argsProcessor: completeStatusParams
	}, { success: _processStatus });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.destroy
	N({
		name: 'destroyStatus',
		action: 'statuses/destroy',
		method: 'POST',
		argsProcessor: completeStatusParams
	}, { success: _processStatus });

	N({
		name: 'replyStatus',
		packer: function(params) {
			var reply = {
				status: params.status,
				in_reply_to_status_id: params.statusId,
				in_reply_to_user_id: params.userId
			};
			var ajax_options = {
				success: function(status) {
					return processStatus('reply_status', status);
				}
			};
			return this.postStatus(reply).setupAjax(ajax_options);
		}
	});

	N({
		name: 'repostStatus',
		packer: function(params) {
			var repost = {
				status: params.status,
				repost_status_id: params.statusId
			};
			var ajax_options = {
				success: function(status) {
					return processStatus('repost_status', status);
				}
			};
			return this.postStatus(repost).setupAjax(ajax_options);
		}
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.show
	N({
		name: 'showStatus',
		action: 'statuses/show',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatus });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.mentions
	N({
		name: 'getMentions',
		action: 'statuses/mentions',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.replies
	N({
		name: 'getReplies',
		action: 'statuses/replies',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.home-timeline
	N({
		name: 'getHomeTimeline',
		action: 'statuses/home_timeline',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.user-timeline
	N({
		name: 'getUserTimeline',
		action: 'statuses/user_timeline',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.context-timeline
	N({
		name: 'getContextTimeline',
		action: 'statuses/context_timeline',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.public-timeline
	N({
		name: 'getPublicTimeline',
		action: 'statuses/public_timeline',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.friends
	N({
		name: 'getFriendList',
		action: 'statuses/friends',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/statuses.followers
	N({
		name: 'getFollowerList',
		action: 'statuses/followers',
		method: 'GET',
		argsProcessor: completeStatusParams
	});


	/* Photos */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/photos.upload
	N({
		name: 'postPhoto',
		action: 'photos/upload',
		method: 'POST',
		argsProcessor: completeStatusParams
	}, {
		urlEncoded: false,
		success: _processStatus
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/photos.user-timeline
	N({
		name: 'getPhotoTimeline',
		action: 'photos/user_timeline',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });


	/* Direct Messages */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/direct-messages.new
	N({
		name: 'postDirectMessage',
		action: 'direct_messages/new',
		method: 'POST',
		argsProcessor: completeStatusParams
	}, { success: _processStatus });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/direct-messages.destroy
	N({
		name: 'destroyDirectMessage',
		action: 'direct_messages/destroy',
		method: 'POST'
	}, { success: _processStatus });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/direct-messages.inbox
	N({
		name: 'showInbox',
		action: 'direct_messages/inbox',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/direct-messages.sent
	N({
		name: 'showOutbox',
		action: 'direct_messages/sent',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/direct-messages.conversation
	N({
		name: 'showDirectMessageConversation',
		action: 'direct_messages/conversation',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/direct-messages.conversation-list
	N({
		name: 'getDirectMessageConversationList',
		action: 'direct_messages/conversation_list',
		method: 'GET',
		argsProcessor: completeStatusParams
	});


	/* Friends */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friends.ids
	N({
		name: 'getFriendIdList',
		action: 'friends/ids',
		method: 'GET'
	});


	/* Followers */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/followers.ids
	N({
		name: 'getFollowerIdList',
		action: 'followers/ids',
		method: 'GET'
	});


	/* Friendships */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friendships.create
	N({
		name: 'addFriend',
		action: 'friendships/create',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friendships.destroy
	N({
		name: 'removeFriend',
		action: 'friendships/destroy',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friendships.accept
	N({
		name: 'acceptFriend',
		action: 'friendships/accept',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friendships.deny
	N({
		name: 'rejectFriend',
		action: 'friendships/deny',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friendships.exists
	N({
		name: 'isFollowing',
		action: 'friendships/exists',
		method: 'GET',
		argsProcessor: function(a, b) {
			var params = {
				user_a: a,
				user_b: b
			};
			return params;
		}
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friendships.requests
	N({
		name: 'getFriendRequests',
		action: 'friendships/requests',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/friendships.show
	N({
		name: 'showRelationship',
		action: 'friendships/show',
		method: 'GET'
	});

	N({
		name: 'showRelationshipById',
		packer: function(source, target) {
			var params = {
				source_id: source,
				target_id: target
			};
			return this.showRelationship(params);
		}
	});

	N({
		name: 'showRelationshipByLoginName',
		packer: function(source, target) {
			var params = {
				source_login_name: source,
				target_login_name: target
			};
			return this.showRelationship(params);
		}
	});

	/* Blocks */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/blocks.create
	N({
		name: 'createBlock',
		action: 'blocks/create',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/blocks.destroy
	N({
		name: 'destroyBlock',
		action: 'blocks/destroy',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/blocks.exists
	N({
		name: 'isBlocking',
		action: 'blocks/exists',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/blocks.blocking
	N({
		name: 'getBlockingList',
		action: 'blocks/blocking',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/blocks.ids
	N({
		name: 'getBlockingIdList',
		action: 'blocks/ids',
		method: 'GET',
		argsProcessor: completeStatusParams
	});


	/* Favorites */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/favorites
	N({
		name: 'getFavorites',
		action: 'favorites/{:id}',
		method: 'GET',
		argsProcessor: function(params) {
			params.id = params.id || this.id;
			return completeStatusParams(params);
		},
		urlProcessor: idReplacer
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/favorites.create
	N({
		name: 'addFavorite',
		action: 'favorites/create/{:id}',
		method: 'POST',
		argsProcessor: completeStatusParams,
		urlProcessor: idReplacer
	}, { success: _processStatus });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/favorites.destroy
	N({
		name: 'removeFavorite',
		action: 'favorites/destroy/{:id}',
		method: 'POST',
		argsProcessor: completeStatusParams,
		urlProcessor: idReplacer
	}, { success: _processStatus });


	/* Trends */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/trends.list
	N({
		name: 'getTrends',
		action: 'trends/list',
		method: 'GET'
	});


	/* Search */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/search.public-timeline
	N({
		name: 'searchPublicTimeline',
		action: 'search/public_timeline',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/search.user-timeline
	N({
		name: 'searchUserTimeline',
		action: 'search/user_timeline',
		method: 'GET',
		argsProcessor: completeStatusParams
	}, { success: _processStatuses });

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/search.users
	N({
		name: 'searchUser',
		action: 'search/users',
		method: 'GET'
	});


	/* Saved Searches */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/saved-searches.show
	N({
		name: 'showSavedSearch',
		action: 'saved_searches/show',
		method: 'GET'
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/saved-searches.list
	N({
		name: 'getSavedSearches',
		action: 'saved_searches/list',
		method: 'GET'
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/saved-searches.destroy
	N({
		name: 'destroySavedSearch',
		action: 'saved_searches/destroy',
		method: 'POST'
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/saved-searches.create
	N({
		name: 'createSavedSearch',
		action: 'saved_searches/create',
		method: 'POST'
	});


	/* Users */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/users.show
	N({
		name: 'showUser',
		action: 'users/show',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/users.tag-list
	N({
		name: 'getTagList',
		action: 'users/tag_list',
		method: 'GET'
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/users.friends
	N({
		name: 'getLatestLoggedFriends',
		action: 'users/friends',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/users.followers
	N({
		name: 'getLatestLoggedFollowers',
		action: 'users/followers',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/users.cancel-recommendation
	N({
		name: 'cancelRecommendation',
		action: '2/users/cancel_recommendation',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/users.recommendation
	N({
		name: 'getRecommendations',
		action: '2/users/recommendation',
		method: 'GET',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/users.tagged
	N({
		name: 'getTaggedUsers',
		action: 'users/tagged',
		method: 'GET',
		argsProcessor: completeStatusParams
	});


	/* Account */

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/account.notification
	N({
		name: 'getNotification',
		action: 'account/notification',
		method: 'GET'
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/account.rate-limit-status
	N({
		name: 'getRateLimit',
		action: 'account/rate_limit_status',
		method: 'GET'
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/account.update-profile
	N({
		name: 'updateProfile',
		action: 'account/update_profile',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/account.update-profile-image
	N({
		name: 'updateAvatar',
		action: 'account/update_profile_image',
		method: 'POST',
		argsProcessor: function(params) {
			if (! H.isObject(params)) {
				params = { image: params };
			}
			completeStatusParams(params);
			return params;
		}
	}, { urlEncoded: false });

	//https://github.com/FanfouAPI/FanFouAPIDoc/wiki/account.notify-num
	N({
		name: 'getNotifyNum',
		action: 'account/notify_num',
		method: 'GET'
	});

	//https://github.com/FanfouAPI/FanFouAPIDoc/wiki/account.update-notify-num
	N({
		name: 'updateNotifyNum',
		action: 'account/update_notify_num',
		method: 'POST'
	});

	// https://github.com/FanfouAPI/FanFouAPIDoc/wiki/account.verify-credentials
	N({
		name: 'verify',
		action: 'account/verify_credentials',
		method: 'POST',
		argsProcessor: completeStatusParams
	});

})(Ripple);