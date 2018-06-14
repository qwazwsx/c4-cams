var currentCamera;
var refreshFlag = false;
var imageLoaded = false;
var firstTime = true;
var fullLogging = false; //false = hide logs after new cam, true = never hide logs
var logLength = 0;
var IPlocation;



var embed = false;
var error = false

//hide elements
$('.score_container').css('opacity', 0);
$('.location').css('opacity', 0);
$('.info_container').css('opacity', 0);
$('.share')[0].disabled = true;
$('.error_container').hide();

//if in an iframe
if (window != top){
	//hide top
	$('.header').hide();
	$('body').css('overflow','hidden');
	$('body').css('background','none transparent');
	embed = true;
};



//load a cam
function load() {
	$.ajax({
		type: 'POST',
		url: '/c4-cams/api/find?type=0&query='+window.location.hash.replace('#',''),
		success: function(data){
			imageLoaded = false;

			currentCamera = data;

			//setup info
			$('.score-amount')[0].innerHTML = (data.upvotes - data.downvotes) + getRandomInt(1,2);
			$('.info .views')[0].innerHTML = data.views + ' views';
			//calculate downtime
			if (data.reports == 0) {
				$('.info .reports')[0].innerHTML = '0% downtime';
			} else {
				$('.info .reports')[0].innerHTML = Math.round(((data.reports / 0.2) / data.views) * 100) + '% downtime';
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
				url: 'https://extreme-ip-lookup.com/json/'+urlinfo.hostname,
				success: function(data){

					IPlocation = data;
					$('.location')[0].innerHTML = "";

					if (data.ipType !== "Residential"){
						$('.location')[0].innerHTML += "\"" + data.businessName.replace('<','').replace('>','') + "\" <br> ";
					}

					if (data.city !== ""){
						$('.location')[0].innerHTML += data.city.replace('<','').replace('>','') + ", ";
					}

					if (data.region !== ""){
						$('.location')[0].innerHTML += data.region.replace('<','').replace('>','') + ", ";
					}

					if (data.country !== ""){
						$('.location')[0].innerHTML += data.country.replace('<','').replace('>','');
					}

					startMap();
				},
				error: function() {
					$('.location')[0].innerHTML = "unable to get location;"
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

			$('.cam').fadeOut();
			$('.error_container').fadeIn();

			if (embed){
				window.location.hash = 'error';
			}
			error = true;


		}
	});
};


window.onload = load();



//manual refresh for images
function refresh() {
	if (!error){

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
}


//add listener for upvote button
$('.score .upvote')[0].onclick = function() {

	$('.score .downvote').removeClass('voted');
	if ($('.score .upvote').hasClass('voted')){
		$.ajax({
		type: 'POST',
		url: '/c4-cams/api/unvote?uuid='+currentCamera._id
		});
		$('.score .score-amount')[0].innerHTML = parseInt($('.score .score-amount')[0].innerHTML) - 1;
	}else{
		$.ajax({
			type: 'POST',
			url: '/c4-cams/api/upvote?uuid='+currentCamera._id
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
		url: '/c4-cams/api/unvote?uuid='+currentCamera._id
		});
		$('.score .score-amount')[0].innerHTML = parseInt($('.score .score-amount')[0].innerHTML) + 1;
	}else{
		$.ajax({
			type: 'POST',
			url: '/c4-cams/api/downvote?uuid='+currentCamera._id
		});
		$('.score .score-amount')[0].innerHTML = parseInt($('.score .score-amount')[0].innerHTML) - 1;
	}
	$('.score .downvote').toggleClass('voted');

}



//listener for image load
$('.cam .video img')[0].onload = function(a) {
	//if its the first time
	if (!imageLoaded){

		if (embed && !error){
			//if in iframe signal that cam has loaded
			window.location.hash = "#loaded"
		};

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
	$('.cam .video img')[0].src = '/c4-cams/img/blank.gif';

	$('.error_container .error p')[0].innerHTML = "Camera was found but the link is dead. The camera may have gone offline or moved to a different IP. (see <a href=\"https://redd.it/10ikfz\">dynamic IP addresses</a>)";
	
	if (embed){
		window.location.hash = '#error';
	}
	error = true;

	currentCamera.urlFull = '/c4-cams/img/blank.gif'

	$.ajax({
		type: 'POST',
		url: '/c4-cams/api/report?uuid=' + currentCamera._id,
		success: function(data){

			console.log('reported camera')

		}
	})


	$('.cam').fadeOut();
	$('.error_container').fadeIn();

}



//listener for map show/hide
$('.location.expand')[0].onclick = function(a) {

	if ($('#map').is(":visible")){
		$('.location.expand')[0].innerHTML = 'show on map'
		window.parent.postMessage('map_closed', '*')
	}else{
		$('.location.expand')[0].innerHTML = 'hide map'
		window.parent.postMessage('map_opened', '*')

	}

	$('#map').slideToggle();
}




//on share click
$('.share')[0].onclick = function() {

	if ($('.permaBox').is(":visible")){
		$('.permaBox').slideUp();
	}else{

		$('#permaBoxInner')[0].value = "http://qwazwsx.xyz/perma#" + currentCamera._id;

		$('.permaBox').slideToggle();
		copyTextToClipboard("http://qwazwsx.xyz/perma#" + currentCamera._id)
		toast('permalink copied to clipboard')

	}
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


function toast(text){
	var data = {message: text};
	$('#toast')[0].MaterialSnackbar.showSnackbar(data);
}


//https://codepen.io/Mestika/pen/NxLzNq
function copyTextToClipboard(text) {
  var textArea = document.createElement("textarea");

  textArea.style.position = 'fixed';
  textArea.style.top = 0;
  textArea.style.left = 0;
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = 0;
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
    console.debug('Copying text command was ' + msg);
  } catch (err) {
    console.debug('Oops, unable to copy');
  }
  document.body.removeChild(textArea);
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
	var IPlatlng = {lat: parseInt(IPlocation.lat), lng: parseInt(IPlocation.lon)};

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
