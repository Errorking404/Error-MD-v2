//base by Error-MD
//re-upload? recode? copy code? give credit ya :)
//YouTube: @Error-MD
//Instagram: unicorn_xeon13
//Telegram: t.me/xeonbotinc
//GitHub: @Error-MD
//WhatsApp: +916909137213
//want more free bot scripts? subscribe to my youtube channel: https://youtube.com/@Error-MD

const chalk = require('chalk')
const color = (text, color) => {
    return !color ? chalk.green(text) : chalk.keyword(color)(text)
}
const bgcolor = (text, bgcolor) => {
	return !bgcolor ? chalk.green(text) : chalk.bgKeyword(bgcolor)(text)
}
module.exports = {
	color,
	bgcolor
}
