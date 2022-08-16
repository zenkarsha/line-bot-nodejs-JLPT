'use strict';

/*==================================
 BASIC REUIRE
====================================*/
const line = require('@line/bot-sdk');
const express = require('express');
const path = require('path');
const HTMLParser = require('node-html-parser');
const kanaRomaji = require("kana-romaji")
const https = require('https');
const { getAudioDurationInSeconds } = require('get-audio-duration')
const fs = require('fs');
const config = {
  channelAccessToken: '',
  channelSecret: '',
};



/*==================================
 CUSTOM REUIRE AND INIT
====================================*/
const client = new line.Client(config);
const app = express();
const words_N1  = require('./words-N1.json');
const words_N2N3  = require('./words-N2N3.json');
const words_N4  = require('./words-N4.json');
const words_N5  = require('./words-N5.json');
const words_BASIC  = require('./words-basic.json');
const words_ADVANCE  = require('./words-advance.json');
let echo = { type: 'text', text: '請從選單進行操作 ⬇️' };



/*==================================
 APP REQUEST ACTIONS
====================================*/
app.use('/audio/', express.static('./audio/'));

app.get('/', (req, res) => {
  let html = `<html>
    <head>
      <title>JLPT字彙測驗</title>
      <script>window.location = "https://line.me/R/ti/p/@810tvxfg";</script>
    </head>
    <body style="text-align:center">
      <h1>自動跳轉中⋯⋯</h1>
    </body>
  </html>`;

  res.send(html);
});

app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

app.on('postback', function (event) {
  console.log(event);
});



/*==================================
 APP ROUTER
====================================*/
function handleEvent(event) {
  if (event.type !== 'message' || event.type !== 'postback')
  {
    switch (event.type) {
      case 'message':
        handleMessageEvent(event);
        break;
      case 'postback':
        handlePostbackEvent(event);
        break;
      default:
        return client.replyMessage(event.replyToken, echo);
    }
  }
  else {
    // ignore non-text-message event
    return Promise.resolve(null);
  }
}

function handleMessageEvent(event) {
  switch (event.message.text) {
    case '開始測驗':
      let question_type_json = createQuestionType(event);
      return client.replyMessage(event.replyToken, [question_type_json]);
      break;
    case '我的字庫':
      return createUserCollection(event);
      break;
    case '得分':
      return handleUserPoints(event);
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }
}

function handlePostbackEvent(event) {
  const postback_result = handleUrlParams(event.postback.data);
  switch (postback_result.type) {
    case 'question_type':
      let question_type_json = createQuestionLevel(postback_result.question_type);
      return client.replyMessage(event.replyToken, [question_type_json]);
      break;
    case 'question_level':
      let question_level_json = createQuestion(postback_result.question_type);
      return client.replyMessage(event.replyToken, [question_level_json]);
      break;
    case 'answer':
      let answer_result = handleAnswer(event.postback.data)
      if (answer_result) {
        updateUserPoints(event);
        return client.replyMessage(event.replyToken, moreQuestion(postback_result.question_type, postback_result.wid, true));
      }
      else {
        updateUserWrongAnswer(event);
        return client.replyMessage(event.replyToken, moreQuestion(postback_result.question_type, postback_result.wid, false));
      }
      break;
    case 'play_pronounce':
      return playPronounce(event, postback_result.wid);
      break;
    case 'more_question':
      let more_question_json = createQuestion(postback_result.question_type, postback_result.wid);
      return client.replyMessage(event.replyToken, [more_question_json]);
      break;
    case 'more_test':
      let question_json = createQuestion(postback_result.question_type);
      return client.replyMessage(event.replyToken, [question_json]);
      break;
    case 'add_to_collection':
      return addToUserCollection(event, postback_result.wid);
      break;
    case 'delete_from_my_collection':
      return deleteFromMyCollection(event, postback_result.wid);
      break;
    case 'check_my_collection':
      return createUserCollection(event);
      break;
    case 'check_word':
      return checkWord(event, postback_result.wid);
    default:
      return client.replyMessage(event.replyToken, echo);
  }
}



/*==================================
 APP FUNCTIONS
====================================*/
function createQuestionType() {
  return {
    "type": "flex",
    "altText": "考試開始，不要作弊！",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "日文選翻譯",
              "displayText": "日文選翻譯",
              "data": `wid=&type=question_type&question_type=word&content=word`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "翻譯選日文",
              "displayText": "翻譯選日文",
              "data": `wid=&type=question_type&question_type=translate&content=translate`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "漢字選平假名",
              "displayText": "漢字選平假名",
              "data": `wid=&type=question_type&question_type=kanji&content=kanji`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          }
        ]
      }
    }
  };
}

function createQuestionLevel(question_type) {
  return {
    "type": "flex",
    "altText": "考試開始，不要作弊！",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "N1字彙",
              "displayText": "N1字彙",
              "data": `wid=&type=question_level&question_type=n1_${question_type}&content=n1_${question_type}`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "N2、N3字彙",
              "displayText": "N2、N3字彙",
              "data": `wid=&type=question_level&question_type=n2n3_${question_type}&content=n2n3_${question_type}`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "N4字彙",
              "displayText": "N4字彙",
              "data": `wid=&type=question_level&question_type=n4_${question_type}&content=n4_${question_type}`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "N5字彙",
              "displayText": "N5字彙",
              "data": `wid=&type=question_level&question_type=n5_${question_type}&content=n5_${question_type}`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "日常基礎字彙",
              "displayText": "日常基礎字彙",
              "data": `wid=&type=question_level&question_type=basic_${question_type}&content=basic_${question_type}`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "進階字彙",
              "displayText": "進階字彙",
              "data": `wid=&type=question_level&question_type=advance_${question_type}&content=advance_${question_type}`
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          }
        ]
      }
    }
  };
}

function createQuestion(question_type, current_wid = null) {
  let old_words, new_words;

  switch (question_type) {
    case 'n1_word':
    case 'n1_kanji':
    case 'n1_translate':
      old_words = words_N1;
      new_words = words_N1;
      break;
    case 'n2n3_word':
    case 'n2n3_kanji':
    case 'n2n3_translate':
      old_words = words_N2N3;
      new_words = words_N2N3;
      break;
    case 'n4_word':
    case 'n4_kanji':
    case 'n4_translate':
      old_words = words_N4;
      new_words = words_N4;
      break;
    case 'n5_word':
    case 'n5_kanji':
    case 'n5_translate':
      old_words = words_N5;
      new_words = words_N5;
      break;
    case 'basic_word':
    case 'basic_kanji':
    case 'basic_translate':
      old_words = words_BASIC;
      new_words = words_BASIC;
      break;
    case 'advance_word':
    case 'advance_kanji':
    case 'advance_translate':
      old_words = words_ADVANCE;
      new_words = words_ADVANCE;
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }

  if (current_wid !== null) {
    let index = getObjectItemIndex(old_words, current_wid);
    if (index !== -1) new_words = removeByIndex(new_words, index);
  }

  let level_type = question_type.split('_');
  let w = new_words[Math.floor(Math.random() * new_words.length)];
  if (level_type[1] == "kanji") {
    while (w.kanji == "null") {
      w = new_words[Math.floor(Math.random() * new_words.length)];
    }
  }

  let contents = [];
  let question;
  let w_text;

  if (level_type[1] == "word") question = w.word;
  else if (level_type[1] == "kanji") question = w.kanji;
  else if (level_type[1] == "translate") question = w.translate;

  w_text = {
    "type": "text",
    "text": `${question}\n`,
    "size": "xxl",
    "wrap": true
  };

  contents.push(w_text);

  let w_index = getObjectItemIndex(new_words, w.id);
  if (w_index !== -1) new_words = removeByIndex(new_words, w_index);

  let answers = createAnswers(new_words, w.id);
  answers.push(w);

  let shuffled_answers = answers.sort(function () {
    return Math.random() - 0.5;
  });

  for (let i = 0; i < answers.length; i++) {
    let temp_answer;

    if (level_type[1] == 'word') temp_answer = answers[i].translate;
    else if (level_type[1] == 'kanji') temp_answer = answers[i].word;
    else if (level_type[1] == 'translate') temp_answer = answers[i].word;

    contents.push({
      "type": "button",
      "action": {
        "type": "postback",
        "label": temp_answer,
        "displayText": temp_answer,
        "data": `wid=${w.id}&type=answer&question_type=${question_type}&content=${temp_answer}`
      },
      "style": "secondary",
      "adjustMode": "shrink-to-fit"
    });
  }

  return {
    "type": "flex",
    "altText": "考試開始，不要作弊！",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": contents
      }
    }
  };
}

function createAnswers(words, wid, total = 3) {
  let object = [];

  let array_container = [];
  const gen_numbers = Math.floor(Math.random() * words.length);
  array_container.push(gen_numbers);

  for (let counter = 0; counter < (words.length - 1) && array_container.length < total; counter++) {
    let new_gen = Math.floor(Math.random() * words.length);
    while (array_container.lastIndexOf(new_gen) !== -1) {
      new_gen = Math.floor(Math.random() * words.length);
    }
    array_container.push(new_gen);
  }

  for (let i = 0; i < total; i++) {
    object.push(words[array_container[i]]);
  }

  return object;
}

function moreQuestion(question_type, wid, answer) {
  let words;
  switch (question_type) {
    case 'n1_word':
    case 'n1_kanji':
    case 'n1_translate':
      words = words_N1;
      break;
    case 'n2n3_word':
    case 'n2n3_kanji':
    case 'n2n3_translate':
      words = words_N2N3;
      break;
    case 'n4_word':
    case 'n4_kanji':
    case 'n4_translate':
      words = words_N4;
      break;
    case 'n5_word':
    case 'n5_kanji':
    case 'n5_translate':
      words = words_N5;
      break;
    case 'basic_word':
    case 'basic_kanji':
    case 'basic_translate':
      words = words_BASIC;
      break;
    case 'advance_word':
    case 'advance_kanji':
    case 'advance_translate':
      words = words_ADVANCE;
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }

  let w = words.filter(x => x.id == wid);
  let contents = [];

  if (answer) {
    contents.push({
      "type": "text",
      "size": "xl",
      "text": "恭喜、答對了！！！\n"
    });
  }
  else {
    contents.push({
      "type": "text",
      "size": "xl",
      "color": "#ff0000",
      "text": "❌ 答錯了！\n"
    });
  }

  contents.push({
    "type": "separator"
  });

  let w_detail = `${w[0].word}\n翻譯：${w[0].translate}\n`;
  if (w[0].kanji != "null") w_detail = `${w[0].word}\n漢字：${w[0].kanji}\n翻譯：${w[0].translate}\n`;

  contents.push({
    "type": "text",
    "wrap": true,
    "text": `${w_detail}`
  });

  contents.push({
    "type": "button",
    "action": {
      "type": "postback",
      "label": "再來一題",
      "displayText": "再來一題",
      "data": `wid=${wid}&type=more_question&question_type=${question_type}&content=再來一題`
    },
    "style": "primary"
  });

  contents.push({
    "type": "button",
    "action": {
      "type": "postback",
      "label": "聽發音",
      "displayText": "聽發音",
      "data": `wid=${wid}&type=play_pronounce&question_type=${question_type}&content=聽發音`
    },
    "style": "secondary"
  });

  return {
    "type": "flex",
    "altText": "再來一題",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": contents
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "separator"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "加入字庫",
              "displayText": "加入字庫",
              "data": `wid=${wid}&type=add_to_collection&question_type=${question_type}&content=加入字庫`
            }
          }
        ]
      }
    }
  }
}

function handleAnswer(data) {
  let result = handleUrlParams(data);
  let words;

  switch (result.question_type) {
    case 'n1_word':
    case 'n1_kanji':
    case 'n1_translate':
      words = words_N1;
      break;
    case 'n2n3_word':
    case 'n2n3_kanji':
    case 'n2n3_translate':
      words = words_N2N3;
      break;
    case 'n4_word':
    case 'n4_kanji':
    case 'n4_translate':
      words = words_N4;
      break;
    case 'n5_word':
    case 'n5_kanji':
    case 'n5_translate':
      words = words_N5;
      break;
    case 'basic_word':
    case 'basic_kanji':
    case 'basic_translate':
      words = words_BASIC;
      break;
    case 'advance_word':
    case 'advance_kanji':
    case 'advance_translate':
      words = words_ADVANCE;
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }

  let w = words.filter(x => x.id == result.wid);
  let level_type = result.question_type.split('_');

  if (level_type[1] == "word") return result.content == w[0].translate ? true : false;
  else if (level_type[1] == "kanji") return result.content == w[0].word ? true : false;
  else if (level_type[1] == "translate") return result.content == w[0].word ? true : false;
}

function createUserCollection(event) {
  let user = event.source.userId;
  let path = __dirname + `/user_words/${user}.json`;

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let user_json = JSON.parse(data);
        let user_words = user_json[0].words;

        let bubble_content = [];
        let box_content = [];

        for (let i = 0; i < user_words.length; i++) {
          let temp_text = `${user_words[i].word}\n${user_words[i].translate}`;
          if (user_words[i].kanji != "null")
            temp_text = `${user_words[i].word} (${user_words[i].kanji})\n${user_words[i].translate}`;

          let temp_box = {
            "type": "box",
            "layout": "horizontal",
            "spacing": "md",
            "contents": [
              {
                "type": "text",
                "wrap": true,
                "flex": 5,
                "text": temp_text
              },
              {
                "type": "button",
                "flex": 2,
                "action": {
                  "type": "postback",
                  "label": "查看",
                  "displayText": "查看",
                  "data": `wid=${user_words[i].id}&type=check_word&content=查看`
                },
                "style": "secondary"
              }
            ]
          };
          box_content.push(temp_box);

          if ((parseInt(i) + 1) < user_words.length && (parseInt(i) + 1) % 7 != 0) {
            let separator = {
              "type": "separator"
            };
            box_content.push(separator);
          }

          if ((parseInt(i) + 1) % 7 == 0 || (parseInt(i) + 1) == user_words.length) {
            let temp_bubble = {
              "type": "bubble",
              "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "contents": box_content
              }
            };

            bubble_content.push(temp_bubble);
            box_content = [];
          }
        }

        return client.replyMessage(event.replyToken, [{
          "type": "flex",
          "altText": "我的字庫",
          "contents": {
            "type": "carousel",
            "contents": bubble_content
          }
        }]);
      }
    });
  }
  else {
    echo = { type: "text", text: "您的字庫裡尚無任何單字" };
    return client.replyMessage(event.replyToken, echo);
  }
}

function addToUserCollection(event, wid) {
  let result = handleUrlParams(event.postback.data);
  let user = event.source.userId;
  let path = __dirname + `/user_words/${user}.json`;
  let user_json = [];
  let words;

  let word_type = wid.slice(0, 2);

  switch (word_type) {
    case 'N1':
      words = words_N1;
      break;
    case 'N2':
      words = words_N2N3;
      break;
    case 'N4':
      words = words_N4;
      break;
    case 'N5':
      words = words_N5;
      break;
    case 'BA':
      words = words_BASIC;
      break;
    case 'AD':
      words = words_ADVANCE;
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }

  let index = getObjectItemIndex(words, wid);
  let word = words[index];

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data);
        let user_words = old_json[0].words;
        let user_words_count = user_words.length;

        if (user_words_count == 70) {
          echo = { type: "text", text: "您的字庫達上限，請刪減一些單字" };
          return client.replyMessage(event.replyToken, echo);
        }
        else {
          let word_index = getObjectItemIndex(user_words, word.id);
          if (word_index == -1) {
            user_words.push(word);
            user_json = [{"user": user, "words": user_words}];

            fs.writeFile(path, JSON.stringify(user_json), function (error, data) {
              if (error) throw error;
              else {
                echo = { type: "text", text: "已加入您的字庫" };
                return client.replyMessage(event.replyToken, echo);
              }
            });
          }
          else {
            echo = { type: "text", text: "字彙已在您的字庫中！" };
            return client.replyMessage(event.replyToken, echo);
          }
        }
      }
    });
  }
  else {
    user_json = [{"user": user, "words": [word]}];
    fs.writeFile(path, JSON.stringify(user_json), function (error, data) {
      if (error) throw error;
      else {
        echo = { type: "text", text: "已加入您的字庫" };
        return client.replyMessage(event.replyToken, echo);
      }
    });
  }
}

function deleteFromMyCollection(event, wid) {
  let user = event.source.userId;
  let path = __dirname + `/user_words/${user}.json`;
  let user_json = [];

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data);
        let user_words = old_json[0].words;

        let index = getObjectItemIndex(user_words, wid);
        user_words.splice(index, 1);
        user_json = [{"user": user, "words": user_words}];

        fs.writeFile(path, JSON.stringify(user_json), function (error, data) {
          if (error) throw error;
          else {
            return client.replyMessage(event.replyToken, [{
              "type": "flex",
              "altText": "刪除成功",
              "contents": {
                "type": "bubble",
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "spacing": "md",
                  "contents": [
                    {
                      "type": "text",
                      "size": "lg",
                      "text": "刪除成功！"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "message",
                        "label": "查看我的字庫",
                        "text": "我的字庫"
                      },
                      "style": "secondary"
                    }
                  ]
                }
              }
            }]);
          }
        });
      }
    });
  }
  else {
    echo = { type: "text", text: "找不到您的字庫資料" };
    return client.replyMessage(event.replyToken, echo);
  }
}

function checkWord(event, wid) {
  let words;
  let word_type = wid.slice(0, 2);

  switch (word_type) {
    case 'N1':
      words = words_N1;
      break;
    case 'N2':
      words = words_N2N3;
      break;
    case 'N4':
      words = words_N4;
      break;
    case 'N5':
      words = words_N5;
      break;
    case 'BA':
      words = words_BASIC;
      break;
    case 'AD':
      words = words_ADVANCE;
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }

  let index = getObjectItemIndex(words, wid);
  let w = words[index];
  let word;

  word = w.kanji != "null" ? w.kanji : w.word;
  let search_word = word.replace("～", "");

  let url = "https://cdict.info/ejquery/" + search_word;

  const request = https.request(url, function(res) {
    let data = '';

    res.on('data', function(chunk) {
      data = data + chunk.toString();
    });

    res.on('end', function() {
      let root = HTMLParser.parse(data);
      let word_info = (root.querySelector('.resultbox').toString()).replace(new RegExp(/<br\s*[\/]?>/, "g"), "\n").replace(new RegExp(/<div class=\"resultbox\"><div class=\"bartop\">(.+)<\/div><div class=\"xbox\">\n<div class=\"dictp\">(.+)<\/div>\n<\/div><\/div>\n\n<p>(.+)<\/p>\n/, "g"), "\n").replace(new RegExp(/<div class=\"resultbox\"><div class=\"bartop\">(.+)<\/div><div class=\"xbox\">\n<div class=\"dictp\">(.+)<\/div>\n\n\<p>(.+)<\/p>\n/, "g"), "\n").replace(new RegExp(/<div class=\"resultbox\"><div class=\"bartop\">(.+)<\/div>\n\s<\/div>\n/, "g"), "\n");

      word_info = word_info.replace(new RegExp(/<h4>\s/, "g"), "<h4>").replace(new RegExp(/<\/h4>/, "g"), "<\/h4>\n").replace(new RegExp(/<li>\s/, "g"), "<li>").replace(new RegExp(/<\/li>/, "g"), "\n").replace(new RegExp(/<\/p>/, "g"), "\n").replace(/<[^>]*>?/gm, '');

      return client.replyMessage(event.replyToken, [{
        "type": "flex",
        "altText": "單字詳解",
        "contents": {
          "type": "bubble",
          "header": {
            "type": "box",
            "layout": "vertical",
            "paddingBottom": "xs",
            "contents": [
              {
                "type": "text",
                "size": "xl",
                "text": word
              }
            ]
          },
          "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "contents": [
              {
                "type": "text",
                "color": "#999999",
                "size": "xs",
                "wrap": true,
                "text": w.word
              },
              {
                "type": "text",
                "color": "#999999",
                "size": "xs",
                "wrap": true,
                "text": kanaRomaji.toRomaji(w.word)
              },
              {
                "type": "separator"
              },
              {
                "type": "text",
                "wrap": true,
                "text": word_info
              }
            ]
          },
          "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "button",
                "action": {
                  "type": "postback",
                  "label": "聽發音",
                  "displayText": "聽發音",
                  "data": `wid=${wid}&type=play_pronounce&content=聽發音`
                },
                "style": "secondary"
              },
              {
                "type": "button",
                "action": {
                  "type": "postback",
                  "label": "從字庫刪除",
                  "displayText": "從字庫刪除",
                  "data": `wid=${wid}&type=delete_from_my_collection&content=從字庫刪除`
                }
              },
              {
                "type": "separator"
              },
              {
                "type": "button",
                "action": {
                  "type": "postback",
                  "label": "查看字庫",
                  "displayText": "查看字庫",
                  "data": `wid=&type=check_my_collection&content=查看字庫`
                }
              }
            ]
          },
        }
      }]);
    });
  })

  request.on('error', function(err) {
    console.log(err);
  });

  request.end();
}

function playPronounce(event, wid) {
  let words;
  let word_type = wid.slice(0, 2);

  switch (word_type) {
    case 'N1':
      words = words_N1;
      break;
    case 'N2':
      words = words_N2N3;
      break;
    case 'N4':
      words = words_N4;
      break;
    case 'N5':
      words = words_N5;
      break;
    case 'BA':
      words = words_BASIC;
      break;
    case 'AD':
      words = words_ADVANCE;
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }

  let index = getObjectItemIndex(words, wid);
  let w = words[index];

  getAudioDurationInSeconds(`https://jlpt.unlink.men/audio/${w.id}.m4a`).then((duration) => {
    let milliseconds = duration * 1000;
    echo = {
      "type": "audio",
      "originalContentUrl": `https://jlpt.unlink.men/audio/${w.id}.m4a`,
      "duration": milliseconds
    };
    client.replyMessage(event.replyToken, echo);
  });
}

function handleUserPoints(event) {
  let user = event.source.userId;
  let path = `./users/${user}.json`;
  let user_json = `[{"user": "${user}", "point": 0, "wrong_answer": 0}]`;

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let current_json = JSON.parse(data)
        return client.replyMessage(event.replyToken, createPointMessage(current_json[0]));
      }
    });
  }
  else {
    fs.writeFile(path, user_json, function (error, data) {
      if (error) {
        console.error(error);
      }
    });

    echo = { type: "text", text: "零分啦！" };
    return client.replyMessage(event.replyToken, echo);
  }
}

function createPointMessage(user_json) {
  let point = user_json.point;
  let wrong_answer = !("wrong_answer" in user_json) ? 0 : user_json.wrong_answer;
  let score = point - wrong_answer;

  let gold_stars = 1;
  if (score >= 2500) gold_stars = 5;
  else if (score >= 1000) gold_stars = 4;
  else if (score >= 500) gold_stars = 3;
  else if (score >= 100) gold_stars = 2;
  else gold_stars = 1;

  let stars_contents = [];
  for (let i = 0; i < gold_stars; i++) {
    stars_contents.push({
      "type": "icon",
      "size": "sm",
      "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png"
    });
  }

  for (let j = 0; stars_contents.length < 5; j++) {
    stars_contents.push({
      "type": "icon",
      "size": "sm",
      "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gray_star_28.png"
    });
  }

  return {
    "type": "flex",
    "altText": "你的分數",
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "image",
            "url": "https://cdn2.ettoday.net/images/5588/5588832.jpg",
            "flex": 1,
            "size": "full",
            "aspectRatio": "2:1",
            "aspectMode": "cover"
          }
        ],
        "paddingAll": "0px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": `你目前的得分為：${point}分`
          },
          {
            "type": "text",
            "text": `答錯次數：${wrong_answer}次\n\n`
          },
          {
            "type": "box",
            "layout": "baseline",
            "margin": "md",
            "contents": stars_contents
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "繼續測驗",
              "displayText": "繼續測驗",
              "data": `type=more_test&content=繼續測驗`
            },
            "style": "primary"
          }
        ]
      }
    }
  };
}

function updateUserPoints(event) {
  let user = event.source.userId;
  let path = __dirname + `/users/${user}.json`;
  let user_json = '';

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data);
        let point = old_json[0].point + 1;
        let wrong_answer = 0

        if (!("wrong_answer" in old_json[0])) wrong_answer = 0
        else wrong_answer = old_json[0].wrong_answer;

        user_json = `[{"user": "${user}", "point": ${point}, "wrong_answer": ${wrong_answer}}]`
        fs.writeFile(path, user_json, function (error, data) {
          if (error) throw error;
        });
      }
    });
  }
  else {
    user_json = `[{"user": "${user}", "point": 1, "wrong_answer": 0}]`
    fs.writeFile(path, user_json, function (error, data) {
      if (error) throw error;
    });
  }
}

function updateUserWrongAnswer(event) {
  let user = event.source.userId;
  let path = __dirname + `/users/${user}.json`;
  let user_json = '';

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data)
        let wrong_answer = 1;

        if (!("wrong_answer" in old_json[0])) wrong_answer = 1;
        else wrong_answer = old_json[0].wrong_answer + 1;

        user_json = `[{"user": "${user}", "point": ${old_json[0].point}, "wrong_answer": ${wrong_answer}}]`
        fs.writeFile(path, user_json, function (error, data) {
          if (error) throw error;
        });
      }
    });
  }
  else {
    user_json = `[{"user": "${user}", "point": 0, "wrong_answer": 1}]`
    fs.writeFile(path, user_json, function (error, data) {
      if (error) throw error;
    });
  }
}



/*==================================
 BASIC FUNCTIONS
====================================*/
function handleUrlParams(data) {
  const params = new URLSearchParams(data);
  const wid = params.get('wid');
  const type = params.get('type');
  const question_type = params.get('question_type');
  const content = params.get('content');
  return {'wid': wid, 'type': type, 'question_type': question_type, 'content': content};
}

function removeByIndex(array, index) {
  return array.filter(function (el, i) {
    return index !== i;
  });
}

function getObjectItemIndex(object, id) {
  let index;
  return index = object.findIndex(function(x) {
    return x.id === id;
  })
}



/*==================================
 START APP AND LISTEN ON PORT
====================================*/
const port = process.env.PORT || 3333;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
