const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const translatte = require("translatte");
const MultiKeyCache = require("multi-key-cache");
const multiKeyCache = new MultiKeyCache();
const MongoClient = require("mongodb").MongoClient;
const config = require("./config")
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

//Text traslation function
const translation = async (text, source_language, target_langauge) => {
  return new Promise((resolve, reject) =>
    translatte(text, { from: source_language, to: target_langauge })
      .then((res) => {
        resolve(res.text);
      })
      .catch((err) => {
        reject(err.message);
      })
  );
};

//functoin for checking data is not null
function isSet(obj) {
  if (obj && obj != "null" && obj != undefined && obj !== "" && obj != "[]" && obj != [] && obj != {} && obj !== "" && obj != "undefined") {
      if (typeof obj != "undefined") {
          return true;
      }
  }
  return false;
}
app.post("/translate", async (req, res) => {
  var { text, source_language, target_langauge } = req.body;

  //validation for text, sorce language and target language
  if(!isSet(text)){
    return res.json({ status: 400, success: false, message: "Input Text is Missing" });
  }

  if(!isSet(source_language)){
    return res.json({ status: 400, success: false, message: "Source Language is Missing" });
  }

  if(!isSet(target_langauge)){
    return res.json({ status: 400, success: false, message: "Target Language is Missing" });
  }

  text = text.trim();
  source_language = source_language.trim();
  target_langauge = target_langauge.trim();

  try {
    var result,
      key = [text, source_language, target_langauge];

    //Find data in catch
    if (multiKeyCache.has(key)) {
      result = multiKeyCache.get(key);
      console.log("Result from cache");
      console.log("Response sent to the client");
      return res.json({ status: 200, data:result });
    } else {

      //database connection
      MongoClient.connect(config.db_url, async function (err, db) {
        try{
          if (err) {
            console.log(err);
            console.log("Response sent to the client");
            return res.json({
              status: 500,
              success: false,
              message: err.message,
            });
          } else {
            let dbase = db.db(config.database);
            let collection = dbase.collection(config.collection);

            //finding data in existing records
            result = await collection.findOne({
              input_text: text,
              target_langauge: target_langauge,
              source_language: source_language,
            });


            if (result === null) {

              //fetch result from translation'
              result = await translation(text, source_language, target_langauge);
              console.log("Result from traslation function")

              //add data into catch
              multiKeyCache.set(key, result);

              //insert data into collction
              await collection.insertOne({
                input_text: text,
                "target_langauge": target_langauge,
                "source_language": source_language,
                output_text: result,
              });
              console.log(`Record inserted!`);

            }else{
              console.log("Result From Database")
              result = result.output_text
            }

            db.close();

        return res.json({ status: 200, success:true, data:result });
          }

        }          
          catch (err) {
            var _err=err
            if(isSet(err) && isSet(err.message)){
              _err= err.message
            }
            console.log("Response sent to the client");
            return res.json({ status: 200, success: false, message: _err});
          }
      });

    }

  } catch (err) {
    console.log("Response sent to the client");
    return res.json({ status: 200, success: false, message: err});
  }
});
app.listen(3000, async () => {
  console.log("Server successfully started on port 3000");
});
