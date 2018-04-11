var currentCamera;
var refreshFlag = false;
var imageLoaded = false;
var newCam = true;
var firstTime = true;
var logLength = 0;
var IPlocation;
//connect to socket.io server
var socket = io();
var socketObj = socket.connect('http://localhost:1');

//when socket connects
socket.on("connect",function(){
	console.log(socketObj.id);
	socket.on('fail', function (message) {
  		console.log(message);
  		logLength++;
  		$('.log .log_elements').last().append('<p onclick="$(\'.log .link-'+logLength+'\').fadeToggle();" class="log_item">skipping dead link </p> <span style="display:none;" class=" link link-'+logLength+'">'+message.urlFull+'</span>')
	});
	loadRandom();
})


//load a random cam
function loadRandom() {

	if (newCam){
		$('.log').last().append('<div class="log_elements">');
		$('.log .log_elements').last().append('<p class="log_item no_click">looking for camera...</p>')
		if (firstTime){
			firstTime = false;
		}else{
			scrollSmoothToBottom($('.log'));
		}
		newCam = false;
	};

	$.ajax({
		type: 'GET',
		url: 'api/random?id='+socketObj.id,
		success: function(data){
			imageLoaded = false;

			console.log(data);
			currentCamera = data;

			//setup info
			$('.score-amount')[0].innerHTML = (data.upvotes - data.downvotes) + getRandomInt(1,3);
			$('.info .views')[0].innerHTML = data.views + ' views';
			//calculate downtime
			if (data.reports == 0) {
				$('.info .reports')[0].innerHTML = '0% downtime';
			} else {
				$('.info .reports')[0].innerHTML = Math.round((data.reports/data.views)*100) + '% downtime';
			}
			
			//set image src
			$('.cam .video img')[0].src = data.urlFull;

			//log
			logLength++;
			$('.log .log_elements').last().append('<p onclick="$(\'.log .link-'+logLength+'\').fadeToggle();" class="log_item">found camera</p> <span style="display:none;" class=" link link-'+logLength+'">'+data.urlFull+'</span>')


			//change vote buttons
			if (currentCamera.vote == 'upvote'){
				$('.score .upvote').addClass('voted');
			}else{
				if (currentCamera.vote == 'downvote'){
					$('.score .downvote').addClass('voted');
				}else{
					$('.score .upvote').removeClass('voted');
					$('.score .downvote').removeClass('voted');
				}
			}


			//get location
			var urlinfo = new URL(data.urlFull);
			$.ajax({
				type: 'GET',
				url: 'https://api.ipinfodb.com/v3/ip-city/?key=e29b04eb4855182960b55e3784dc53ef7b68cc1317aae711a0453f5e15853fb5&ip='+urlinfo.hostname+'&format=json',
				success: function(data){
					console.log(data);
					IPlocation = data;
					$('.location')[0].innerHTML = data.cityName + ', ' + data.regionName + ', ' + data.countryName;
					startMap();
				}
			})


			//start refresh timer
			if (!refreshFlag){
				refresh();
			}

			//if image doesnt load in 7 seconds
			setTimeout(function() {
				if (!imageLoaded){
					console.log('ERROR');
					$('.loader_container').show();
					$('.cam .video img')[0].src = 'img/blank.gif';
					loadRandom();
				}
			},7000)

		},
		error: function(data) {
			console.log('GET api/random failed');
			console.log(data);
			loadRandom();
		}
	});
};


//add listener for upvote button
$('.score .upvote')[0].onclick = function() {

	if ($('.score .upvote').hasClass('voted')){
		$.ajax({
		type: 'POST',
		url: 'api/unvote?uuid='+currentCamera._id
		})
	}else{
		$.ajax({
			type: 'POST',
			url: 'api/upvote?uuid='+currentCamera._id
		})
	}
	$('.score .upvote').toggleClass('voted');

}

//add listener for downvote button
$('.score .downvote')[0].onclick = function() {

	if ($('.score .downvote').hasClass('voted')){
		$.ajax({
		type: 'POST',
		url: 'api/unvote?uuid='+currentCamera._id
		})
	}else{
		$.ajax({
			type: 'POST',
			url: 'api/downvote?uuid='+currentCamera._id
		})
	}
	$('.score .downvote').toggleClass('voted');

}

//manual refresh for images
function refresh() {
	refreshFlag = true;
	
	var tempUrl = new URL(currentCamera.urlFull);
	tempUrl.searchParams.append('c4COUNTER',Math.round((new Date()).getTime() / 1000));
	$('.cam .video img')[0].src = tempUrl.href;
	$('.loader_container #loader').css('left',($('.video .img')[0].clientWidth/2)-20);
	$('.loader_container #loader').css('top',($('.video .img')[0].clientHeight/2)-40);
	setTimeout(function(){
		refresh();
	},Math.round((currentCamera.time+1500)/3000)*3000);
}


$('.cam .video img')[0].onload = function(a) {
	if (!imageLoaded){
		//scroll log, hide old logs
		logLength++;
		$('.log .log_elements').last().append('<p onclick="$(\'.log .link-'+logLength+'\').fadeToggle();" class="log_item">connected to camera</p> <span style="display:none;" class=" link link-'+logLength+'">'+currentCamera.urlFull+'</span>')
		scrollSmoothToBottom($('.log'));

	}

	imageLoaded = true;
	newCam = true;
	$('.loader_container').hide();
	$('.cam .video').css('width',a.clientWidth);
	$('.cam .score_container').css('width',a.clientWidth);

}

$('.cam .video img')[0].onerror = function(a) {
	console.log('ERROR')
	$('.loader_container').show();
	$('.cam .video img')[0].src = 'img/blank.gif';
	loadRandom();
}


$('.location.expand')[0].onclick = function(a) {

	if ($('#map').is(":visible")){
		$('.location.expand')[0].innerHTML = 'hide map'
	}else{
		$('.location.expand')[0].innerHTML = 'show on map'
	}

	$('#map').slideToggle();
}






//scroll log helper function
//https://stackoverflow.com/a/33193694/6088533
function scrollSmoothToBottom (id) {
   id.animate({
      scrollTop: id[0].scrollHeight - id[0].clientHeight
   }, 500);
}


//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}





var map;
var infowindow;

function initMap(){
	//empty function to catch map loading
}

//handle map
function startMap() {
	var IPlatlng = {lat: parseInt(IPlocation.latitude), lng: parseInt(IPlocation.longitude)};

	map = new google.maps.Map(document.getElementById('map'), {
		center: IPlatlng,
		zoom: 13,
		styles: [
		  {elementType: 'geometry', stylers: [{color: '#242f3e'}]},
		  {elementType: 'labels.text.stroke', stylers: [{color: '#242f3e'}]},
		  {elementType: 'labels.text.fill', stylers: [{color: '#746855'}]},
		  {
		    featureType: 'administrative.locality',
		    elementType: 'labels.text.fill',
		    stylers: [{color: '#d59563'}]
		  },
		  {
		    featureType: 'poi',
		    elementType: 'labels.text.fill',
		    stylers: [{color: '#d59563'}]
		  },
		  {
		    featureType: 'poi.park',
		    elementType: 'geometry',
		    stylers: [{color: '#263c3f'}]
		  },
		  {
		    featureType: 'poi.park',
		    elementType: 'labels.text.fill',
		    stylers: [{color: '#6b9a76'}]
		  },
		  {
		    featureType: 'road',
		    elementType: 'geometry',
		    stylers: [{color: '#38414e'}]
		  },
		  {
		    featureType: 'road',
		    elementType: 'geometry.stroke',
		    stylers: [{color: '#212a37'}]
		  },
		  {
		    featureType: 'road',
		    elementType: 'labels.text.fill',
		    stylers: [{color: '#9ca5b3'}]
		  },
		  {
		    featureType: 'road.highway',
		    elementType: 'geometry',
		    stylers: [{color: '#746855'}]
		  },
		  {
		    featureType: 'road.highway',
		    elementType: 'geometry.stroke',
		    stylers: [{color: '#1f2835'}]
		  },
		  {
		    featureType: 'road.highway',
		    elementType: 'labels.text.fill',
		    stylers: [{color: '#f3d19c'}]
		  },
		  {
		    featureType: 'transit',
		    elementType: 'geometry',
		    stylers: [{color: '#2f3948'}]
		  },
		  {
		    featureType: 'transit.station',
		    elementType: 'labels.text.fill',
		    stylers: [{color: '#d59563'}]
		  },
		  {
		    featureType: 'water',
		    elementType: 'geometry',
		    stylers: [{color: '#17263c'}]
		  },
		  {
		    featureType: 'water',
		    elementType: 'labels.text.fill',
		    stylers: [{color: '#515c6d'}]
		  },
		  {
		    featureType: 'water',
		    elementType: 'labels.text.stroke',
		    stylers: [{color: '#17263c'}]
		  }
		]
	});

};