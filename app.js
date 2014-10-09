var app = angular.module("hnpureApp", ["firebase", "ngRoute", "ngSanitize"]);
var URL = "https://hacker-news.firebaseio.com/v0/";

app.factory("StoryFactory", ["$FirebaseObject", "$q", "StoryList", "Story", function($FirebaseObject, $q, StoryList, Story) {
	return $FirebaseObject.$extendFactory({
    	getHostname: function() {
    		var a = document.createElement('a');
    		a.href = this.url;
    		return a.hostname;
    	},
    	getDuration: function() {
    		var tPs = Math.round(((new Date().getTime())/1000) - this.time);
    		var tPm = Math.round(tPs/60);
    		return humanizeDuration(tPm * 60 * 1000,
    			{
    				units: ["years", "months", "days", "hours", "minutes"],
    				delimiter: ", "
    			});
    	},
    	getKidsList: function() {
    		return StoryList(this.$inst().$ref().child('kids'));
    	}
    });
}]);

app.factory("Story", ["$firebase", "$FirebaseObject",
	function($firebase, $FirebaseObject) {
		return function(itemId) {
			var ref = new Firebase(URL).child('item');
			return $firebase(ref.child(itemId), {objectFactory: "StoryFactory"}).$asObject();
		}
	}
]);


app.factory("StoryItem", ["Story", "$firebaseUtils",
	function(Story, $firebaseUtils) {
		
		function StoryItem(snap) {
			this.$id = snap.name();
			this.update(snap);
		}
		
		StoryItem.prototype = {
			update: function(snap) {
				this.data = Story(snap.val());
			},
			toJSON: function() {
				return $firebaseUtils.toJSON(this.data);
			}
		};

		return StoryItem;
	}
]);

app.factory("StoryListFactory", ["$FirebaseArray", "StoryItem",
	function($FirebaseArray, StoryItem) {
		return $FirebaseArray.$extendFactory({
			$createObject: function(snap) {
				return new StoryItem(snap);
			},
			$$added: function(snap, prev) {
				var item = new StoryItem(snap);
				this._process('child_added', item, prev);
			},
			$$updated: function(snap, prev) {
				var rec = this.$getRecord(snap.name());
				rec.update(snap);
		    	this._process('child_changed', rec, prev);
		    }
		});
	}
]);

app.factory("StoryList", ["$firebase",
	function($firebase) {
		return function(ref) {
			return $firebase(ref, {arrayFactory: "StoryListFactory"}).$asArray();
		}
	}
]);

app.controller("MainController", ["$scope", "$route", "$location", "$routeParams",
	function($scope, $route, $location, $routeParams) {
		$scope.$route = $route;
	    $scope.$location = $location;
	    $scope.$routeParams = $routeParams;
	}
]);

app.controller("TopStoriesController", ["$scope", "$routeParams", '$q', "$timeout", 'StoryList',
	function($scope, $routeParams, $q, $timeout, StoryList) {
		var ref = new Firebase(URL).child('topstories');
		StoryList(ref).$loaded(function(data) {
			var promises = data.map(function(item) {
				return item.data.$loaded();
			});
			$q.all(promises).then(function() {
				$timeout(function() {
					$scope.data = data;
					$scope.hideSpinner = true;
				});
			});
		});
	}
]);

app.controller("ThreadController", ["$scope", "$routeParams", '$q', "$timeout", 'Story',
	function($scope, $routeParams, $q, $timeout, Story) {
		console.log($routeParams);
		Story($routeParams.itemId).$loaded(function(data) {
			data.getKidsList().$loaded(function(kids) {
				var promises = kids.map(function(child) {
					return child.data.$loaded();
				});
				$q.all(promises).then(function() {
					$timeout(function() {
						$scope.story = {
							"data": data,
							"comments": kids
						};
						$scope.hideSpinner = true;
					});
				});
			});
		});
	}
]);

app.config(function($routeProvider, $locationProvider) {
  $routeProvider
  .when('/thread/:itemId', {
    templateUrl: 'tpl/thread.html',
    controller: 'ThreadController'
  })
  .otherwise({
    templateUrl: 'tpl/topstories.html',
    controller: 'TopStoriesController'
  });

  // configure html5 to get links working on jsfiddle
  //$locationProvider.html5Mode(true);
});
