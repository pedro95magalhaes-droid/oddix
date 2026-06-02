const axios = require('axios');

async function test() {
  try {
    const response = await axios.post(
      'https://apitemplateio.p.rapidapi.com/v2/create-image?template_id=00377b2b1e0ee394',
      {
        overrides: [
          {
            name: 'text_1',
            text: 'ODDIX TESTE'
          }
        ]
      },
      {
        headers: {
          'x-rapidapi-key': process.env.APITEMPLATE_RAPIDAPI_KEY,
          'x-rapidapi-host': 'apitemplateio.p.rapidapi.com',
          'X-API-KEY': process.env.APITEMPLATE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(response.data);
  } catch (error) {
    console.log(
      error.response?.data || error.message
    );
  }
}

test();