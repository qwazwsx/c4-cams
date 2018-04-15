var currentCamera;
var refreshFlag = false;
var imageLoaded = false;
var firstTime = true;
var fullLogging = false; //false = hide logs after new cam, true = never hide logs
var logLength = 0;
var IPlocation;

console.log('to see debug output enable verbose logging in devtools')


//hide elements
$('.score_container').css('opacity', 0);
$('.location').css('opacity', 0);
$('.info_container').css('opacity', 0);
$('.share')[0].disabled = true;
$('.loader_container .error').hide();


//load a cam
function load() {
	$.ajax({
		type: 'POST',
		url: 'api/find?type=0&query='+window.location.hash.replace('#',''),
		success: function(data){
			imageLoaded = false;

			console.debug(data);
			currentCamera = data;

			//setup info
			$('.score-amount')[0].innerHTML = (data.upvotes - data.downvotes) + getRandomInt(1,2);
			$('.info .views')[0].innerHTML = data.views + ' views';
			//calculate downtime
			if (data.reports == 0) {
				$('.info .reports')[0].innerHTML = '0% downtime';
			} else {
				$('.info .reports')[0].innerHTML = Math.round((data.reports/data.views)*100) + '% downtime';
			}
			
			//set image src
			$('.cam .video img')[0].src = data.urlFull;

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
					console.debug(data);
					IPlocation = data;
					$('.location')[0].innerHTML = data.cityName + ', ' + data.regionName + ', ' + data.countryName;
					startMap();
				}
			})


			//start refresh timer
			if (!refreshFlag){
				refresh();
			}

		},
		error: function(data) {
			console.debug('image loading failed');
			console.debug(data);

			$('#loader').hide();
			$('.error').show();
			$('.loader_container').fadeIn();


		}
	});
};


window.onload = load();



//manual refresh for images
function refresh() {
	refreshFlag = true;
	
	var tempUrl = new URL(currentCamera.urlFull);
	if (tempUrl.searchParams.has('c4-counter')){
		tempUrl.searchParams.set('c4COUNTER', Math.round((new Date()).getTime() / 1000));
		
	}else{
		tempUrl.searchParams.append('c4COUNTER', Math.round((new Date()).getTime() / 1000));
	}
	$('.cam .video img')[0].src = tempUrl.href;

	setTimeout(function(){
		refresh();
	},5000);
}


//add listener for upvote button
$('.score .upvote')[0].onclick = function() {

	$('.score .downvote').removeClass('voted');
	if ($('.score .upvote').hasClass('voted')){
		$.ajax({
		type: 'POST',
		url: 'api/unvote?uuid='+currentCamera._id
		});
		$('.score .score-amount')[0].innerHTML = parseInt($('.score .score-amount')[0].innerHTML) - 1;
	}else{
		$.ajax({
			type: 'POST',
			url: 'api/upvote?uuid='+currentCamera._id
		});
		$('.score .score-amount')[0].innerHTML = parseInt($('.score .score-amount')[0].innerHTML) + 1;
	}
	$('.score .upvote').toggleClass('voted');

}




//add listener for downvote button
$('.score .downvote')[0].onclick = function() {

	$('.score .upvote').removeClass('voted');
	if ($('.score .downvote').hasClass('voted')){
		$.ajax({
		type: 'POST',
		url: 'api/unvote?uuid='+currentCamera._id
		});
		$('.score .score-amount')[0].innerHTML = parseInt($('.score .score-amount')[0].innerHTML) + 1;
	}else{
		$.ajax({
			type: 'POST',
			url: 'api/downvote?uuid='+currentCamera._id
		});
		$('.score .score-amount')[0].innerHTML = parseInt($('.score .score-amount')[0].innerHTML) - 1;
	}
	$('.score .downvote').toggleClass('voted');

}



//listener for image load
$('.cam .video img')[0].onload = function(a) {
	//if its the first time
	if (!imageLoaded){
		//show UI
		$('.score_container').animate({ opacity: 1 });
		$('.location').animate({ opacity: 1 });
		$('.info_container').animate({ opacity: 1 });
		$('.share')[0].disabled = false;
	}

	imageLoaded = true;
	
	$('.loader_container').hide();
	$('.cam .video').css('width',a.clientWidth);
	$('.cam .score_container').css('width',a.clientWidth);

}



//listener for image error
$('.cam .video img')[0].onerror = function(a) {
	console.debug('ERROR - image sent error')
	$('.loader_container').show();
	$('.cam .video img')[0].src = 'img/blank.gif';
}



//listener for map show/hide
$('.location.expand')[0].onclick = function(a) {

	if ($('#map').is(":visible")){
		$('.location.expand')[0].innerHTML = 'hide map'
	}else{
		$('.location.expand')[0].innerHTML = 'show on map'
	}

	$('#map').slideToggle();
}




//on share click
$('.share')[0].onclick = function() {

	$('#permaBoxInner')[0].value = "https://qwazwsx.herokuapp.com/c4-cams/perma#" + currentCamera._id;
	$('.permaBox').slideToggle();
	$('#permaBoxInner')[0].select();

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




//google maps stuff
//dont even bother reading from this point on
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
		zoom: 6,
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