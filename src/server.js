import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import botkit from 'botkit';
import dotenv from 'dotenv';
import yelp from 'yelp-fusion';

dotenv.config({ silent: true });


// initialize
const app = express();

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM((err) => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
// controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
//   controller.createWebhookEndpoints(webserver, slackbot, () => {
//     if (err) { throw new Error(err); }
//   });
// });

controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'Coming Along Now');
});

controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

controller.hears(['help!!!', 'help me', 'help'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `I got you, ${res.user.name}! You can ask me to help you find the best food near you!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});


// Yelp Integration
const yelpClient = yelp.client(process.env.YELP_API_KEY);


controller.hears(['food', 'hungry', 'famished', 'starving'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.startConversation(message, (err, convo) => {
        let location = '';
        let foodChoice = '';

        convo.addQuestion(`Sure, I got you, ${res.user.name}. Can you tell me where are you currently located? (Example: Hanover, NH)`, (response, convoCont) => {
          location = response.text;
          convoCont.next();
        }, { key: 'location' }, 'default');

        convo.addQuestion(`Now, ${res.user.name}, what are you craving? (Example: Sushi)`, (response, convoCont) => {
          foodChoice = response.text;
          console.log(foodChoice);

          if (location.length > 0 && foodChoice.length > 0) {
            yelpClient.search({
              term: foodChoice,
              location,
            }).then((res) => {
              convo.say(`We have found the best place for ${foodChoice}: ${res.jsonBody.businesses[0].name}`);

              convo.say(`It has ${res.jsonBody.businesses[0].review_count} reviews on Yelp, with an average rating of ${res.jsonBody.businesses[0].rating}. Call ${res.jsonBody.businesses[0].phone} if you wanna order food now!`);
              console.log(res.jsonBody.businesses[0]);

              const attachments = {
                attachments: [
                  {
                    fallback: 'Food Food Food!',
                    title: res.jsonBody.businesses[0].name,
                    text: res.jsonBody.businesses[0].url,
                    color: '#ff0000',
                    thumb_url: res.jsonBody.businesses[0].image_url,
                  },
                ],
              };

              convo.say(attachments);
            }).catch((e) => {
              console.log(e);
            });
          }

          convoCont.next();
        }, { key: 'food' }, 'default');

        convo.addMessage('Give me a couple seconds to search through and rank all the surrounding restaurants!!', 'default');
      });
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});


// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`listening on: ${port}`);
