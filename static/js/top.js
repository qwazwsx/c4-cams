var topData;
var loader;

var page = parseInt( window.location.hash.replace('#','')) || 1

$('.subtitle')[0].innerHTML = "page " + page;

if (page == 1){
	$('.back')[0].disabled = true;
	$('.back')[1].disabled = true;
	$('.back').animate({ opacity: 0.5 });
}

if (page == 5){
	$('.next')[0].disabled = true;
	$('.next')[1].disabled = true;
	$('.next').animate({ opacity: 0.5 });
}


$('.error').hide();

function load(){
	$.ajax({
		type: 'GET',
		url: '/c4-cams/api/top',
		success: function(data){
			topData = data;



			var i = (page-1)*10;
			var start = (page-1)*10
			function addCam(){
				setTimeout(function(){

					$('.posts').append('<div class="loader"><div class="mdl-spinner mdl-js-spinner is-active"></div></div>');
					componentHandler.upgradeDom()
					$('.posts').append('<iframe style="display:none" allowtransparency="true" src="/c4-cams/perma/#'+data[i]._id+'"></iframe>');
					i++;
					if(i < start + 10){
						addCam();
					}else{
						$('.loader').fadeOut();
					}
				},300);
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

			console.debug('[top] ERROR - ' + ii)

			$('iframe')[ii].contentWindow.window.location.hash = "#errorhandled"

			//make it smaller
			$('iframe').eq(ii).css('height','200px');
			$('iframe').eq(ii).slideDown();




		}


		//if iframe is loaded
		if ($('iframe')[ii].contentWindow.window.location.hash.replace('#','') == "loaded"){
			//hide loader and show iframe

			console.log('[top] LOADED - ' + ii)

			$('iframe')[ii].contentWindow.window.location.hash = "#doneloading"
			$('.posts .loader').eq(ii).hide();
			$('iframe').eq(ii).slideDown();

			

		}

	}

},1000)



//when next page button is clicked
$('.next')[0].onclick = function() {

	window.location.hash = "#" + (page + 1)
	page++;
	window.location.reload();
}

$('.next')[1].onclick = $('.next')[0].onclick;

//when back button is clicked
$('.back')[0].onclick = function() {

	window.location.hash = "#" + (page - 1)
	page--;
	window.location.reload();
}

$('.back')[1].onclick = $('.back')[0].onclick;

