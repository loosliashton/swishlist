const functions = require('firebase-functions');

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/generative-ai');
const apiKey = functions.config().gemini.key;
const gemini = new GoogleGenerativeAI(apiKey);

const model = gemini.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
};

exports.getSuggestions = functions.https.onCall(
  async (data: { list: any }, context: any) => {
    const parts = [
      { text: generateContentString(data.list) },
      {
        text: "I'm putting together a gift list and need suggestions on what to add. Make sure the suggestions are related to the list I provide. Provide at least one suggestion for every two items in the provided list. Provide your suggestions in the form of a JSON array in an object called 'suggestions'. Please return the following JSON for each suggestion: {name: string, description: string}. ",
      },
    ];

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig,
    });

    return result;

    function generateContentString(list: any): string {
      let content =
        'Here is my current list of items. Please give me at least two suggestions (preferably more) to add to the list. \n';
      if (!list.items) return content;
      for (let item of list.items) {
        content += `Item: ${item.name}\n; `;
        if (item.url) content += `URL: ${item.url}\n`;
        if (item.description) content += `Description: ${item.description}\n`;
      }
      return content;
    }
  },
);

const amazonAsin = require('amazon-asin');

exports.getAmazonLinks = functions.https.onCall(
  async (data: { url: string }, context: any) => {
    const storeId = 'swishlist00-20';
    const result = await amazonAsin.asyncParseAsin(data.url);
    if (!result.ASIN) return { keepaUrl: '', affiliateUrl: data.url };
    return {
      keepaUrl: `https://keepa.com/#!search/1-${result.ASIN}`,
      affiliateUrl: `http://www.amazon.com/dp/${result.ASIN}/ref=nosim?tag=${storeId}`,
    };
  },
);

// Legacy function for compatibility with old code
exports.getCamelLink = functions.https.onCall(
  async (data: { url: string }, context: any) => {
    const result = await amazonAsin.asyncParseAsin(data.url);
    if (!result.ASIN) return '';
    return `https://keepa.com/#!search/1-${result.ASIN}`;
  },
);
