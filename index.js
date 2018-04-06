/*

made by qwazwsx/thisisatesttoseehowl

https://github.com/qwazwsx


todo: verify links passed into load(x)



*/



var MongoClient = require('mongodb').MongoClient;		//mongoDB client for databases
var mongoUrl = "mongodb://localhost:27017/";			//location of mongoDB server
var uuidv4 = require('uuid/v4');						//generates uuid's for documents
var decay = require('decay');							//get decay for sorting by up&down votes
var wilsonScore = decay.wilsonScore();					//use wilson type of scoring (reddit comments "best" sorting)
var sortBy = require('sort-array')						//helps when sorting arrays of posts
var views = [];											//tracks users for view counts
var sortedPosts = []									//list of sorted posts, updates every 10 min



//gets all data from database and sorts using wilson type sorting
//read more here: https://github.com/clux/decay#1-wilson-score
//sets var sortedPosts
//sortedPosts gets returned when the top list is needed
//this function should be ran at an interval 5min?? 10 min? 30min?
function sort(){
	
	MongoClient.connect(mongoUrl, function(err, db) {
		if (err) throw err;
		var dbo = db.db("c4-roulette");
		dbo.collection('cams').find({}).toArray(function(err, data) {
			if (err) throw err;
			
			//console.log(data)
			var unsortedPosts = [];
			
			for (var i = 0; i < data.length; i++){
				
				//console.log(data[i]);
				
				var score = wilsonScore(data[i].upvotes, data[i].downvotes);
				//console.log(score);
				
				unsortedPosts[i] = [];
				unsortedPosts[i].score = score;
				unsortedPosts[i].data = data[i];
				
				
			}
			
			var posts = sortBy(unsortedPosts,'score').reverse();
			
			for (var i = 0; i < posts.length; i++){
				
				sortedPosts[i] = posts[i].data;
				
				
			}
			
			console.log(JSON.stringify(sortedPosts))
			
			
			
			db.close();
		});
	});	
	
	
	
}



//report a post as dead
//yeah its not limited but it shouldn't be a problem
function report(uuid){
	
	update('cams', { _id:uuid }, { $inc: { reports: 1 } } );
}



//upvote a post
//uuid: uuid of post
//ip: ip of requester
function upvote(uuid,ip){
	
	//search in vote records for upvotes on this ip on this post
	search('votes', 2, { _id: uuid}).then(function(data){

		//if user diddnt upvote the post already
		if (data[0].upvoters.indexOf(ip) == -1){
			
			//add upvote
			update('cams', { _id: uuid }, { $inc: {upvotes: 1} } );
			//add ip to upvoters list
			update('votes', { _id: uuid }, { $push: {upvoters: ip} } );
			
			//if user downvoted before
			if (data[0].downvoters.indexOf(ip) !== -1){
				//take away the downvote
				update('cams', { _id: uuid }, { $inc: {downvotes: -1} } );
				//remove ip from downvoters list
				update('votes', { _id: uuid }, { $pull: {downvoters: ip} } );
			};
		
			
			
		}else{
			return false;
		};
	});	
}



//downvote a post
//uuid: uuid of post
//ip: ip of requester
function downvote(uuid,ip){
	
	//search in vote records for upvotes on this ip on this post
	search('votes', 2, { _id: uuid}).then(function(data){

		//if user diddnt downvote the post already
		if (data[0].downvoters.indexOf(ip) == -1){
			
			//add downvote
			update('cams', { _id: uuid }, { $inc: {downvotes: 1} } );
			//add ip to downvoters list
			update('votes', { _id: uuid }, { $push: {downvoters: ip} } );
			
			//if user upvoted before
			if (data[0].upvoters.indexOf(ip) !== -1){
				//take away the upvote
				update('cams', { _id: uuid }, { $inc: {upvotes: -1} } );
				//remove ip from upvoters list
				update('votes', { _id: uuid }, { $pull: {upvoters: ip} } );
			};
		
			
			
		}else{
			return false;
		};
	});	
}



//to be called on page load
//url: full url
//ip: ip of requester
function load(url,ip){
	
	//TODO: add check to see if the url is in the c4 list
	//so people cant feed it garbage data
	
	//check if url already is in database
	search('cams',0,url).then(function(data){
		if (data == ''){
			//if url isnt in the database add it and restart the function
			console.log('[INFO] cam not found in database, creating page')
			createDoc(url).then(function(){
				load(url,ip);
			})
		}else{
			//if the camera exists in the database add view count
			console.log('[INFO] PAGE EXISTS');			
		
			//if viewers array for this cam doesnt exist make it
			if (views[data[0]._id] == undefined){
				views[data[0]._id] = [];
			};
			
			//if ip havent already viewed push ip to array and count view
			if (views[data[0]._id].indexOf(ip) == -1){
				views[data[0]._id].push(ip)
				
				//add view to the cam
				update('cams', { _id: data[0]._id }, { $inc: { views: 1 } })
				
				
			};
			
			return data;
		};
		
		
	}).catch(function(err){
		throw err;
	});
};



	//placeholder function
	//will eventualy serve JSON content
	
//create a new doc from url
//url: full url
function createDoc(url){
	//add / incase url doesnt have / at the end (it breaks regex)
	url = url + '/'
	
	return new Promise(function(resolve,reject){
		
		//generate a uuid
		var uuid = uuidv4();
		
		//check if uuid is already used
		search('cams',1,uuid).then(function(data){
			if (data !== ''){
				//if uuid isnt already used add it to the database
				add('cams',{
					_id:uuid,
					url: /(:\/\/)(.+?)(?=\/)/g.exec(url)[0].replace('://',''), 
					urlFull: url,
					upvotes: 0,
					downvotes: 0,
					reports: 0,
					views: 0
					});
					
				add('votes', { _id:uuid, upvoters: [], downvoters: []} ).then(function(data){
					
					resolve();
					
				});
				
				
				
			}else{
				//if uuid is already used retry
				console.log('UUID is already used, buy a lottery ticket');
				createDoc(url);
			};
		});
	});
};

	
	
//check if camera is already in the database
//collection: collection to search in
//mode: 0 = search by url. 1 = search by uuid. 2 = input your own query object
//input: full url
function search(collection,mode,input){

	return new Promise(function(resolve,reject){
		MongoClient.connect(mongoUrl, function(err, db) {
			if (err) reject(err);
			var dbo = db.db("c4-roulette");
			//not as elegant as /(?<=:\/\/)(.+?)(?=\/)/g but positive lookbehinds aren't supported
			if (mode == 0){
				var query = { url: /(:\/\/)(.+?)(?=\/)/g.exec(input)[0].replace('://','') };
			}else{
				if (mode == 1){
					var query = { uuid: input };
				}else{
					if (mode == 2){
						var query = input;
					};
					
				};
				
			};
			dbo.collection(collection).find(query).toArray(function(err, result) {
				if (err) reject(err);
				
				resolve(result);
				
				db.close();
		  });
		});
	});
}


		
//add data to a collection
//collection: collection to add data to
//data: object of data to add
function add(collection,data){
	
	return new Promise(function(resolve,reject){
		MongoClient.connect(mongoUrl, function(err, db) {
			if (err) throw err;
			var dbo = db.db("c4-roulette");
			dbo.collection(collection).insertOne(data, function(err, res) {
				if (err) throw err;
				resolve();
				db.close();
			});
		});	
	});
};
	
	
//update a document
//collection:string
//query: object of keys to search for 
//data: object of keys to replace
function update(collection,query,data){
	
	return new Promise(function(resolve,reject){
		MongoClient.connect(mongoUrl, function(err, db) {
			if (err) throw err;
			var dbo = db.db("c4-roulette");
			dbo.collection(collection).updateOne(query, data, function(err, res) {
				if (err) throw err;
				resolve();
				db.close();
			});
		});	
	});
};
	
	
	
//error handler
//https://stackoverflow.com/a/43994999/6088533
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
	
	
	
	
//createDoc('http://te.st:3000').catch(function(err){console.log('asd')})
	
	
	



// MongoClient.connect(url, function(err, db) {
  // if (err) throw err;
  // var dbo = db.db("c4-roulette");
  // var query = { url: "111.111.111.111" };
  // dbo.collection("cam_uuid_translate").find(query).toArray(function(err, result) {
    // if (err) throw err;
    // console.log(result);
    // db.close();
  // });
// });






// MongoClient.connect(url, function(err, db) {
  // if (err) throw err;
  // var dbo = db.db("c4-roulette");
  // var myobj = {_id: uuid.v4(), upvotes: 5, reports: 1};
  // dbo.collection("cams").insertOne(myobj, function(err, res) {
    // if (err) throw err;
    // console.log("1 document inserted");
    // db.close();
  // });
// });