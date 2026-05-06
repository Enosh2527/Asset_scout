const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: "AIzaSyCvXkLa7On7RkWKpDi11OFmqN8NlQFLrG0" });

async function run() {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyCvXkLa7On7RkWKpDi11OFmqN8NlQFLrG0');
    const data = await response.json();
    console.log(data.models.map(m => m.name).filter(n => n.includes('flash')));
  } catch(e) {
    console.error(e);
  }
}
run();
