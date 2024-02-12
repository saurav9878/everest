import { app } from "./app";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getCurrenciesInUsd } from "../helpers/coinmarketcap";
import { ObjectId } from "mongodb";

const prisma = new PrismaClient();

app.get("/currencies", async (req: Request, res: Response) => {
  const { limit, cursor } = req.query;

  const currencies = await prisma.currency.findMany({
    take: parseInt(limit as string) || 100,
    ...(cursor && {
      skip: 1,
      cursor: {
        id: cursor as string,
      },
    }),
  });

  if (currencies) {
    return res.send({
      error: false,
      data: currencies,
    });
  }

  res.status(404);
  return res.send({
    error: true,
    data: "No currencies found",
  });
});

app.get("/items", async (req: Request, res: Response) => {
  try {
    const { currencyId, limit, cursor } = req.query;

    // check whether currencyId is a MongoDB ObjectID
    if (!ObjectId.isValid(currencyId as unknown as ObjectId)) {
      throw new Error("invalid_currency");
    }

    // Cursor represents an element's ID in MongoDB
    if (cursor && !ObjectId.isValid(cursor as unknown as ObjectId)) {
      throw new Error("invalid_cursor");
    }

    // Query items in a paginated form with default limit as 100
    const items = await prisma.item.findMany({
      take: parseInt(limit as string) || 100,
      ...(cursor && {
        /**
         * skip = 1 as one element is skipped to discard the cursor element which
         * otherwise will be included in the result.
         */
        skip: 1,
        cursor: {
          id: cursor as string,
        },
      }),
      include: {
        currency: true,
      },
    });

    const currency = await prisma.currency.findFirst({
      where: {
        id: currencyId as string,
      },
    });

    if (!currency) {
      throw new Error("invalid_currency");
    }

    // Fetch user requested currency latest value in USD
    const requestedCurrencyQuote = await getCurrenciesInUsd([currency]);
    const requestedCurrencyInUsd = Object.values(
      requestedCurrencyQuote
    )[0] as number;

    if (items) {
      const prices = await getCurrenciesInUsd(
        items.map((item) => item.currency)
      );

      return res.send({
        error: false,
        data: items.map((item) => ({
          ...item,
          price:
            item.price *
            ((prices[item.currencyId] as number) / requestedCurrencyInUsd),
          currency: currency,
          currencyId: currency.id as string,
        })),
      });
    }

    throw new Error("empty_inventory");
  } catch (error: any) {
    switch (error?.message) {
      case "invalid_currency":
        res.status(400);

        res.send({
          error: true,
          data: "Missing / Invalid currencyId in the query params",
        });
        break;

      case "invalid_cursor":
        res.status(400);
        res.send({
          error: true,
          data: "Invalid cursor. Consider using Id of the last element of the items array to view the next page",
        });
        break;

      case "empty_inventory":
        res.status(404);
        res.send({
          error: true,
          data: "Inventory is empty.",
        });

      default:
        res.status(500);
        res.send({
          error: true,
          data: "Something went wrong" + error,
        });
        break;
    }
  }
});
