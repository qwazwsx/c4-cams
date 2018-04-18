var topData;
var loader;

var page = window.location.hash.replace('#','') || 1


$('.error').hide();

function load(){
	$.ajax({
		type: 'GET',
		url: 'api/top',
		success: function(data){
			topData = data;



			var i = (page-1)*10;
			var start = (page-1)*10
			function addCam(){
				setTimeout(function(){
					console.debug(i)
					$('.posts').append('<div class="loader"><div class="mdl-spinner mdl-js-spinner is-active"></div></div>');
					componentHandler.upgradeDom()
					$('.posts').append('<iframe style="display:none" allowtransparency="true" src="perma.html#'+data[i]._id+'"></iframe>');
					i++;
					if(i < start + 10){
						addCam();
					}else{
						$('.loader').fadeOut();
					}
				},1000);
			}

			addCam();





		},
		error: function(err) {
			console.debug(err)
			$('.posts').fadeOut();
			$('.error').fadeIn();
		}
	});
}



load();


//error check
setInterval(function() {

	//loop through all iframes
	for (var ii = 0; ii < $('iframe').length; ii++){

		//if the iframe error-ed
		if ($('iframe')[ii].contentWindow.window.location.hash.replace('#','') == "error"){

			console.debug('[TOP] iframe has error, shrinking')

			//make it smaller
			$('iframe').eq(ii).css('height','200px');

			$('iframe')[ii].contentWindow.window.location.hash = "#"

		}


		//if iframe is loaded
		if ($('iframe')[ii].contentWindow.window.location.hash.replace('#','') == "loaded"){
			//hide loader and show iframe

			$('iframe')[ii].contentWindow.window.location.hash = "#doneloading"
			$('.posts .loader').eq(ii).fadeOut();
			$('iframe').eq(ii).slideDown();

		}

	}



},1000)