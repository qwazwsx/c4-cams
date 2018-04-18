var currentCamera;
var refreshFlag = false;
var imageLoaded = false;
var firstTime = true;
var fullLogging = false; //false = hide logs after new cam, true = never hide logs
var logLength = 0;
var IPlocation;

var apiFails = 0;

console.log('to see debug output enable verbose logging in devtools')


//hide elements
$('.score_container').css('opacity', 0);
$('.location').css('opacity', 0);
$('.info_container').css('opacity', 0);
$('.random')[0].disabled = true;
$('.share')[0].disabled = true;
$('.error_container').hide();


//connect to socket.io server
var socket = io();
var socketObj = socket.connect('http://localhost:1');




//when socket connects
socket.on("connect",function(){
	console.debug(socketObj.id);
	//when server gets a dead link
	socket.on('fail', function (message) {
  		console.debug(message);
  		//add it to the log
  		logLength++;
  		$('.log .log_elements').last().append('<p onclick="$(\'.log .link-'+logLength+'\').fadeToggle();" class="log_item">skipping dead link </p> <span style="display:none;" class=" link link-'+logLength+'">'+message.urlFull+'</span>')
	});
	loadRandom();
})







//load a random cam
function loadRandom() {
	//if its the first time
	if (firstTime){
		//log
			$('.log').last().append('<div class="log_elements">');
			$('.log .log_elements').last().append('<p class="log_item no_click">looking for new camera...</p>')
		//set flag
		firstTime = false;
	}else{
		//if its not the first time
		//log
		$('.log .log_elements').last().fadeOut(function() {
			//$('.log').last().append('<div class="log_clear"></div>');
			$('.log').last().append('<div class="log_elements">');
			$('.log .log_elements').last().append('<p class="log_item no_click">looking for new camera...</p>')
			scrollSmoothToBottom($('.log'));
		});

	}

	$.ajax({
		type: 'GET',
		url: 'api/random?id='+socketObj.id,
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

			//if image doesnt load in 7 seconds
			setTimeout(function() {
				if (!imageLoaded){
					console.debug('ERROR - image loading timeout');
					$('.loader_container').show();
					$('.cam .video img')[0].src = 'img/blank.gif';
					loadRandom();
				}
			},7000)

		},
		error: function(data) {
			console.debug('GET api/random failed');
			console.debug(data);
			apiFails++;
			if (apiFails >= 5){
				console.debug('GET api/random failed 5 times, cancel');
				$('.cam').fadeOut();
				$('.error_container').fadeIn();
			}else{
				setTimeout(function(){loadRandom()},1000);
			}
		}
	});
};


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
	$('.loader_container #loader').css('left',($('.video .img')[0].clientWidth/2)-20);
	$('.loader_container #loader').css('top',($('.video .img')[0].clientHeight/2)-40);
	setTimeout(function(){
		refresh();
	},Math.round((currentCamera.time+2500)/5000)*5000);
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
		$('.random')[0].disabled = false;
		$('.share')[0].disabled = false;
		$('.random').animate({ opacity: 1 });
		$('#randomButton i.material-icons').removeClass('spin');

		//add to log
		logLength++;
		$('.log .log_elements').last().append('<p onclick="$(\'.log .link-'+logLength+'\').fadeToggle();" class="log_item">connected to camera</p> <span style="display:none;" class=" link link-'+logLength+'">'+currentCamera.urlFull+'</span>')
		//scrollSmoothToBottom($('.log'));
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
	if (!imageLoaded){
		loadRandom();
	}
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



//on random button click
$('.random')[0].onclick = function() {

	$('#randomButton i.material-icons').addClass('spin');
	$('.random')[0].disabled = true;
	$('.random').animate({ opacity: 0.5 });
	loadRandom();

}


//on share click
$('.share')[0].onclick = function() {

	if ($('.permaBox').is(":visible")){
		$('.permaBox').slideUp();
	}else{

		$('#permaBoxInner')[0].value = "https://qwazwsx.herokuapp.com/c4-cams/perma#" + currentCamera._id;

		$('.permaBox').slideToggle();
		copyTextToClipboard("https://qwazwsx.herokuapp.com/c4-cams/perma#" + currentCamera._id)
		toast('permalink copied to clipboard')

	}
}



$('.full_logs')[0].onclick = function() {
	if (fullLogging){
		$('.full_logs')[0].innerHTML = "show full logs";
		fullLogging = false;
		$('.log .link').fadeOut();
		$('.log .log_elements').fadeOut();
		$('.log .log_elements').last().fadeIn();
	}else{
		$('.full_logs')[0].innerHTML = "hide full logs";
		fullLogging = true;
		$('.log .link').fadeIn();
		$('.log .log_elements').fadeIn();
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
    console.log('Copying text command was ' + msg);
  } catch (err) {
    console.log('Oops, unable to copy');
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