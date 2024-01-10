require('dotenv').config();
const words = require('./words');
const bot = require('./bot');
const tts = require('google-tts-api');


const checkWithVoice = {};
const activeUsers = {};
const activeQuestions = {};
const lenguageOptions = {
    reply_markup: JSON.stringify({
        inline_keyboard: [
            [{text: 'English', callback_data: 'en'}],
            [{text: 'Armenian', callback_data: 'am'}]
        ]
    })
};


let languages = {};
let mistakes = {};
let generatorLoopExam = null;


const textToSpeech = async (text) => {
    try {
      const url = await tts.getAudioUrl(text, { lang: 'en', slow: false });
      return url;
    } catch (error) {
      console.error('Error generating TTS:', error);
      throw error;
    }
};

function findKeyByString(searchString) {
    if (words.hasOwnProperty(searchString)) {
        return words[searchString];
    };
    for (let key in words) {
        if (words[key] === searchString) {
            return key;
        };
    };
    return "";
};

function checkAnswer(translatedAnswer, correctAnswer) {
    translatedAnswer = translatedAnswer.toLowerCase();
    correctAnswer = correctAnswer.toLowerCase();
    if (translatedAnswer === correctAnswer) return false;
    if (
        translatedAnswer.length >= correctAnswer.length + 3 ||
        translatedAnswer.length <= correctAnswer.length - 3
    ) return true;
    const spletedUserAnswer = [];

    for (let i = 0; i < translatedAnswer.length; i += 3) {
        spletedUserAnswer.push(translatedAnswer.slice(i, i + 3));
    };

    let correctCharesCount = spletedUserAnswer.length;

    for (let charGroup of spletedUserAnswer) {
        if (correctAnswer.indexOf(charGroup) === -1) {  
            correctCharesCount -= 1;
        };
    };

    if (
        correctCharesCount >=
        (spletedUserAnswer.length - 2 > 1
            ? spletedUserAnswer.length - 2
            : spletedUserAnswer.length - 1)
    ) {
        return false;
    }

    return true;
};

function* startQuestionLoopGenerator(obj, chatId) {
    const method = languages[chatId] === 'Englesh'? 'keys' : 'values';

    const keys = Object[method](obj);

    for (let i = 0; i < keys.length; i++) {
        yield keys[i];
    };
};

async function stopChat(chatId) {
    delete activeUsers[chatId];
    activeQuestions[chatId] = '';
    languages[chatId] = {};
    mistakes[chatId] = {};
    generatorLoopExam = null;

    await bot.sendMessage(chatId, 'chat is stop, you can continue after clicking start.');
};


bot.setMyCommands([
    { command: '/start', description: 'Start answer' },
    { command: '/start_with_voice', description: 'start answering proccess with voice' },
    { command: '/info', description: 'Information about Bot' },
    { command: '/stop', description: 'Stop proccess' },
    
]);

bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name;

    try {
        if(text === '/start' || text === '/info' || text === 'info' || text === 'start' || text === 'start with voice' || text === '/start_with_voice') {
            if(text === '/info' || text === 'info') {
                checkWithVoice[chatId] = false;
                return await bot.sendMessage(chatId, "in this bot, you can learn new English words, so you just be select what lenguages do you want to translate that special word and we can start.", lenguageOptions);
            };

            if(text === 'start with voice' || text === '/start_with_voice') {
                checkWithVoice[chatId] = true;
                return await bot.sendMessage(chatId, 'please select what lenguages do you want to answer', lenguageOptions);
            };

            checkWithVoice[chatId] = false;
            return await bot.sendMessage(chatId, 'please select what lenguages do you want to answer', lenguageOptions);
        };

        if(text === '/stop' || text === 'stop') {
            return stopChat(chatId);
        };

        if(!activeUsers[chatId]) {
            if(text === 'ape') {
                return await bot.sendMessage(chatId, `ooo I know, you are my close friend. thanks for notifying, bro but after click start don't send this message`);
            };
            if(text === 'ape ape') {
                return await bot.sendMessage(chatId, `${firstName}s tangs generals you don't have any problem in this chat, just do what you want`);
            };
            return await bot.sendMessage(chatId, `bro I don't know what you want from this bot, but if you wanna to start learn new words, click the start from the menu`);
        };

        if(activeUsers[chatId]) {
            const valueObj = generatorLoopExam.next();
            const correctAnswer = findKeyByString(activeQuestions[chatId]);
            const isInCorrectAnswer = checkAnswer(text, correctAnswer);

            if(isInCorrectAnswer) {
                mistakes[chatId][activeQuestions[chatId]] = { wrongAnswer: text, correctAnswer };
                await bot.sendMessage(chatId, `wrong answer.\ncorrect: ${correctAnswer}.\nDon't worry continue.`);
            };

            if(valueObj.done) {
                const mistakeKeys = Object.keys(mistakes[chatId]);
                const isThereMistakes = Boolean(mistakeKeys.length);

                if(isThereMistakes) {
                    await bot.sendMessage(chatId, `you have an ${mistakeKeys.length} mistakes here them.`);
                    for(key in mistakes[chatId]) {
                        const message = `${key} \nwrong "${mistakes[chatId]?.[key]?.wrongAnswer}" \ncorrect "${mistakes[chatId]?.[key]?.correctAnswer}"`;
                        await bot.sendMessage(chatId, message);
                    };
                    return stopChat(chatId);
                };
                await bot.sendMessage(chatId, "thanks you don't have a mistake.");
                return stopChat(chatId);
            };

            if(checkWithVoice[chatId]) {
                const voice = await textToSpeech(correctAnswer);
                await bot.sendVoice(chatId, voice);
            };

            await bot.sendMessage(chatId, valueObj.value);
            activeQuestions[chatId] = valueObj.value;
            return;
        };

    } catch (error) {
        console.log('error --> ', error);
    }
});

bot.on('callback_query', async (msg) => {
    try {
        const chatId = msg.message.chat.id;
        if(msg.data === 'en' || msg.data === 'am') {
            activeUsers[chatId] = true;
            activeQuestions[chatId] = '';
            mistakes[chatId] = {};
            generatorLoopExam = null;

            languages[chatId] = msg?.data === 'am' ? 'Englesh' : 'Armenian';
            generatorLoopExam = startQuestionLoopGenerator(words, chatId);
            const questionWord = generatorLoopExam.next().value;
            await bot.sendMessage(chatId, `cool, please answer with ${msg?.data === 'am' ? 'Armenian' : 'Englesh'}, we are starting now`);
            await bot.sendMessage(chatId, questionWord);
            activeQuestions[chatId] = questionWord;
            return;
        };
        bot.sendMessage(chatId, 'something wrong please, try a little bit late');
    } catch(error) {
        console.log('error -> ', error);
    };
});