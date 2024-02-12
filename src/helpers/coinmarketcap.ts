import axios from "axios";
import { redis } from "../redis";
import { Currency } from "@prisma/client";

/**
 * This CoinMarketCap API fetches all the cryptocurrencies latest values reported every minute
 * @returns
 */
export const fetchLatestListings = async () => {
  const { data: response } = await axios.get(
    `${process.env.SANDBOX_COINMARKETCAP_BASE_URL}/v1/cryptocurrency/listings/latest`,
    {
      headers: {
        "X-CMC_PRO_API_KEY": process.env.SANDBOX_COINMARKETCAP_API_KEY,
        Accept: "*/*",
      },
    }
  );
  const { data: currencies } = response;
  return currencies;
};

/**
 * This CoinMarketCap API fetches the lates values for specified crypto currencies
 * @param outdatedCurrencies
 * @returns
 */
const fetchLatestValueOfCurrencies = async (outdatedCurrencies: any) => {
  try {
    const externalCurrencyIds = [];

    // Iterate through the outdatedCurrencies to get a list of CoinMarketCap currency IDs i.e. externalCurrencyId
    for (const key in outdatedCurrencies) {
      const currency = outdatedCurrencies[key];
      externalCurrencyIds.push(currency.externalCurrencyId);
    }

    const { data: response } = await axios.get(
      `${process.env.SANDBOX_COINMARKETCAP_BASE_URL}/v2/cryptocurrency/quotes/latest`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.SANDBOX_COINMARKETCAP_API_KEY,
          Accept: "*/*",
        },
        params: {
          id: externalCurrencyIds.join(), // Eg. id = 'id1,id2,id3,...'
        },
      }
    );
    const { data: currencies } = response;

    const results = Object.values(currencies).map((currency: any) => ({
      currencyId: Object.keys(outdatedCurrencies).filter(
        (key) =>
          parseInt(outdatedCurrencies[key].externalCurrencyId) === currency.id
      )[0],

      priceInUsd: currency.quote.USD.price,
    }));
    return results;
  } catch (error) {
    console.log(error);
    // TODO: Use exponential backoff rate limiting logic for API call (429) rate failures
  }
};

/**
 * Get the latest value of currencies in USD
 * @param currencies
 * @returns
 */
export const getCurrenciesInUsd = async (currencies: Currency[]) => {
  const outdatedCurrencies: { [key: string]: Currency } = {};
  const results: { [key: string]: Number } = {};

  /**
   * Sample data format:
   * outdatedCurrencies = { currencyId: {id: currencyId, name:'sample_coin', symbol: 'SC', externalCurrencyId: 2420} }
   * results = {currencyId: priceInUSD}
   */

  // check if cache contains the latest values
  for (const currency of currencies) {
    const value = await redis.get(
      `CoinMarketCap:${currency.name}:${currency.id}`
    );
    if (value) {
      results.currencyId = value;
    } else {
      // create an array of outdated currencies to retrieve their latest values
      if (!outdatedCurrencies[currency.id]) {
        outdatedCurrencies[currency.id] = currency;
      }
    }
  }

  // If there are outdated entries, retrieve latest value from the 3rd party API
  if (Object.keys(outdatedCurrencies).length) {
    const latestQuotes = await fetchLatestValueOfCurrencies(outdatedCurrencies);

    latestQuotes?.map(
      ({
        currencyId,
        priceInUsd,
      }: {
        currencyId: string;
        priceInUsd: number;
      }) => {
        results[currencyId] = priceInUsd;
      }
    );
  }

  return results;
};
