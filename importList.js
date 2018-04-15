/*

made by qwazwsx/thisisatesttoseehowl

https://github.com/qwazwsx


generates JSON formatted data from a newline seperated text file

import with:


mongoimport --db <DB_NAME> --collection <COLLECTION_NAME> --drop --jsonArray --file <FILE_LOCATION>       
mongoimport --db c4-cams --collection camera_list --drop --jsonArray --file list.json

                                                  ^^^^^^
WARNING: running the command above WILL DROP THE DATABASE before importing

*/




var fs = require('fs');


//setup array
var txt = []

//read from newline seperated file, list.txt
fs.readFile('list.txt','utf8', function(err,d){
	//split by newline
	var data = d.split('\n')

	//loop through all lines
	for (var i = 0; i < data.length; i++){
		
		//add line to array
		txt.push({url: data[i]})
		
		
	}
	
	//write array to file, list.json
	fs.writeFile("list.json", JSON.stringify(txt), function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
}); 
	
});
	



