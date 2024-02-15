import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { fetchLatestListings } from "../src/helpers/coinmarketcap";

type Token = {
  id: Number;
  name: string;
  symbol: string;
  quote: unknown;
};

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    seedUsers();
    seedExchangeAndCurrency();
    seedItems();
  } catch (error) {
    console.log("Error occurred while seeding: ", error);
  } finally {
    prisma.$disconnect();
  }
}

async function seedUsers() {
  // insert an admin user
  await prisma.user.upsert({
    where: { email: "zentiasas@gmail.com" },
    update: {},
    create: {
      name: "Saurav",
      email: "zentiasas@gmail.com",
      isAdmin: true,
    },
  });

  // insert few non admin users
  await prisma.user.upsert({
    where: { email: "alice@gmail.com" },
    update: {},
    create: {
      name: "Alice",
      email: "alice@gmail.com",
      isAdmin: false,
    },
  });

  await prisma.user.upsert({
    where: { email: "bob@gmail.com" },
    update: {},
    create: {
      name: "Bob",
      email: "bob@gmail.com",
      isAdmin: false,
    },
  });
}

async function seedExchangeAndCurrency() {
  await prisma.exchange.upsert({
    where: { name: "CoinMarketCap" },
    update: {},
    create: {
      name: "CoinMarketCap",
      rateLimit: {
        daily: 1000,
        monthly: 20000,
      },
    },
  });

  try {
    const tokens = await fetchLatestListings();

    const promises = tokens.map(async (token: Token) => {
      return prisma.currency.upsert({
        where: { externalCurrencyId: `${token.id}` },
        update: {},
        create: {
          name: token.name,
          symbol: token.symbol,
          externalCurrencyId: `${token.id}`,
        },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.log("Errored out in coin market cap APIs", error);
  }
}

async function seedItems() {
  const currency = await prisma.currency.findFirst({
    where: {},
  });

  const items = [
    {
      name: "Table",
      description: "a table with good wood",
      price: 10,
      quantity: 200,
      currencyId: currency?.id as string,
    },
    {
      name: "Chair",
      description: "a chair with good wood",
      price: 20,
      quantity: 100,
      currencyId: currency?.id as string,
    },
    {
      name: "Laptop",
      description: "for studing, macbook",
      price: 1000,
      quantity: 50,
      currencyId: currency?.id as string,
    },
    {
      name: "Lamp",
      description: "nice lamp for study",
      price: 50,
      quantity: 300,
      currencyId: currency?.id as string,
    },
  ];

  const promises = items.map((item) => {
    return prisma.item.upsert({
      where: {
        name: item.name,
      },
      update: {},
      create: item,
    });
  });

  await Promise.all(promises);
}

seedDatabase();
