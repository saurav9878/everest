// @ts-ignore
const dotenv = require("dotenv");
const cron = require("node-cron");

const { redis } = require("../src/redis");
const { fetchLatestListings } = require("../helpers/coinmarketcap");

dotenv.config();

// run this cron job every one minute
cron.schedule("* * * * *", async () => {
  try {
    const coins = await fetchLatestListings();
    const promises = coins.map(async (coin: any) => {
      return await redis.set(
        `CoinMarketCap:${coin.name}:${coin.id}`,
        `${coin.quote.USD.price}`,
        "EX",
        60
      );
    });

    await Promise.all(promises);
  } catch (error) {
    console.log(error);
  }
});

type Quote = {
  price: string;
};
